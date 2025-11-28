# n8n Workflow 1: Teller Data Sync (Chase/External Banks)

**Purpose:** Periodically fetch account balances and transactions from Teller and sync them to Supabase.

## Prerequisites
- **Supabase Credential:** Connection to your Supabase project.
- **Teller API Credential:** Use **Basic Auth**.
  - **Username:** Your Teller Access Token.
  - **Password:** Leave empty.

## Node Configuration

### Node 1: Schedule Trigger
- **Type:** Schedule
- **Settings:** Run every 4 hours (or desired interval).
- **Purpose:** Initiates the sync process automatically.

### Node 2: HTTP Request (Get Accounts)
- **Type:** HTTP Request
- **Method:** GET
- **URL:** `https://api.teller.io/accounts`
- **Authentication:** Predefined Credential Type -> Basic Auth
- **Credential:** Select your Teller credential.
- **Options:**
  - Click **Add Option** -> **SSL/TLS**.
  - **Certificate File:** `/certs/teller-certificate.pem`
  - **Key File:** `/certs/teller-key.pem`
  - **Passphrase:** (Leave empty)
  - **Certificate Authority File:** (Leave empty)
- **Output:** JSON array of accounts.

### Node 3: Supabase (Upsert Accounts)
- **Type:** Supabase
- **Operation:** Upsert
- **Table:** `accounts`
- **Match Columns:** `provider_account_id`
- **Input Mapping:**
  - `provider`: "teller"
  - `provider_account_id`: `{{ $json.id }}`
  - `name`: `{{ $json.name }}`
  - `ledger_balance`: `{{ $json.balance.ledger }}`
  - `available_balance`: `{{ $json.balance.available }}`
  - `institution_name`: `{{ $json.institution.name }}`

### Options:**
  - Click **Add Option** -> **SSL/TLS**.
  - **Certificate File:** `/certs/teller-certificate.pem`
  - **Key File:** `/certs/teller-key.pem`
- **Node 4: HTTP Request (Get Transactions)
- **Type:** HTTP Request
- **Method:** GET
- **URL:** `https://api.teller.io/accounts/{{ $json.id }}/transactions`
- **Authentication:** Predefined Credential Type -> Basic Auth
- **Credential:** Select your Teller credential.
- **Note:** This node needs to run *for each* account found in Node 2.
- **Output:** JSON array of transactions.

### Node 5: Supabase (Upsert Transactions)
- **Type:** Supabase
- **Operation:** Upsert
- **Table:** `transactions`
- **Match Columns:** `provider_transaction_id`
- **Input Mapping:**
  - `provider`: "teller"
  - `provider_transaction_id`: `{{ $json.id }}`
  - `account_id`: (Lookup from `accounts` table using `account_id` from Teller)
  - `amount`: `{{ $json.amount }}` (Ensure sign is normalized: - for outflow, + for inflow)
  - `date`: `{{ $json.date }}`
  - `description_raw`: `{{ $json.description }}`
  - `processing_status`: `{{ $json.details.processing_status }}`
