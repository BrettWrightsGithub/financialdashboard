# n8n Workflow 2: Plaid Data Sync (AFCU)

**Purpose:** Sync specific AFCU data via Plaid. Plaid requires separate calls for Balance and Transactions.

## Prerequisites
- **Supabase Credential:** Connection to your Supabase project.
- **Plaid API Credential:** You can use n8n's "Generic Credential" to store `client_id` and `secret`, then reference them in the body, or just use environment variables.

## Node Configuration

### Node 1: Schedule Trigger
- **Type:** Schedule
- **Settings:** Run every 6-12 hours.

### Node 2: HTTP Request (Get Balance)
- **Type:** HTTP Request
- **Method:** POST
- **URL:** `https://production.plaid.com/accounts/balance/get`
- **Body:**
  ```json
  {
    "client_id": "{{ $env.PLAID_CLIENT_ID }}",
    "secret": "{{ $env.PLAID_SECRET }}",
    "access_token": "access-production-..."
  }
  ```
- **Output:** Account objects with current balances.

### Node 3: Supabase (Upsert Accounts)
- **Type:** Supabase
- **Operation:** Upsert
- **Table:** `accounts`
- **Match Columns:** `provider_account_id`
- **Input Mapping:**
  - `provider`: "plaid"
  - `provider_account_id`: `{{ $json.account_id }}`
  - `current_balance`: `{{ $json.balances.current }}`

### Node 4: HTTP Request (Get Transactions)
- **Type:** HTTP Request
- **Method:** POST
- **URL:** `https://production.plaid.com/transactions/sync`
- **Body:** `{ "client_id": "...", "secret": "...", "access_token": "..." }`
- **Output:** List of added/modified transactions.

### Node 5: Supabase (Upsert Transactions)
- **Type:** Supabase
- **Operation:** Upsert
- **Table:** `transactions`
- **Match Columns:** `provider_transaction_id`
- **Input Mapping:**
  - `provider`: "plaid"
  - `provider_transaction_id`: `{{ $json.transaction_id }}`
  - `amount`: `{{ $json.amount * -1 }}` (Plaid often reverses signs, verify this!)
  - `description_raw`: `{{ $json.name }}`
