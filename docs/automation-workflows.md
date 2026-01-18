# Automation Workflows (n8n)

This system relies on **n8n** for data ingestion, normalization, and initial processing. The workflows run in a self-hosted Docker environment.

---

## 1. Teller Data Sync (`workflow-01-teller-sync`)
**Purpose:** Syncs account balances and transactions from Teller (Chase, etc.) to Supabase.

- **Trigger:** Schedule (Every 4 hours).
- **Inputs:**
    - Teller Access Token (Basic Auth).
    - `docs/n8n/certs/` (SSL Certificates for Teller API).
- **Outputs:** None (Side-effect only).
- **Side Effects:**
    - **Upsert `accounts`:** Updates ledger/available balance.
    - **Upsert `transactions`:** Inserts new transactions or updates existing ones.
- **Failure Modes:**
    - **Invalid Certs:** API calls fail if mTLS certificates are missing/expired.
    - **Schema Mismatch:** If Teller changes API response, mapping nodes fail.
    - **Auth Failure:** Token expiry (requires manual re-auth).

## 2. Plaid Data Sync (`workflow-02-plaid-sync`)
**Purpose:** Syncs account balances and transactions from Plaid (AFCU) to Supabase using cursor-based pagination.

- **Trigger:**
    - **Primary:** Schedule (Every 6-12 hours).
    - **Secondary:** Webhook (`plaid-listen-sync`) for manual/immediate sync.
- **Inputs:**
    - `PLAID_CLIENT_ID`, `PLAID_SECRET`.
    - `access_token` (Stored in n8n or passed via webhook).
- **Outputs:** None (Side-effect only).
- **Side Effects:**
    - **Upsert `accounts`:** Updates current/available balances.
    - **Upsert `transactions`:** Inserts new transactions (with AI category from Plaid).
    - **Sign Normalization:** Negates Plaid amounts (Positive -> Negative) to match system convention.
- **Failure Modes:**
    - **Cursor Desync:** If Plaid resets cursor, might re-fetch historical data (handled by upsert idempotency).
    - **Rate Limits:** Plaid production API limits (100 req/min).

## 3. Gmail Venmo Parser (`workflow-03-venmo-parser`)
**Purpose:** Parses "You were paid" emails to capture rent and reimbursement flows that banking APIs miss or label generically.

- **Trigger:** Gmail Trigger (On Email Received).
- **Filter:** Label = `venmo-payment`.
- **Inputs:** Email Subject & Body.
- **Outputs:** Parsed Transaction Object (`payer`, `amount`).
- **Side Effects:**
    - **Read `counterparties`:** Look up Tenant/Family IDs by name.
    - **Insert `transactions`:** Creates a new transaction record with provider `gmail_venmo`.
- **Failure Modes:**
    - **Regex Failure:** Venmo changes email subject format (e.g., "paid you" -> "sent you").
    - **Unknown Payer:** If payer name isn't in `counterparties`, defaults to generic Transfer or requires manual fix.

## 4. AI Transaction Categorizer (`workflow-04-ai-categorizer`)
**Status:** **Design / Planned** (Implementation file `.json` is missing from repo).
**Purpose:** The "Brain" that assigns categories to uncategorized transactions using LLMs.

-   **Trigger:** Schedule (Hourly) or Webhook.
-   **Inputs:**
    -   Uncategorized transactions (`life_category_id` IS NULL).
    -   Recent user overrides (Few-shot examples).
-   **Outputs:** JSON Classification (`category_name`, `is_pass_through`, etc.).
-   **Side Effects:**
    -   **Update `transactions`:** Sets `life_category_id`, `category_ai_conf`.
-   **Failure Modes:**
    -   **Hallucination:** LLM invents a category not in the database (Validation node catches this).
    -   **Cost:** High volume of transactions could spike OpenAI API costs.
-   **Evidence:** Documented in `docs/n8n/workflow-04-ai-categorizer.md` and `docs/ai/transaction_categorizer_v1.md`.

---

## Interactions & Idempotency

### Interactions
- **Sequential Flow:** Ingestion (Workflows 1-3) runs independently. The Categorizer (Workflow 4) runs afterwards to process the raw data they inserted.
- **Data Dependency:** Venmo Parser relies on `counterparties` table being populated manually in Supabase.

### Idempotency
- **Ingestion:** Strictly Idempotent. All writes use **Upsert** (Postgres `ON CONFLICT DO UPDATE`) keyed by `provider_transaction_id` + `provider`. Re-running a sync is safe.
- **Categorization:** Idempotent. It only selects transactions where `life_category_id IS NULL` and `category_locked IS FALSE`. Once processed, they are filtered out of the next run.

### Retry Behavior
- **n8n Default:** Workflows typically stop on error.
- **Recovery:** Since writes are idempotent, the standard recovery is simply to wait for the next scheduled run or manually trigger the workflow. No complex rollback logic is described in the n8n layer (rollback is handled within DB for batch operations, but not for ingestion).
