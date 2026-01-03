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

### Node 5: Code Node (Transform Transactions)
- **Type:** Code (JavaScript)
- **Purpose:** Transform Plaid transaction data and extract category information
- **Key Transformations:**
  - Negate amounts (convert from Plaid convention to standard)
  - Extract AI category suggestions from Plaid's enrichment data
  - Map confidence levels to numeric scores
  - Deduplicate transactions
- **See:** "Transaction Transformation Logic" section below

### Node 6: Supabase (Upsert Transactions)
- **Type:** HTTP Request to Supabase REST API
- **Method:** POST
- **URL:** `https://YOUR_PROJECT.supabase.co/rest/v1/transactions`
- **Query Parameters:**
  - `on_conflict`: `provider,provider_transaction_id`
  - `select`: `id,provider,provider_transaction_id,account_id,date,amount,status`
- **Headers:**
  - `Prefer`: `resolution=merge-duplicates, return=representation`
- **Body:** `{{ $json.transactionsToUpsert }}`
- **Input Mapping:**
  - `provider`: "plaid"
  - `provider_transaction_id`: `{{ $json.transaction_id }}`
  - `amount`: Negated amount (See "Plaid Amount Sign Convention" below)
  - `description_raw`: `{{ $json.original_description }}`
  - `description_clean`: `{{ $json.name }}`
  - `category_ai`: Plaid category suggestion
  - `category_ai_conf`: Confidence score (0-100)

## Plaid Amount Sign Convention

**IMPORTANT:** Plaid uses a different sign convention than standard financial applications:

### Plaid Convention
- **Positive values** = Money moving OUT of the account (expenses, purchases, debits)
- **Negative values** = Money moving INTO the account (income, deposits, refunds, credits)

### Standard Financial Convention
- **Positive values** = Money moving INTO the account (income, deposits)
- **Negative values** = Money moving OUT of the account (expenses, purchases)

### Examples from Plaid API
| Transaction Type | Plaid Amount | After Negation | Display |
|-----------------|--------------|----------------|---------|
| Payroll deposit | -6385.28 | +6385.28 | +$6,385.28 |
| Credit card purchase | +25.50 | -25.50 | -$25.50 |
| Refund | -15.00 | +15.00 | +$15.00 |
| Bank fee | +5.00 | -5.00 | -$5.00 |

### Solution
**Always multiply the Plaid amount by -1** when storing in your database:

```javascript
const amount = (typeof t.amount === 'number') ? -t.amount : -Number(t.amount);
```

This converts Plaid's convention to the standard convention used by most financial applications.

### Reference
From Plaid API documentation:
> **amount** (number) - The settled value of the transaction, denominated in the transaction's currency. Positive values when money moves out of the account; negative values when money moves in. For example, credit card purchases are positive; credit card payment, direct deposits, and refunds are negative.

## Transaction Transformation Logic

The `transactionTransform` code node performs critical data transformations before upserting to Supabase:

### Amount Negation
```javascript
// CRITICAL FIX: Negate Plaid amount to convert to standard convention
const amount = (typeof t.amount === 'number') ? -t.amount : -Number(t.amount);
```

### Plaid Category Enrichment

Plaid provides AI-powered category suggestions through their enrichment service. The workflow extracts these categories to populate `category_ai` and `category_ai_conf` fields:

#### Category Extraction
```javascript
const category_ai = 
  t.personal_finance_category?.detailed ??
  t.personal_finance_category?.primary ??
  (Array.isArray(t.category) ? t.category.join(' > ') : null);
```

**Priority Order:**
1. **Detailed category** (most specific) - e.g., "FOOD_AND_DRINK_COFFEE"
2. **Primary category** (broader) - e.g., "FOOD_AND_DRINK"
3. **Legacy category array** (fallback) - e.g., ["Food and Drink", "Restaurants", "Coffee Shop"]

#### Confidence Score Mapping
```javascript
const confidenceMap = {
  'VERY_HIGH': 95,
  'HIGH': 85,
  'MEDIUM': 70,
  'LOW': 50
};
const category_ai_conf = 
  confidenceMap[t.personal_finance_category?.confidence_level] ?? 
  (Array.isArray(t.category) ? 60 : null);
```

### Example Plaid Category Data

**Modern Enrichment (personal_finance_category):**
```json
{
  "personal_finance_category": {
    "primary": "FOOD_AND_DRINK",
    "detailed": "FOOD_AND_DRINK_COFFEE",
    "confidence_level": "VERY_HIGH"
  }
}
```
- Extracted `category_ai`: "FOOD_AND_DRINK_COFFEE"
- Extracted `category_ai_conf`: 95

**Legacy Category Array:**
```json
{
  "category": ["Food and Drink", "Restaurants", "Coffee Shop"]
}
```
- Extracted `category_ai`: "Food and Drink > Restaurants > Coffee Shop"
- Extracted `category_ai_conf`: 60 (default for legacy)

### Benefits
- **Seed data for categorization rules:** Use high-confidence Plaid categories to train your rule engine
- **Fallback categorization:** When user rules don't match, fall back to Plaid's suggestion
- **Quality filtering:** Filter by confidence score to only use reliable suggestions
- **Category analysis:** Identify spending patterns across Plaid's standardized taxonomy

### Complete Transformation Code
See the `transactionTransform` node in `workflow-plaid.json` for the complete implementation.
