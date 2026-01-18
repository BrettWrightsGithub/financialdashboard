# Plaid Sync Workflow Architecture

This document details the logic flow for synchronizing Plaid transactions via N8n.

## The "Conductor" Pattern

We use N8n as the "Conductor" to keep the Next.js app focused on UI and Supabase focused on data integrity. N8n handles the messy external API integrations and async processing.

## Workflow: Plaid Transaction Sync

**Trigger:** `POST /webhook/plaid-sync`
*   Payload: Plaid `SYNC_UPDATES_AVAILABLE` webhook body.

### Steps

1.  **Extract Context:**
    *   Gets `item_id` and `webhook_code` from the payload.
    *   Look up the corresponding `account_id` and `access_token` from Supabase `accounts` table.

2.  **Fetch Transactions (Plaid API):**
    *   Call `/transactions/sync` using the stored `cursor`.
    *   Receives: `added`, `modified`, `removed`, `next_cursor`.

3.  **Process "Added" Transactions:**
    *   **Transform:** Map Plaid JSON to Supabase schema:
        *   `amount`: Invert sign if necessary (Plaid: + is outflow, App: - is outflow).
        *   `category`: Map `personal_finance_category.primary` to `plaid_category_id`.
    *   **Insert:** Bulk insert into `transactions` table.
    *   **Conflict:** Use `ON CONFLICT (provider_transaction_id) DO NOTHING`.

4.  **Process "Modified" Transactions:**
    *   Update fields in `transactions` table where `provider_transaction_id` matches.
    *   **Safety:** Do not overwrite user-locked categories (`category_locked = true`).

5.  **Process "Removed" Transactions:**
    *   Soft-delete transactions (`status = 'removed'`) to maintain audit trails.

6.  **Update State:**
    *   Update `accounts` table with the new `cursor`.

7.  **Trigger Categorization:**
    *   Call the Supabase RPC `fn_run_categorization_waterfall` with the IDs of the newly inserted transactions.
    *   This applies User Rules -> Payee Memory -> Plaid Defaults.

## Workflow: Manual Sync

**Trigger:** `POST /webhook/trigger-sync`
*   Payload: `{ "account_id": "..." }`

### Steps

1.  **Lookup:** Fetch `access_token` and `cursor` for the specified account from Supabase.
2.  **Delegate:** Call the **Plaid Transaction Sync** workflow (via HTTP Request) with the fetched credentials.
    *   This reuses the exact same logic as the webhook-triggered flow.
