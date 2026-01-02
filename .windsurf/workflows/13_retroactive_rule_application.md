---
description: Implement retroactive rule application with dry-run preview and undo capability per `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` (FR-15, FR-16, TI-04).
auto_execution_mode: 1
---

## Architecture Note

Per Section L of the MVP plan:
- **Undo requires ACID transactions** – only the database can guarantee all-or-nothing updates.
- The **`fn_undo_batch(target_batch_id UUID)`** stored procedure handles batch reversal.
- Retroactive application uses **`fn_run_categorization_waterfall`** for bulk updates.
- The Next.js app provides UI; actual logic runs in Supabase.

## Steps

1. Re-read:
   - `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` (FR-15, FR-16, TI-04, A11, Section L)

2. Create `rule_application_batches` table:
   - `id` (UUID, primary key)
   - `rule_id` (UUID, FK to categorization_rules, nullable for full waterfall runs)
   - `applied_at` timestamp
   - `transaction_count` (integer)
   - `date_range_start`, `date_range_end` (date, nullable)
   - `is_undone` (boolean, default false)

3. Add migration for batch tracking table.

4. **Implement `fn_undo_batch(target_batch_id UUID)` stored procedure** (see workflow 14):
   - Reverts all transactions with this `batch_id` to their previous state.
   - Uses `category_audit_log` to find previous category values.
   - Marks audit log entries as "Reverted".
   - Sets `is_undone = TRUE` on the batch record.
   - All operations in a single transaction (ACID).

5. Create thin TypeScript wrappers in `lib/categorization/retroactiveRules.ts`:
   - `previewRuleApplication(ruleId: string, dateRange?: { start: Date, end: Date }): Promise<PreviewResult>`
     - Queries transactions that WOULD match the rule (client-side simulation).
     - Does NOT modify any data.
   - `applyRuleRetroactively(ruleId: string, transactionIds: string[]): Promise<ApplyResult>`
     - Creates a batch record.
     - Calls `fn_run_categorization_waterfall(batch_id, transaction_ids)` via RPC.
     - Returns statistics.
   - `undoBatch(batchId: string): Promise<void>`
     - Calls `fn_undo_batch(batch_id)` via RPC.

6. Add API routes:
   - `app/api/rules/preview/route.ts` – POST: returns preview of rule application.
   - `app/api/rules/apply-retroactive/route.ts` – POST: creates batch and calls stored procedure.
   - `app/api/rules/undo-batch/route.ts` – POST: calls `fn_undo_batch` stored procedure.

7. Update admin rules page with retroactive application UI:
   - "Apply to Past Transactions" button on each rule.
   - Opens modal with:
     - Date range selector (optional).
     - "Preview" button showing affected transactions.
     - "Apply" button (disabled until preview run).
     - Warning about number of transactions to be changed.

8. Create batch history view at `app/(routes)/admin/rules/batches/page.tsx`:
   - Lists all retroactive applications.
   - Shows: rule name, date applied, transaction count, undo button.
   - Undo button only available if `is_undone = FALSE`.

9. Ensure idempotency in stored procedure:
   - Running the same rule twice on same transactions should not create duplicate changes.
   - Check if transaction already has the target category before applying.

10. Write tests:
    - Preview returns correct transactions without modifying data.
    - Apply respects `category_locked`.
    - `fn_undo_batch` restores previous categories correctly.
    - Idempotent: re-running doesn't duplicate changes.
    - ACID: partial failures roll back entirely.

11. Document in `docs/categorization/retroactive_rules.md`.
