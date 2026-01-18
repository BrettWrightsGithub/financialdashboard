-- ============================================================
-- MIGRATION: Fix Batch Table Reference in Categorization Waterfall
-- ============================================================
-- 
-- FILE: 20260113_fix_batch_table_reference.sql
-- STATUS: ⏳ PENDING DEPLOYMENT
-- 
-- PURPOSE:
--   Fixes the fn_run_categorization_waterfall function to use the correct
--   batch tracking table. The function was creating batches in 
--   rule_application_batches but setting category_batch_id on transactions,
--   which has a foreign key constraint to category_batches.id.
--
-- FIXES:
--   - Changes batch creation from rule_application_batches → category_batches
--   - Updates batch statistics update to reference category_batches
--   - Aligns with FK constraint: transactions.category_batch_id → category_batches.id
--
-- ERROR FIXED:
--   409 - "insert or update on table \"transactions\" violates foreign key 
--   constraint \"transactions_category_batch_id_fkey\""
--
-- ============================================================

-- Drop and recreate the function with correct table references
DROP FUNCTION IF EXISTS fn_run_categorization_waterfall(UUID, UUID[]);

CREATE OR REPLACE FUNCTION fn_run_categorization_waterfall(
  p_batch_id UUID DEFAULT NULL,
  p_transaction_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_batch_id UUID;
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
  v_old_category_id UUID;
BEGIN
  -- Create or use provided batch (FIXED: now uses category_batches)
  IF p_batch_id IS NULL THEN
    INSERT INTO category_batches (operation_type, description)
    VALUES ('waterfall', 'Automatic categorization waterfall')
    RETURNING id INTO v_batch_id;
  ELSE
    v_batch_id := p_batch_id;
  END IF;

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
    v_old_category_id := v_txn.life_category_id;

    -- STEP 1: Apply categorization rules (highest priority first)
    FOR v_rule IN
      SELECT *
      FROM categorization_rules
      WHERE is_active = TRUE
      ORDER BY priority DESC
    LOOP
      -- Check if rule matches this transaction
      IF fn_rule_matches_transaction(v_rule, v_txn) THEN
        -- Only update if category would change
        IF v_txn.life_category_id IS DISTINCT FROM v_rule.assign_category_id THEN
          -- Apply the rule
          UPDATE transactions
          SET
            life_category_id = v_rule.assign_category_id,
            category_source = 'rule',
            applied_rule_id = v_rule.id,
            category_batch_id = v_batch_id,
            is_transfer = COALESCE(v_rule.assign_is_transfer, is_transfer),
            is_pass_through = COALESCE(v_rule.assign_is_pass_through, is_pass_through),
            updated_at = NOW()
          WHERE id = v_txn.id;

          -- Log to audit
          INSERT INTO category_audit_log (
            transaction_id, previous_category_id, new_category_id,
            change_source, rule_id, confidence_score, batch_id, changed_by
          ) VALUES (
            v_txn.id, v_old_category_id, v_rule.assign_category_id,
            'rule', v_rule.id, 1.0, v_batch_id, 'waterfall'
          );

          v_rules_applied := v_rules_applied + 1;
        END IF;
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

      IF v_payee_category_id IS NOT NULL AND v_txn.life_category_id IS DISTINCT FROM v_payee_category_id THEN
        UPDATE transactions
        SET
          life_category_id = v_payee_category_id,
          category_source = 'payee_memory',
          category_batch_id = v_batch_id,
          updated_at = NOW()
        WHERE id = v_txn.id;

        -- Log to audit
        INSERT INTO category_audit_log (
          transaction_id, previous_category_id, new_category_id,
          change_source, batch_id, changed_by
        ) VALUES (
          v_txn.id, v_old_category_id, v_payee_category_id,
          'payee_memory', v_batch_id, 'waterfall'
        );

        v_memory_applied := v_memory_applied + 1;
        v_matched := TRUE;
      END IF;
    END IF;

    -- STEP 3: If still no match, use Plaid category if confidence > 80
    IF NOT v_matched AND v_txn.category_ai IS NOT NULL AND v_txn.category_ai_conf >= 80 THEN
      DECLARE
        v_plaid_category_id UUID;
      BEGIN
        -- Look for category with similar name
        SELECT id INTO v_plaid_category_id
        FROM categories
        WHERE is_active = TRUE
          AND (
            UPPER(name) = UPPER(SPLIT_PART(v_txn.category_ai, '_', 1))
            OR UPPER(name) LIKE '%' || UPPER(SPLIT_PART(v_txn.category_ai, '_', 1)) || '%'
          )
        LIMIT 1;

        IF v_plaid_category_id IS NOT NULL AND v_txn.life_category_id IS DISTINCT FROM v_plaid_category_id THEN
          UPDATE transactions
          SET
            life_category_id = v_plaid_category_id,
            category_source = 'plaid',
            category_confidence = v_txn.category_ai_conf::NUMERIC / 100,
            category_batch_id = v_batch_id,
            updated_at = NOW()
          WHERE id = v_txn.id;

          -- Log to audit
          INSERT INTO category_audit_log (
            transaction_id, previous_category_id, new_category_id,
            change_source, confidence_score, batch_id, changed_by
          ) VALUES (
            v_txn.id, v_old_category_id, v_plaid_category_id,
            'plaid', v_txn.category_ai_conf::NUMERIC / 100, v_batch_id, 'waterfall'
          );

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

  -- Update batch statistics (FIXED: now uses category_batches)
  UPDATE category_batches
  SET transaction_count = v_rules_applied + v_memory_applied + v_plaid_applied
  WHERE id = v_batch_id;

  -- Return statistics
  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'processed', v_processed,
    'rules_applied', v_rules_applied,
    'memory_applied', v_memory_applied,
    'plaid_applied', v_plaid_applied,
    'skipped_locked', v_skipped_locked,
    'uncategorized', v_uncategorized
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION fn_run_categorization_waterfall(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_run_categorization_waterfall(UUID, UUID[]) TO service_role;

-- ============================================================
-- FIX FOREIGN KEY CONSTRAINT
-- ============================================================

-- Drop old foreign key pointing to wrong table
ALTER TABLE category_audit_log DROP CONSTRAINT IF EXISTS fk_audit_log_batch;

-- Add new foreign key pointing to correct table (category_batches)
ALTER TABLE category_audit_log
ADD CONSTRAINT fk_audit_log_batch
FOREIGN KEY (batch_id) REFERENCES category_batches(id) ON DELETE SET NULL;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON FUNCTION fn_run_categorization_waterfall IS 
'Enhanced categorization waterfall with batch tracking and audit logging. 
Applies: Rules (priority order) → Payee Memory → Plaid defaults.
All changes logged to category_audit_log for explainability and undo support.
FIXED: Now correctly uses category_batches table instead of rule_application_batches.';
