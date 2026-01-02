---
description: Set up N8n workflows (The Conductor) for Plaid sync orchestration and categorization triggers per `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` (Section L).
auto_execution_mode: 1
---

## Architecture Context

Per Section L of the MVP plan, N8n is "The Conductor" that:
- Listens for Plaid webhooks
- Fetches raw JSON from Plaid API
- Inserts data into Supabase
- Triggers stored procedures for categorization
- Sends notifications (Slack, email)

**Rationale:**
- N8n handles external API orchestration and async workflows.
- Business logic stays in Supabase stored procedures for performance and ACID guarantees.

## Steps

1. Re-read:
   - `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` (Section L)
   - Plaid `/transactions/sync` API documentation

2. **Set up N8n environment:**
   - Ensure N8n is running (self-hosted or cloud).
   - Configure credentials:
     - Plaid API credentials (client_id, secret).
     - Supabase credentials (URL, service role key).
     - Slack webhook URL (optional, for notifications).

3. **Create N8n Workflow: Plaid Transaction Sync**

   **Trigger:** Webhook node
   - Path: `/plaid-sync`
   - Method: POST
   - Receives Plaid `SYNC_UPDATES_AVAILABLE` webhook.

   **Step 1:** Extract account/item info from webhook payload.

   **Step 2:** HTTP Request node – Call Plaid `/transactions/sync`
   - Method: POST
   - URL: `https://production.plaid.com/transactions/sync` (or sandbox)
   - Body:
     ```json
     {
       "client_id": "{{$credentials.plaid.client_id}}",
       "secret": "{{$credentials.plaid.secret}}",
       "access_token": "{{$json.access_token}}",
       "cursor": "{{$json.cursor}}"
     }
     ```
   - Store response: `added`, `modified`, `removed`, `next_cursor`.

   **Step 3:** Loop over `added` transactions – Supabase node (Insert)
   - Table: `transactions`
   - Map Plaid fields to columns:
     - `plaid_transaction_id` ← `transaction_id`
     - `pending_transaction_id` ← `pending_transaction_id`
     - `account_id` ← lookup from `plaid_account_id`
     - `amount` ← `amount` (negate if needed for your sign convention)
     - `date` ← `date`
     - `description` ← `name`
     - `description_clean` ← normalized `merchant_name` or `name`
     - `plaid_category_id` ← map from `personal_finance_category`
     - `plaid_confidence` ← `personal_finance_category.confidence_level`
     - `status` ← `pending` if pending, else `posted`
   - Use UPSERT on `plaid_transaction_id` to handle duplicates.

   **Step 4:** Loop over `modified` transactions – Supabase node (Update)
   - Update existing records by `plaid_transaction_id`.
   - Only update non-locked fields.

   **Step 5:** Loop over `removed` transactions – Supabase node (Update)
   - Soft delete: set `status = 'removed'` or `is_deleted = TRUE`.

   **Step 6:** Supabase node – Update cursor
   - Table: `sync_state`
   - Update `cursor` and `last_sync_at` for the account.

   **Step 7:** Supabase node – Execute SQL (RPC)
   - Call `fn_run_categorization_waterfall`:
     ```sql
     SELECT fn_run_categorization_waterfall(
       '{{$json.batch_id}}'::UUID,
       ARRAY[{{$json.new_transaction_ids}}]::UUID[]
     );
     ```
   - Capture result statistics.

   **Step 8:** Slack node (optional) – Send notification
   - Message: "Imported {{added.length}} txns, Auto-categorized {{stats.rules_applied + stats.memory_applied + stats.plaid_applied}}."

4. **Create N8n Workflow: Manual Sync Trigger**

   **Trigger:** Webhook node
   - Path: `/trigger-sync`
   - Method: POST
   - Body: `{ "account_id": "..." }` or empty for all accounts.

   **Steps:** Same as above, but triggered manually from the Next.js app.

5. **Create N8n Workflow: Retroactive Rule Application**

   **Trigger:** Webhook node
   - Path: `/apply-rules-retroactive`
   - Method: POST
   - Body: `{ "batch_id": "...", "transaction_ids": [...] }`

   **Step 1:** Supabase node – Execute SQL (RPC)
   - Call `fn_run_categorization_waterfall(batch_id, transaction_ids)`.

   **Step 2:** Return result to caller.

6. **Configure Plaid Webhooks:**
   - In Plaid Dashboard, set webhook URL to your N8n webhook endpoint.
   - Events to listen for:
     - `SYNC_UPDATES_AVAILABLE`
     - `TRANSACTIONS_REMOVED` (optional)

7. **Document N8n workflow exports:**
   - Export workflows as JSON to `n8n/workflows/` folder.
   - Include setup instructions in `docs/n8n/setup.md`.

8. **Create Next.js integration for manual triggers:**
   - `lib/n8n/triggerSync.ts`:
     ```typescript
     export async function triggerPlaidSync(accountId?: string) {
       const response = await fetch(process.env.N8N_WEBHOOK_URL + '/trigger-sync', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ account_id: accountId }),
       });
       return response.json();
     }
     ```

9. **Environment variables needed:**
   - `N8N_WEBHOOK_URL` – Base URL for N8n webhooks.
   - `PLAID_CLIENT_ID`, `PLAID_SECRET` – Plaid credentials (in N8n).
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` – Supabase credentials (in N8n).
   - `SLACK_WEBHOOK_URL` – Optional, for notifications.

10. Write tests:
    - Mock Plaid webhook payload, verify transactions inserted.
    - Verify cursor updated after sync.
    - Verify `fn_run_categorization_waterfall` called with correct IDs.

11. Document in `docs/n8n/plaid_sync_workflow.md`.
