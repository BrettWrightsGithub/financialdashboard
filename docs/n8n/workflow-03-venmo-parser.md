# n8n Workflow 3: Gmail Venmo Parser

**Purpose:** Parse "You were paid" emails from Venmo to track rent and T-Mobile reimbursements.

## Prerequisites
- **Supabase Credential:** Connection to your Supabase project.
- **Gmail (OAuth2):** Connection to read your emails.

## Node Configuration

### Node 1: Gmail Trigger
- **Type:** Gmail Trigger
- **Event:** Message Received
- **Filters:** Label = `venmo-payment` (Create this label in Gmail for Venmo emails).
- **Output:** Email subject and body snippet.

### Node 2: Code Node (Regex Parser)
- **Type:** Code (JavaScript)
- **Purpose:** Extract Payer Name and Amount from Subject.
- **Code Logic:**
  - Regex: `/(.+) paid you \$((\d{1,3}(,\d{3})*|(\d+))(\.\d{2})?)/`
  - **Input:** `Subject: "Stephani Walker paid you $60.00"`
  - **Output:** `{ "payer": "Stephani Walker", "amount": 60.00 }`

### Node 3: Supabase (Lookup Counterparty)
- **Type:** Supabase
- **Operation:** Get Many
- **Table:** `counterparties`
- **Filter:** `name` ILIKE `{{ $json.payer }}` OR `venmo_username` ILIKE `{{ $json.payer }}`
- **Purpose:** Identify if this is a Tenant or T-Mobile family member.

### Node 4: Code Node (Category Logic)
- **Type:** Code (JavaScript)
- **Purpose:** Assign category based on Counterparty Type.
- **Logic:**
  - If `type` == 'tenant' AND text contains 'rent' -> `Home Rental Income`
  - If `type` == 'tmobile_family' -> `Reimbursable` (is_pass_through = true)
  - Else -> `Transfer` (default)

### Node 5: Supabase (Insert Transaction)
- **Type:** Supabase
- **Operation:** Insert
- **Table:** `transactions`
- **Input Mapping:**
  - `provider`: "gmail_venmo"
  - `provider_transaction_id`: `{{ $node["Gmail Trigger"].json.messageId }}`
  - `description_raw`: `{{ $node["Gmail Trigger"].json.subject }}`
  - `amount`: `{{ $json.amount }}`
  - `date`: `{{ $now }}`
  - `counterparty_id`: `{{ $json.counterparty_id }}`
