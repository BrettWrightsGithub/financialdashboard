-- ============================================================
-- MIGRATION: Enhanced Stored Procedures for Categorization Engine
-- ============================================================
-- 
-- FILE: 20260103_stored_procedures_enhanced.sql
-- STATUS: ✅ DEPLOYED (Verified 2026-01-03)
-- 
-- PURPOSE:
--   Enhances the categorization waterfall and undo functions with:
--   1. Batch tracking - All waterfall runs create/use a batch for undo support
--   2. Audit logging - Every category change is logged to category_audit_log
--   3. Statistics function - Get categorization metrics for date ranges
--   4. Enhanced undo - More detailed results (reverted, skipped, already_reverted)
--
-- REPLACES:
--   - fn_run_categorization_waterfall(uuid[]) 
--     → fn_run_categorization_waterfall(uuid, uuid[]) with batch_id support
--
-- CREATES:
--   - fn_categorize_transactions(uuid[]) -> jsonb (convenience wrapper)
--   - fn_undo_batch_detailed(uuid) -> jsonb (enhanced undo)
--   - fn_get_categorization_stats(date, date) -> jsonb (analytics)
--   - Enum value: pending_handover (added to category_change_source)
--
-- SHOULD I RUN THIS AGAIN?
--   NO - Already deployed and verified 2026-01-03.
--
-- BACKWARD COMPATIBILITY:
--   The TypeScript code in lib/categorization/ruleEngine.ts is written to work
--   with BOTH the old and new function signatures. It will automatically use
--   enhanced features when this migration is deployed.
--
-- ============================================================
-- Per docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md (Section L)
-- 
-- Current functions in DB (as of 2026-01-03):
-- - fn_apply_rule_retroactive(p_rule_id, p_transaction_ids, p_created_by)
-- - fn_handle_pending_handover() TRIGGER
-- - fn_log_category_change(p_transaction_id, p_previous_category_id, p_new_category_id, p_change_source, ...)
-- - fn_run_categorization_waterfall(p_transaction_ids uuid[]) -> jsonb
-- - fn_undo_batch(p_batch_id) -> TABLE(success, transactions_reverted, error)

-- ============================================================
-- ENHANCED CATEGORIZATION WATERFALL
-- ============================================================

-- Drop existing function to replace with enhanced version
DROP FUNCTION IF EXISTS fn_run_categorization_waterfall(UUID[]);

-- Create enhanced categorization waterfall with batch tracking
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
  -- Create or use provided batch
  IF p_batch_id IS NULL THEN
    INSERT INTO rule_application_batches (operation_type, description, created_by)
    VALUES ('waterfall', 'Automatic categorization waterfall', 'system')
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

  -- Update batch statistics
  UPDATE rule_application_batches
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

-- ============================================================
-- CONVENIENCE WRAPPER (backward compatible)
-- ============================================================

-- Simple wrapper that only takes transaction IDs (creates batch automatically)
CREATE OR REPLACE FUNCTION fn_categorize_transactions(p_transaction_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN fn_run_categorization_waterfall(NULL, p_transaction_ids);
END;
$$;

-- ============================================================
-- BATCH UNDO WITH DETAILED RESULTS
-- ============================================================

-- Enhanced undo that returns more detail
CREATE OR REPLACE FUNCTION fn_undo_batch_detailed(p_batch_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_batch RECORD;
  v_reverted INT := 0;
  v_skipped_locked INT := 0;
  v_already_reverted INT := 0;
BEGIN
  -- Check if batch exists
  SELECT * INTO v_batch
  FROM rule_application_batches
  WHERE id = p_batch_id;
  
  IF v_batch IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Batch not found'
    );
  END IF;
  
  IF v_batch.is_undone THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Batch already undone'
    );
  END IF;

  -- Count already reverted entries
  SELECT COUNT(*) INTO v_already_reverted
  FROM category_audit_log
  WHERE batch_id = p_batch_id AND is_reverted = TRUE;

  -- Revert each non-reverted change in the batch
  WITH reverted AS (
    UPDATE transactions t
    SET 
      life_category_id = cal.previous_category_id,
      category_source = CASE 
        WHEN cal.previous_category_id IS NULL THEN NULL 
        ELSE 'undo' 
      END,
      applied_rule_id = NULL,
      updated_at = NOW()
    FROM category_audit_log cal
    WHERE cal.batch_id = p_batch_id
      AND cal.transaction_id = t.id
      AND cal.is_reverted = FALSE
      AND t.category_locked = FALSE
    RETURNING t.id
  )
  SELECT COUNT(*) INTO v_reverted FROM reverted;

  -- Count skipped locked
  SELECT COUNT(*) INTO v_skipped_locked
  FROM category_audit_log cal
  JOIN transactions t ON t.id = cal.transaction_id
  WHERE cal.batch_id = p_batch_id
    AND cal.is_reverted = FALSE
    AND t.category_locked = TRUE;

  -- Mark audit entries as reverted
  UPDATE category_audit_log
  SET is_reverted = TRUE
  WHERE batch_id = p_batch_id AND is_reverted = FALSE;

  -- Mark batch as undone
  UPDATE rule_application_batches
  SET is_undone = TRUE, undone_at = NOW()
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'success', true,
    'batch_id', p_batch_id,
    'reverted', v_reverted,
    'skipped_locked', v_skipped_locked,
    'already_reverted', v_already_reverted
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PENDING HANDOVER ENUM VALUE
-- ============================================================

-- Add pending_handover to enum if not exists
DO $$ BEGIN
  ALTER TYPE category_change_source ADD VALUE IF NOT EXISTS 'pending_handover';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- STATISTICS FUNCTIONS
-- ============================================================

-- Get categorization statistics for a date range
CREATE OR REPLACE FUNCTION fn_get_categorization_stats(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_total INT;
  v_categorized INT;
  v_uncategorized INT;
  v_by_source JSONB;
  v_locked INT;
BEGIN
  -- Default to current month
  IF p_start_date IS NULL THEN
    p_start_date := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  END IF;
  IF p_end_date IS NULL THEN
    p_end_date := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  END IF;

  -- Total transactions
  SELECT COUNT(*) INTO v_total
  FROM transactions
  WHERE date >= p_start_date AND date <= p_end_date
    AND status = 'posted';

  -- Categorized
  SELECT COUNT(*) INTO v_categorized
  FROM transactions
  WHERE date >= p_start_date AND date <= p_end_date
    AND status = 'posted'
    AND life_category_id IS NOT NULL;

  -- Uncategorized
  v_uncategorized := v_total - v_categorized;

  -- Locked
  SELECT COUNT(*) INTO v_locked
  FROM transactions
  WHERE date >= p_start_date AND date <= p_end_date
    AND status = 'posted'
    AND category_locked = TRUE;

  -- By source
  SELECT jsonb_object_agg(
    COALESCE(category_source, 'uncategorized'),
    cnt
  ) INTO v_by_source
  FROM (
    SELECT category_source, COUNT(*) as cnt
    FROM transactions
    WHERE date >= p_start_date AND date <= p_end_date
      AND status = 'posted'
    GROUP BY category_source
  ) sub;

  RETURN jsonb_build_object(
    'date_range', jsonb_build_object('start', p_start_date, 'end', p_end_date),
    'total', v_total,
    'categorized', v_categorized,
    'uncategorized', v_uncategorized,
    'locked', v_locked,
    'by_source', COALESCE(v_by_source, '{}'::jsonb),
    'categorization_rate', CASE WHEN v_total > 0 THEN ROUND((v_categorized::NUMERIC / v_total) * 100, 1) ELSE 0 END
  );
END;
$$;

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT EXECUTE ON FUNCTION fn_run_categorization_waterfall(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_run_categorization_waterfall(UUID, UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION fn_categorize_transactions(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_categorize_transactions(UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION fn_undo_batch_detailed(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_undo_batch_detailed(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION fn_get_categorization_stats(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_get_categorization_stats(DATE, DATE) TO service_role;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON FUNCTION fn_run_categorization_waterfall IS 
'Enhanced categorization waterfall with batch tracking and audit logging. 
Applies: Rules (priority order) → Payee Memory → Plaid defaults.
All changes logged to category_audit_log for explainability and undo support.';

COMMENT ON FUNCTION fn_categorize_transactions IS 
'Convenience wrapper for fn_run_categorization_waterfall that auto-creates a batch.';

COMMENT ON FUNCTION fn_undo_batch_detailed IS 
'Undo all category changes in a batch with detailed statistics.
Respects category_locked - locked transactions are skipped.';

COMMENT ON FUNCTION fn_get_categorization_stats IS 
'Get categorization statistics for a date range.
Shows total, categorized, uncategorized counts and breakdown by source.';
