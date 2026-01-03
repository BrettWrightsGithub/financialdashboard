-- Categorization Waterfall Stored Procedure
-- Implements the rule engine logic per docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS fn_run_categorization_waterfall(UUID[]);

-- Create the categorization waterfall function
CREATE OR REPLACE FUNCTION fn_run_categorization_waterfall(
  p_transaction_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_processed INT := 0;
  v_rules_applied INT := 0;
  v_memory_applied INT := 0;
  v_plaid_applied INT := 0;
  v_skipped_locked INT := 0;
  v_uncategorized INT := 0;
  v_rule RECORD;
  v_txn RECORD;
  v_matched BOOLEAN;
  v_payee_category_id UUID;
BEGIN
  -- Count locked transactions (we'll skip these)
  SELECT COUNT(*) INTO v_skipped_locked
  FROM transactions
  WHERE id = ANY(p_transaction_ids)
    AND category_locked = TRUE;

  -- Process each unlocked transaction
  FOR v_txn IN
    SELECT t.*
    FROM transactions t
    WHERE t.id = ANY(p_transaction_ids)
      AND t.category_locked = FALSE
  LOOP
    v_processed := v_processed + 1;
    v_matched := FALSE;

    -- STEP 1: Apply categorization rules (highest priority first)
    FOR v_rule IN
      SELECT *
      FROM categorization_rules
      WHERE is_active = TRUE
      ORDER BY priority DESC
    LOOP
      -- Check if rule matches this transaction
      IF fn_rule_matches_transaction(v_rule, v_txn) THEN
        -- Apply the rule
        UPDATE transactions
        SET
          life_category_id = v_rule.assign_category_id,
          category_source = 'rule',
          applied_rule_id = v_rule.id,
          is_transfer = COALESCE(v_rule.assign_is_transfer, is_transfer),
          is_pass_through = COALESCE(v_rule.assign_is_pass_through, is_pass_through),
          updated_at = NOW()
        WHERE id = v_txn.id;

        v_rules_applied := v_rules_applied + 1;
        v_matched := TRUE;
        EXIT; -- First matching rule wins
      END IF;
    END LOOP;

    -- STEP 2: If no rule matched, check payee memory (category_overrides)
    IF NOT v_matched THEN
      SELECT co.category_id INTO v_payee_category_id
      FROM category_overrides co
      WHERE co.is_active = TRUE
        AND co.description_pattern IS NOT NULL
        AND UPPER(v_txn.description_raw) LIKE UPPER('%' || co.description_pattern || '%')
      ORDER BY co.priority DESC
      LIMIT 1;

      IF v_payee_category_id IS NOT NULL THEN
        UPDATE transactions
        SET
          life_category_id = v_payee_category_id,
          category_source = 'payee_memory',
          updated_at = NOW()
        WHERE id = v_txn.id;

        v_memory_applied := v_memory_applied + 1;
        v_matched := TRUE;
      END IF;
    END IF;

    -- STEP 3: If still no match, use Plaid category if confidence > 80
    IF NOT v_matched AND v_txn.category_ai IS NOT NULL AND v_txn.category_ai_conf >= 80 THEN
      -- Try to find a matching category by name
      DECLARE
        v_plaid_category_id UUID;
      BEGIN
        -- Simple mapping: look for category with similar name
        SELECT id INTO v_plaid_category_id
        FROM categories
        WHERE is_active = TRUE
          AND (
            UPPER(name) = UPPER(SPLIT_PART(v_txn.category_ai, '_', 1))
            OR UPPER(name) LIKE '%' || UPPER(SPLIT_PART(v_txn.category_ai, '_', 1)) || '%'
          )
        LIMIT 1;

        IF v_plaid_category_id IS NOT NULL THEN
          UPDATE transactions
          SET
            life_category_id = v_plaid_category_id,
            category_source = 'plaid',
            category_confidence = v_txn.category_ai_conf::NUMERIC / 100,
            updated_at = NOW()
          WHERE id = v_txn.id;

          v_plaid_applied := v_plaid_applied + 1;
          v_matched := TRUE;
        END IF;
      END;
    END IF;

    -- Count uncategorized
    IF NOT v_matched THEN
      v_uncategorized := v_uncategorized + 1;
    END IF;
  END LOOP;

  -- Return statistics
  RETURN jsonb_build_object(
    'processed', v_processed,
    'rules_applied', v_rules_applied,
    'memory_applied', v_memory_applied,
    'plaid_applied', v_plaid_applied,
    'skipped_locked', v_skipped_locked,
    'uncategorized', v_uncategorized
  );
END;
$$;

-- Helper function to check if a rule matches a transaction
CREATE OR REPLACE FUNCTION fn_rule_matches_transaction(
  p_rule categorization_rules,
  p_txn transactions
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_description TEXT;
  v_amount NUMERIC;
  v_is_outflow BOOLEAN;
BEGIN
  v_description := UPPER(COALESCE(p_txn.description_raw, ''));
  v_amount := ABS(p_txn.amount);
  v_is_outflow := p_txn.amount < 0;

  -- Check merchant exact match
  IF p_rule.match_merchant_exact IS NOT NULL THEN
    IF v_description != UPPER(p_rule.match_merchant_exact) THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- Check merchant contains match
  IF p_rule.match_merchant_contains IS NOT NULL THEN
    IF v_description NOT LIKE '%' || UPPER(p_rule.match_merchant_contains) || '%' THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- If no merchant criteria specified, we need at least one other condition
  IF p_rule.match_merchant_exact IS NULL AND p_rule.match_merchant_contains IS NULL THEN
    -- Must have at least one other condition
    IF p_rule.match_amount_min IS NULL 
       AND p_rule.match_amount_max IS NULL 
       AND p_rule.match_direction IS NULL
       AND p_rule.match_account_id IS NULL
       AND p_rule.match_account_subtype IS NULL THEN
      RETURN FALSE; -- Rule has no conditions, skip it
    END IF;
  END IF;

  -- Check amount range
  IF p_rule.match_amount_min IS NOT NULL AND v_amount < p_rule.match_amount_min THEN
    RETURN FALSE;
  END IF;

  IF p_rule.match_amount_max IS NOT NULL AND v_amount > p_rule.match_amount_max THEN
    RETURN FALSE;
  END IF;

  -- Check direction
  IF p_rule.match_direction IS NOT NULL THEN
    IF p_rule.match_direction = 'outflow' AND NOT v_is_outflow THEN
      RETURN FALSE;
    END IF;
    IF p_rule.match_direction = 'inflow' AND v_is_outflow THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- Check account
  IF p_rule.match_account_id IS NOT NULL AND p_txn.account_id != p_rule.match_account_id THEN
    RETURN FALSE;
  END IF;

  -- All conditions passed
  RETURN TRUE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION fn_run_categorization_waterfall(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_run_categorization_waterfall(UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION fn_rule_matches_transaction(categorization_rules, transactions) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_rule_matches_transaction(categorization_rules, transactions) TO service_role;

COMMENT ON FUNCTION fn_run_categorization_waterfall IS 'Categorization waterfall: Rules → Payee Memory → Plaid defaults. Respects category_locked flag.';
