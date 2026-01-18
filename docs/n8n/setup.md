# N8n Setup Guide

This guide explains how to set up N8n for orchestrating the Financial Command Center's data sync and categorization workflows.

## Prerequisites

1.  **N8n Instance:** Self-hosted or Cloud.
    *   Docker: `docker run -it --rm --name n8n -p 5678:5678 -v ~/.n8n:/home/node/.n8n n8nio/n8n`
2.  **Supabase Project:** URL and Service Role Key.
3.  **Plaid Credentials:** Client ID and Secret (Sandbox or Production).

## Workflow Import

The workflows are stored in `n8n/workflows/` as JSON files. To import them:

1.  Open your N8n dashboard (usually `http://localhost:5678`).
2.  Click **Workflows** -> **Import from File**.
3.  Select the JSON files from the `n8n/workflows/` directory in this repo:
    *   `plaid_transaction_sync.json`
    *   `manual_sync_trigger.json`
    *   `retroactive_rule_application.json`

## Credential Configuration

You need to set up the following credentials in N8n:

### 1. Supabase (Postgres)
*   **Type:** Postgres
*   **Host:** `db.<your-project-ref>.supabase.co`
*   **Database:** `postgres`
*   **User:** `postgres`
*   **Password:** Your project password
*   **Port:** 5432
*   **SSL:** On

*Note: For the Supabase node type, you might use the API-based credential:*
*   **Type:** Supabase API
*   **URL:** `https://<your-project-ref>.supabase.co`
*   **Key:** Service Role Key (Required for RLS bypass/admin tasks)

### 2. Plaid API
*   **Type:** Generic Header Auth (or dedicated Plaid node if available)
*   **Header Name:** `PLAID-CLIENT-ID` & `PLAID-SECRET`
*   **Note:** The workflows use variables for these credentials. Ensure they are mapped correctly or updated in the HTTP Request nodes.

## Environment Variables

Ensure your Next.js application has the following in `.env.local`:

```bash
N8N_WEBHOOK_URL=http://localhost:5678/webhook
```

## Testing

1.  **Manual Trigger:**
    *   Send a POST request to your N8n webhook URL:
        ```bash
        curl -X POST http://localhost:5678/webhook/trigger-sync -d '{"account_id": "test_account_id"}'
        ```
    *   Verify the workflow executes in the N8n UI.

2.  **Plaid Sync:**
    *   In Sandbox mode, fire a webhook simulation from the Plaid Dashboard.
    *   Verify transactions appear in your Supabase `transactions` table.
