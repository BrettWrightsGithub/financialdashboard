---
description: Implement the Supabase stored procedures (The Engine) for categorization waterfall, batch undo, and pending handover per `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` (Section L).
auto_execution_mode: 1
---

## Architecture Context

Per Section L of the MVP plan, Supabase stored procedures are "The Engine" that executes:
- Waterfall categorization logic (rules → payee memory → Plaid defaults)
- Batch undo with ACID guarantees
- Pending→posted transaction handover

**Rationale:**
- **Performance:** Backfilling 1,000 transactions requires microseconds in SQL versus minutes in external loops.
- **Integrity:** Undo and audit logging require ACID transactions (all-or-nothing updates).

## Steps

1. Re-read:
   - `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` (Section L, TI-03, TI-04, TI-05)
   - `docs/db-schema.md` for table structures

2. Ensure prerequisite tables exist (from earlier workflows):
   - `categorization_rules` (priority, merchant_match, merchant_match_type, etc.)
   - `payee_category_mappings` (payee_name, category_id, confidence)
   - `category_audit_log` (transaction_id, previous_category_id, new_category_id, source, rule_id, batch_id)
   - `rule_application_batches` (id, rule_id, applied_at, transaction_count, is_undone)

3. **Implement `fn_run_categorization_waterfall(p_batch_id UUID, p_transaction_ids UUID[])`:**

   ```sql
   CREATE OR REPLACE FUNCTION fn_run_categorization_waterfall(
     p_batch_id UUID,
     p_transaction_ids UUID[]
   ) RETURNS JSONB AS $$
   DECLARE
     v_processed INT := 0;
     v_rules_applied INT := 0;
     v_memory_applied INT := 0;
     v_plaid_applied INT := 0;
     v_skipped_locked INT := 0;
   BEGIN
     -- Step 0: Count locked transactions (skip them)
     SELECT COUNT(*) INTO v_skipped_locked
     FROM transactions
     WHERE id = ANY(p_transaction_ids) AND category_locked = TRUE;

     -- Step 1: Apply rules (highest priority first)
     WITH rule_matches AS (
       SELECT DISTINCT ON (t.id)
         t.id AS transaction_id,
         t.category_id AS old_category_id,
         r.target_category_id AS new_category_id,
         r.id AS rule_id
       FROM transactions t
       CROSS JOIN LATERAL (
         SELECT * FROM categorization_rules r
         WHERE r.is_active = TRUE
           AND (
             (r.merchant_match_type = 'exact' AND t.description_clean = r.merchant_match)
             OR (r.merchant_match_type = 'contains' AND t.description_clean ILIKE '%' || r.merchant_match || '%')
             OR (r.merchant_match_type = 'regex' AND t.description_clean ~ r.merchant_match)
           )
           AND (r.amount_min IS NULL OR ABS(t.amount) >= r.amount_min)
           AND (r.amount_max IS NULL OR ABS(t.amount) <= r.amount_max)
           AND (r.account_id IS NULL OR t.account_id = r.account_id)
           AND (r.direction = 'any' OR (r.direction = 'debit' AND t.amount < 0) OR (r.direction = 'credit' AND t.amount > 0))
         ORDER BY r.priority DESC
         LIMIT 1
       ) r
       WHERE t.id = ANY(p_transaction_ids)
         AND t.category_locked = FALSE
         AND t.category_id IS DISTINCT FROM r.target_category_id
     )
     UPDATE transactions t
     SET category_id = rm.new_category_id,
         category_source = 'rule',
         applied_rule_id = rm.rule_id,
         updated_at = NOW()
     FROM rule_matches rm
     WHERE t.id = rm.transaction_id;

     GET DIAGNOSTICS v_rules_applied = ROW_COUNT;

     -- Log rule applications to audit log
     INSERT INTO category_audit_log (transaction_id, previous_category_id, new_category_id, change_source, rule_id, batch_id, created_at)
     SELECT rm.transaction_id, rm.old_category_id, rm.new_category_id, 'rule', rm.rule_id, p_batch_id, NOW()
     FROM rule_matches rm;

     -- Step 2: Apply payee memory for remaining uncategorized
     WITH memory_matches AS (
       SELECT t.id AS transaction_id,
              t.category_id AS old_category_id,
              pm.category_id AS new_category_id
       FROM transactions t
       JOIN payee_category_mappings pm ON t.description_clean = pm.payee_name
       WHERE t.id = ANY(p_transaction_ids)
         AND t.category_locked = FALSE
         AND t.category_source IS DISTINCT FROM 'rule'
         AND t.category_id IS DISTINCT FROM pm.category_id
     )
     UPDATE transactions t
     SET category_id = mm.new_category_id,
         category_source = 'payee_memory',
         updated_at = NOW()
     FROM memory_matches mm
     WHERE t.id = mm.transaction_id;

     GET DIAGNOSTICS v_memory_applied = ROW_COUNT;

     -- Log memory applications
     INSERT INTO category_audit_log (transaction_id, previous_category_id, new_category_id, change_source, batch_id, created_at)
     SELECT mm.transaction_id, mm.old_category_id, mm.new_category_id, 'payee_memory', p_batch_id, NOW()
     FROM memory_matches mm;

     -- Step 3: Apply Plaid defaults for remaining (confidence > 0.8)
     WITH plaid_defaults AS (
       SELECT t.id AS transaction_id,
              t.category_id AS old_category_id,
              t.plaid_category_id AS new_category_id
       FROM transactions t
       WHERE t.id = ANY(p_transaction_ids)
         AND t.category_locked = FALSE
         AND t.category_source IS NULL
         AND t.plaid_category_id IS NOT NULL
         AND t.plaid_confidence > 0.8
         AND t.category_id IS DISTINCT FROM t.plaid_category_id
     )
     UPDATE transactions t
     SET category_id = pd.new_category_id,
         category_source = 'plaid',
         updated_at = NOW()
     FROM plaid_defaults pd
     WHERE t.id = pd.transaction_id;

     GET DIAGNOSTICS v_plaid_applied = ROW_COUNT;

     -- Log Plaid applications
     INSERT INTO category_audit_log (transaction_id, previous_category_id, new_category_id, change_source, confidence_score, batch_id, created_at)
     SELECT pd.transaction_id, pd.old_category_id, pd.new_category_id, 'plaid', t.plaid_confidence, p_batch_id, NOW()
     FROM plaid_defaults pd
     JOIN transactions t ON t.id = pd.transaction_id;

     v_processed := array_length(p_transaction_ids, 1);

     RETURN jsonb_build_object(
       'processed', v_processed,
       'rules_applied', v_rules_applied,
       'memory_applied', v_memory_applied,
       'plaid_applied', v_plaid_applied,
       'skipped_locked', v_skipped_locked
     );
   END;
   $$ LANGUAGE plpgsql;
   ```

4. **Implement `fn_undo_batch(p_batch_id UUID)`:**

   ```sql
   CREATE OR REPLACE FUNCTION fn_undo_batch(p_batch_id UUID)
   RETURNS JSONB AS $$
   DECLARE
     v_reverted INT := 0;
   BEGIN
     -- Revert transactions to their previous category
     UPDATE transactions t
     SET category_id = cal.previous_category_id,
         category_source = NULL,
         applied_rule_id = NULL,
         updated_at = NOW()
     FROM category_audit_log cal
     WHERE cal.batch_id = p_batch_id
       AND cal.transaction_id = t.id
       AND cal.is_reverted = FALSE;

     GET DIAGNOSTICS v_reverted = ROW_COUNT;

     -- Mark audit log entries as reverted
     UPDATE category_audit_log
     SET is_reverted = TRUE
     WHERE batch_id = p_batch_id;

     -- Mark batch as undone
     UPDATE rule_application_batches
     SET is_undone = TRUE
     WHERE id = p_batch_id;

     RETURN jsonb_build_object(
       'reverted', v_reverted,
       'batch_id', p_batch_id
     );
   END;
   $$ LANGUAGE plpgsql;
   ```

5. **Implement `fn_handle_pending_handover()`:**

   ```sql
   CREATE OR REPLACE FUNCTION fn_handle_pending_handover()
   RETURNS TRIGGER AS $$
   DECLARE
     v_pending_record RECORD;
   BEGIN
     -- Check if this posted transaction has a pending_transaction_id that matches an existing pending record
     IF NEW.pending_transaction_id IS NOT NULL THEN
       SELECT * INTO v_pending_record
       FROM transactions
       WHERE plaid_transaction_id = NEW.pending_transaction_id
         AND status = 'pending'
       LIMIT 1;

       IF FOUND THEN
         -- Copy user categorization from pending to posted
         NEW.category_id := COALESCE(v_pending_record.category_id, NEW.category_id);
         NEW.category_locked := COALESCE(v_pending_record.category_locked, FALSE);
         NEW.category_source := COALESCE(v_pending_record.category_source, NEW.category_source);
         NEW.notes := COALESCE(v_pending_record.notes, NEW.notes);

         -- Log the handover
         INSERT INTO category_audit_log (transaction_id, previous_category_id, new_category_id, change_source, created_at)
         VALUES (NEW.id, NULL, NEW.category_id, 'pending_handover', NOW());

         -- Delete the old pending record
         DELETE FROM transactions WHERE id = v_pending_record.id;
       END IF;
     END IF;

     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;

   -- Create trigger
   CREATE TRIGGER trg_handle_pending_handover
   BEFORE INSERT ON transactions
   FOR EACH ROW
   EXECUTE FUNCTION fn_handle_pending_handover();
   ```

6. Add `is_reverted` column to `category_audit_log` if not present:
   - `is_reverted` (boolean, default false)

7. Add `applied_rule_id` column to `transactions` if not present:
   - `applied_rule_id` (UUID, FK to categorization_rules, nullable)

8. Add `description_clean` column to `transactions` if not present:
   - `description_clean` (text) – normalized merchant name for matching.

9. Create migration file at `supabase/migrations/YYYYMMDD_stored_procedures.sql` with all functions.

10. Write tests:
    - `fn_run_categorization_waterfall`: verify priority ordering, locked skipping, statistics accuracy.
    - `fn_undo_batch`: verify all transactions reverted, audit log marked, batch marked undone.
    - `fn_handle_pending_handover`: verify categorization copied, pending deleted.

11. Document in `docs/categorization/stored_procedures.md`.
