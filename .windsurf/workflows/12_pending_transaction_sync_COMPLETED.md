---
description: Implement pending transaction ID tracking and cursor-based sync to preserve user categorizations across pending→posted transitions per `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` (TI-01, TI-02).
auto_execution_mode: 1
status: COMPLETED
completed_date: 2026-01-02
---

## Completion Summary

**Done:** Implemented pending transaction sync and handover logic.

- Created `sync_state` table in migration - cursor tracking per account/connection
- Created `fn_handle_pending_handover()` stored procedure - preserves user categorizations
- Created trigger `trg_handle_pending_handover` - fires on transaction INSERT
- Created `lib/sync/plaidSync.ts` - Status queries, sync trigger wrapper
- Created `app/api/sync/trigger/route.ts` - Manual sync trigger and status API
- Created `docs/sync/plaid_sync.md` - Documentation

**Note:** N8n handles actual Plaid API calls. Next.js provides UI and triggers.

## Testing Reference

Follow `docs/testing/testing_strategy.md` for all testing requirements:
- **Unit tests:** Pending→posted matching logic, category preservation
- **Integration tests:** Stored procedure `fn_handle_pending_handover()` behavior
- **E2E tests:** Simulate pending transaction, categorize it, verify category preserved when posted

## Architecture Note

Per Section L of the MVP plan:
- **N8n** handles webhook listening, Plaid API calls, and raw data insertion (The Conductor).
- **Supabase stored procedure `fn_handle_pending_handover()`** handles the pending→posted transition logic (The Engine).
- The Next.js app provides UI for manual sync triggers and status display.

## Steps

1. Re-read:
   - `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` (TI-01, TI-02, Section L)

2. Ensure `transactions` table has:
   - `pending_transaction_id` (text, nullable) – Plaid's pending transaction ID.
   - `plaid_transaction_id` (text, unique) – Plaid's posted transaction ID.
   - `sync_cursor` stored separately for incremental sync.

3. Create `sync_state` table (if not exists):
   - `id` (UUID, primary key)
   - `account_id` (UUID, FK to accounts)
   - `cursor` (text) – Plaid's cursor for `/transactions/sync`.
   - `last_sync_at` timestamp

4. Add migrations for new columns/tables.

5. **Implement `fn_handle_pending_handover()` stored procedure** (see workflow 14):
   - Triggered on INSERT to `transactions` table.
   - Checks if new transaction's `pending_transaction_id` matches an existing pending record.
   - If match: copies `category_id`, `category_locked`, `category_source`, `notes` from pending to posted.
   - Deletes or archives the old pending record.
   - Logs the transition in audit log.

6. Create trigger in Supabase:
   ```sql
   CREATE TRIGGER trg_handle_pending_handover
   AFTER INSERT ON transactions
   FOR EACH ROW
   EXECUTE FUNCTION fn_handle_pending_handover();
   ```

7. **N8n handles the sync orchestration** (see workflow 15):
   - Webhook receives Plaid `SYNC_UPDATES_AVAILABLE`.
   - Calls Plaid `/transactions/sync` with cursor.
   - Upserts raw transactions to Supabase.
   - The trigger automatically handles pending→posted transitions.

8. Create thin TypeScript wrapper in `lib/sync/plaidSync.ts`:
   - `getSyncStatus(accountId: string): Promise<SyncState>`
   - `getLastSyncTime(): Promise<Date>`
   - For manual sync trigger, call N8n webhook endpoint.

9. Add API route `app/api/sync/trigger/route.ts`:
   - POST: Triggers N8n sync workflow via webhook.
   - Returns acknowledgment (sync runs async).

10. Add sync status indicator to Dashboard or Transactions page:
    - Shows last sync time from `sync_state` table.
    - "Sync Now" button triggers N8n workflow.

11. Write tests:
    - Pending→posted transition preserves user categorization (test the stored procedure).
    - Trigger fires correctly on INSERT.
    - Removed transactions are handled gracefully (soft delete or archive).

12. Document in `docs/sync/plaid_sync.md`.

13. **Puppeteer Verification:** Use the Puppeteer MCP server to:
    - Navigate to http://localhost:3000/transactions or dashboard
    - Take a screenshot showing sync status indicator
    - Test "Sync Now" button triggers sync
    - Verify last sync time updates after sync completes
