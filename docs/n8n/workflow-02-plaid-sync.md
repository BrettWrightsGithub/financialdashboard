# n8n Workflow 2: Plaid Data Sync (AFCU)

**Purpose:** Sync account balances and transactions from Plaid to Supabase. This workflow handles both scheduled syncs and webhook-triggered updates, with proper data transformation and deduplication.

## Overview
- **Triggers:** Schedule (every 6-12 hours) OR Webhook (manual/manual sync)
- **Source:** Plaid API (production environment)
- **Target:** Supabase database (accounts and transactions tables)
- **Key Features:** Amount sign normalization, AI category extraction, deduplication, error handling

## Prerequisites
- **Supabase Credential:** HTTP connection with API key to your Supabase project
- **Plaid API Credentials:** Environment variables for `PLAID_CLIENT_ID` and `PLAID_SECRET`
- **Access Token:** Plaid access token for the target account (stored in workflow or passed via webhook)

## Node Configuration

### Trigger Nodes (Either/Or)

#### Node 1: Schedule Trigger
- **Type:** Schedule
- **Settings:** Run every 6-12 hours
- **Position:** [-608, 1424]

#### Node 2: Webhook Trigger
- **Type:** Webhook
- **Path:** `plaid-listen-sync`
- **Method:** POST
- **Purpose:** Manual sync trigger (receives access_token and account_id)
- **Position:** [-608, 1632]

### Core Processing Nodes

#### Node 3: Workflow Configuration
- **Type:** Set
- **Purpose:** Extract and configure workflow variables from webhook/schedule
- **Key Assignments:**
  - `plaidClientId`: `{{ $env.PLAID_CLIENT_ID }}`
  - `plaidSecret`: `{{ $env.PLAID_SECRET }}`
  - `plaidAccessToken`: `{{ $json.access_token }}`
  - `accountId`: `{{ $json.account_id }}`
- **Position:** [-352, 1536]

#### Node 4: Split in Batches (Loop Over Items)
- **Type:** Split in Batches
- **Purpose:** Process multiple accounts if provided
- **Batch Size:** 1 (default)
- **Position:** [64, 1536]

#### Node 5: HTTP Request (Get Provider Data)
- **Type:** HTTP Request
- **Method:** POST
- **URL:** `https://production.plaid.com/accounts/get`
- **Body:**
  ```json
  {
    "client_id": "{{ $json.plaidClientId }}",
    "secret": "{{ $json.plaidSecret }}",
    "access_token": "{{ $json.plaidAccessToken }}"
  }
  ```
- **Purpose:** Fetch account details and institution info
- **Position:** [368, 1536]

#### Node 6: HTTP Request (Get Transactions)
- **Type:** HTTP Request
- **Method:** POST
- **URL:** `https://production.plaid.com/transactions/sync`
- **Body:**
  ```json
  {
    "client_id": "{{ $json.plaidClientId }}",
    "secret": "{{ $json.plaidSecret }}",
    "access_token": "{{ $json.plaidAccessToken }}",
    "count": 100,
    "cursor": ""
  }
  ```
- **Purpose:** Sync transactions using Plaid's cursor-based pagination
- **Position:** [736, 1344]

#### Node 7: Code (Transform Accounts)
- **Type:** Code (JavaScript)
- **Purpose:** Transform Plaid account data for Supabase upsert
- **Key Transformations:**
  - Map account fields to database schema
  - Extract institution name from parent node
  - Set default values for cashflow inclusion
  - Dedupe by provider_account_id
- **Position:** [736, 1536]

#### Node 8: HTTP Request (Upsert Accounts)
- **Type:** HTTP Request (Supabase)
- **Method:** POST
- **URL:** `https://YOUR_PROJECT.supabase.co/rest/v1/accounts`
- **Headers:**
  - `apikey`: Your Supabase publishable key
  - `Prefer`: `resolution=merge-duplicates, return=representation`
- **Query Parameters:**
  - `on_conflict`: `provider,provider_account_id`
  - `select`: `id,provider,provider_account_id,name,balance_current,balance_available`
- **Body:** `{{ $json.accountsToUpsert }}`
- **Position:** [960, 1536]

#### Node 9: Code (Transform Transactions)
- **Type:** Code (JavaScript)
- **Purpose:** Transform Plaid transactions for Supabase upsert
- **Key Features:**
  - Amount sign normalization (CRITICAL)
  - AI category extraction from Plaid enrichment
  - Account ID mapping (Plaid → Supabase UUID)
  - Deduplication by provider_transaction_id
- **Position:** [1184, 1536]

#### Node 10: HTTP Request (Upsert Transactions)
- **Type:** HTTP Request (Supabase)
- **Method:** POST
- **URL:** `https://YOUR_PROJECT.supabase.co/rest/v1/transactions`
- **Headers:**
  - `Prefer`: `resolution=merge-duplicates, return=representation`
- **Query Parameters:**
  - `on_conflict`: `provider,provider_transaction_id`
  - `select`: `id,provider,provider_transaction_id,account_id,provider_account_id,date,amount,status`
- **Body:** `{{ $json.transactionsToUpsert }}`
- **Position:** [1408, 1616]

#### Node 11: Convert to File (Log Output)
- **Type:** Convert to File
- **Purpose:** Convert final output to JSON for logging/debugging
- **Position:** [288, 1344]

## Workflow Flow

```
┌─────────────────┐    ┌─────────────────┐
│  Schedule       │    │    Webhook      │
│  Trigger        │    │    Trigger      │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          └──────────┬───────────┘
                     │
          ┌─────────────────┐
          │ Workflow Config │
          │   (Set Node)    │
          └─────────┬───────┘
                    │
          ┌─────────────────┐
          │ Loop Over Items │
          │ (Split Batches) │
          └─────────┬───────┘
                    │
          ┌─────────────────┐
          │ Get Provider    │
          │ Data (Accounts) │
          └─────────┬───────┘
                    │
          ┌─────────────────┐
          │ Get Transactions│
          │ (Plaid Sync)    │
          └─────────┬───────┘
                    │
          ┌─────────────────┐
          │ Transform       │
          │ Accounts        │
          └─────────┬───────┘
                    │
          ┌─────────────────┐
          │ Upsert Accounts │
          │ (Supabase)      │
          └─────────┬───────┘
                    │
          ┌─────────────────┐
          │ Transform       │
          │ Transactions    │
          └─────────┬───────┘
                    │
          ┌─────────────────┐
          │ Upsert          │
          │ Transactions    │
          │ (Supabase)      │
          └─────────┬───────┘
                    │
          ┌─────────────────┐
          │ Log Output      │
          │ (Convert File)  │
          └─────────────────┘
```

## Data Transformation Details

### Account Transformation (Node 7)

**Input:** Plaid accounts response  
**Output:** Array of account objects for Supabase

```javascript
// WHY: Extract accounts from the nested Plaid response structure
// Plaid wraps accounts in body.accounts array, so we need to unwrap it first
const accounts = $('getProviderData5').first().json.body.accounts;

// WHY: Dedupe accounts to prevent duplicate upserts
// Plaid sometimes returns duplicate accounts, so we filter by required fields
const accounts = $('getProviderData5').first().json.body.accounts
  .filter(Boolean);

// WHY: Build deduplication tracker
// Prevent duplicate database rows by tracking provider_account_id
const seen = new Set();

const accountsToUpsert = accounts
  .map(a => ({
    // WHY: Standardize provider field
    // All accounts from this workflow are from Plaid, so we hardcode 'plaid'
    provider: 'plaid',
    
    // WHY: Use Plaid's unique account identifier
    // This is our primary key for deduplication and future lookups
    provider_account_id: a.account_id,
    
    // WHY: Clean account name
    // Use the official account name from the bank
    name: a.name,
    
    // WHY: Add institution context
    // Helps users identify which bank/account this is
    institution: $('Loop Over Items').first().json.institution_name, 
    
    // WHY: Normalize account type
    // Plaid has both type and subtype fields; subtype is more specific
    account_type: a.subtype ?? a.type ?? null,
    
    // WHY: Include account mask for identification
    // Last 4 digits help users recognize accounts (e.g., "Checking *1234")
    mask: a.mask ?? null,
    
    // WHY: Map balance fields with null safety
    // Current balance is what's available now; available is what can be withdrawn
    balance_current: a.balances?.current ?? null,
    balance_available: a.balances?.available ?? null,
    
    // WHY: Default to including in cashflow calculations
    // Most accounts should be included in financial summaries
    include_in_cashflow: true,
    
    // WHY: Mark as active by default
    // We can assume synced accounts are currently active
    is_active: true,
    
    // WHY: Add timestamp for tracking
    // Helps with debugging and audit trails
    updated_at: new Date().toISOString(),
  }))
  .filter(r => {
    // WHY: Enforce required fields for data integrity
    // provider_account_id and name are essential for account identification
    if (!r.provider_account_id || !r.name) return false;
    
    // WHY: Prevent duplicates during this run
    // Create composite key for uniqueness across providers
    const k = `${r.provider}:${r.provider_account_id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
```

**Key Transformation Rationale:**
- **Data Structure Unwrapping:** Plaid nests data in `body.accounts`, requiring extraction
- **Deduplication:** Prevents database constraint violations and duplicate rows
- **Field Mapping:** Converts Plaid's field names to our database schema
- **Null Safety:** Handles missing balance data gracefully with `?? null`
- **Composite Keys:** Uses `provider:provider_account_id` for global uniqueness

### Transaction Transformation (Node 9)

**Input:** Plaid transactions + account lookup table  
**Output:** Array of transaction objects for Supabase

#### Critical: Amount Normalization
```javascript
// WHY CRITICAL: Negate Plaid amount to convert to standard financial convention
// Plaid uses opposite sign convention: positive = money out, negative = money in
// Standard finance: positive = money in (income), negative = money out (expenses)
const amount = (typeof t.amount === 'number') ? -t.amount : -Number(t.amount);
```

#### Account ID Mapping
```javascript
// WHY: Build lookup table to map Plaid account IDs to Supabase UUIDs
// Plaid transactions reference account_id, but our database needs the UUID primary key
const accountLookup = new Map(
  accountRows
    .filter(r => r.provider_account_id && r.id)
    .map(r => [r.provider_account_id, r.id])
);

// WHY: Map Plaid's account_id to our database's UUID
// This establishes the foreign key relationship between transactions and accounts
const account_id = provider_account_id ? accountLookup.get(provider_account_id) : null;
```

#### Status Mapping
```javascript
// WHY: Convert Plaid's boolean pending flag to our status enum
// Plaid uses 'pending: true/false', we use 'pending/posted' strings
const status = (t.pending === true) ? 'pending' : 'posted';
```

#### Complete Transaction Transformation
```javascript
// WHY: Pull all Plaid "added" transactions from the accounts-Transactions node
// Plaid's sync API returns added/modified transactions in separate arrays
const plaidItems = $items('accounts-Transactions');
const added = plaidItems
  .flatMap(i => i.json.body?.added ?? [])
  .filter(Boolean);

// WHY: Build deduplication tracker
// Prevent processing the same transaction multiple times in one run
const seen = new Set();

const transactionsToUpsert = added
  .map(t => {
    // WHY: Standardize provider identifier
    // All transactions in this workflow come from Plaid
    const provider = 'plaid';

    // WHY: Extract Plaid's identifiers
    // provider_account_id links back to Plaid account
    // provider_transaction_id is Plaid's unique transaction ID
    const provider_account_id = t.account_id ?? null;
    const provider_transaction_id = t.transaction_id ?? null;
    
    // WHY: Handle date field with fallback
    // Some transactions have authorized_date instead of date
    const date = t.date ?? t.authorized_date ?? null;
    
    // WHY: CRITICAL - Fix amount sign convention
    // This is the most important transformation - see detailed explanation above
    const amount = (typeof t.amount === 'number') ? -t.amount : -Number(t.amount);

    // WHY: Extract counterparty information with priority order
    // Merchant name is most reliable, fallback to counterparties array
    const counterparty_name =
      t.merchant_name ??
      t.counterparties?.[0]?.name ??
      null;

    // WHY: Build description fields with fallbacks
    // description_raw preserves original data for debugging
    // description_clean is user-friendly display text
    const description_raw =
      t.original_description ??
      t.name ??
      counterparty_name ??
      null;

    const description_clean =
      t.name ??
      counterparty_name ??
      null;

    // WHY: Map Plaid's pending boolean to our status enum
    const status = (t.pending === true) ? 'pending' : 'posted';

    // WHY: Extract Plaid's AI categorization data
    // This provides seed data for our own categorization system
    const category_ai = 
      t.personal_finance_category?.detailed ??      // Most specific category
      t.personal_finance_category?.primary ??       // Broader category
      (Array.isArray(t.category) ? t.category.join(' > ') : null);  // Legacy format

    // WHY: Convert Plaid's confidence levels to numeric scores
    // Enables filtering by confidence and quantitative analysis
    const confidenceMap = {
      'VERY_HIGH': 95,   // Almost certainly correct
      'HIGH': 85,        // Very likely correct
      'MEDIUM': 70,      // Probably correct
      'LOW': 50          // Might be correct
    };
    const category_ai_conf = 
      confidenceMap[t.personal_finance_category?.confidence_level] ?? 
      (Array.isArray(t.category) ? 60 : null); // Default confidence for legacy categories

    // WHY: Validate required fields for data integrity
    // These fields are essential for proper transaction storage
    if (!provider_transaction_id || !account_id || !date || Number.isNaN(amount)) return null;

    // WHY: Prevent duplicates during this run
    // Use composite key to ensure uniqueness across providers
    const k = `${provider}:${provider_transaction_id}`;
    if (seen.has(k)) return null;
    seen.add(k);

    // WHY: Return transformed transaction object
    // Maps Plaid data to our database schema with all required fields
    return {
      provider,
      provider_transaction_id,
      account_id,               // REQUIRED FK to accounts table
      provider_account_id,      // Optional: keep Plaid's reference
      date,                     // REQUIRED: transaction date
      amount,                   // REQUIRED: normalized amount
      description_raw,          // Original description for audit
      description_clean,        // Clean description for UI
      counterparty_name,        // Merchant/payee name
      provider_type: t.payment_channel ?? null,  // How transaction was made
      status,                   // pending/posted
      processing_status: 'complete',  // Our processing state
      category_ai,              // Plaid's AI suggestion
      category_ai_conf,         // Plaid's confidence score
      updated_at: new Date().toISOString(),  // Audit timestamp
    };
  })
  .filter(Boolean);  // WHY: Remove null entries from validation failures
```

**Key Transformation Rationale:**
- **Amount Sign Fix:** Critical conversion from Plaid's convention to standard financial convention
- **Account Relationship Mapping:** Links transactions to accounts via UUID foreign keys
- **Data Quality:** Validation and deduplication prevent database corruption
- **AI Category Extraction:** Preserves Plaid's categorization for our rule engine training
- **Fallback Logic:** Handles missing or inconsistent Plaid data gracefully
- **Audit Trail:** Maintains original data alongside cleaned versions

## AI Category Extraction from Plaid

### Why We Extract Plaid's Categories

Plaid provides AI-powered categorization that serves as valuable seed data for our own categorization system:

```javascript
// WHY: Extract category with priority order for maximum accuracy
// Plaid provides multiple category formats; we prefer the most specific
const category_ai = 
  t.personal_finance_category?.detailed ??      // MOST SPECIFIC: "FOOD_AND_DRINK_COFFEE"
  t.personal_finance_category?.primary ??       // BROADER: "FOOD_AND_DRINK" 
  (Array.isArray(t.category) ? t.category.join(' > ') : null);  // LEGACY: ["Food and Drink", "Restaurants"]
```

**Priority Rationale:**
1. **Detailed category** gives us the most specific classification (e.g., coffee shops vs general food)
2. **Primary category** provides a reliable fallback when detailed isn't available
3. **Legacy array** maintains compatibility with older Plaid data formats

### Confidence Score Mapping

```javascript
// WHY: Convert qualitative confidence to quantitative scores
// Enables filtering and statistical analysis of categorization quality
const confidenceMap = {
  'VERY_HIGH': 95,   // Almost certainly correct - safe for auto-categorization
  'HIGH': 85,        // Very likely correct - good for rule training
  'MEDIUM': 70,      // Probably correct - use with human review
  'LOW': 50          // Might be correct - treat as suggestion only
};
```

**Score Rationale:**
- **95 (VERY_HIGH):** Trust for automatic categorization without review
- **85 (HIGH):** Use as training data for our rule engine
- **70 (MEDIUM):** Show to users for confirmation
- **50 (LOW):** Display as suggestion but require manual confirmation

### Business Value

**1. Rule Engine Training**
```javascript
// High-confidence Plaid categories become training data
if (category_ai_conf >= 85) {
  // Use this transaction to train our categorization rules
  // Example: If merchant_name contains "Starbucks" → category = "FOOD_AND_DRINK_COFFEE"
}
```

**2. Fallback Categorization**
```javascript
// When our rules don't match, fall back to Plaid's suggestion
if (!ourRuleResult && category_ai_conf >= 70) {
  final_category = category_ai;
  confidence = category_ai_conf;
}
```

**3. Quality Metrics**
```javascript
// Track categorization accuracy over time
const plaidAccuracy = transactions.filter(t => 
  t.category_ai_conf >= 85 && 
  t.user_category === t.category_ai
).length / totalTransactions;
```

### Example Transformations

**Input from Plaid (Modern Format):**
```json
{
  "personal_finance_category": {
    "primary": "FOOD_AND_DRINK",
    "detailed": "FOOD_AND_DRINK_COFFEE",
    "confidence_level": "VERY_HIGH"
  },
  "merchant_name": "Starbucks",
  "name": "STARBUCKS COFFEE"
}
```

**Our Transformation:**
```javascript
// Extracted values:
category_ai = "FOOD_AND_DRINK_COFFEE"        // Most specific category
category_ai_conf = 95                        // Numeric confidence
counterparty_name = "Starbucks"              // Clean merchant name
description_clean = "STARBUCKS COFFEE"      // User-friendly description
```

**Input from Plaid (Legacy Format):**
```json
{
  "category": ["Food and Drink", "Restaurants", "Coffee Shop"],
  "name": "Local Cafe"
}
```

**Our Transformation:**
```javascript
// Extracted values:
category_ai = "Food and Drink > Restaurants > Coffee Shop"  // Joined legacy format
category_ai_conf = 60                                      // Default confidence for legacy
```

This extraction strategy provides a robust foundation for our categorization system while maintaining compatibility with different Plaid data formats.

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

## Error Handling & Monitoring

### Common Issues and Solutions

#### 1. Invalid Access Token
- **Symptom:** 401 Unauthorized from Plaid API
- **Solution:** Refresh the access token via Plaid Link or update webhook payload

#### 2. Account ID Mapping Failure
- **Symptom:** Transactions with null `account_id`
- **Solution:** Ensure accounts are upserted before transactions; check account lookup logic

#### 3. Amount Sign Issues
- **Symptom:** Expenses show as positive, income as negative
- **Solution:** Verify amount negation is applied in transaction transform

#### 4. Duplicate Prevention
- **Symptom:** "duplicate key value violates unique constraint"
- **Solution:** Check `on_conflict` parameters and deduplication logic

### Monitoring Recommendations

1. **Log Transaction Counts:** Track number of transactions processed per run
2. **Monitor Failed Upserts:** Set up alerts for Supabase HTTP errors
3. **Cursor Management:** Store and reuse Plaid sync cursors for efficiency
4. **Balance Validation:** Compare account balances before/after sync

## Environment Setup

### Required Environment Variables
```bash
# Plaid API Credentials
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret

# Supabase (optional, can use n8n credentials)
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

### n8n Credential Setup
1. **Supabase API Credential:**
   - Type: HTTP Header Auth
   - Name: `apikey`
   - Value: Your Supabase publishable/service key

2. **Plaid Credentials:**
   - Store in environment variables (recommended)
   - Or use Generic Credential type

## Testing & Debugging

### Manual Testing via Webhook
```bash
curl -X POST http://localhost:5678/webhook/plaid-listen-sync \
  -H "Content-Type: application/json" \
  -d '{
    "access_token": "access-production-YOUR_TOKEN",
    "account_id": "YOUR_ACCOUNT_ID"
  }'
```

### Debug Tips
1. **Enable n8n Execution Logs:** Set `EXECUTIONS_DATA: true` in n8n config
2. **Use Convert to File Node:** Inspect intermediate data transformations
3. **Check Supabase Logs:** Monitor for constraint violations or errors
4. **Test with Small Dataset:** Limit `count` parameter in transactions sync

## Performance Considerations

### Optimization Strategies
1. **Cursor-Based Sync:** Use Plaid's cursor for incremental updates
2. **Batch Processing:** Process accounts in batches for multiple institutions
3. **Selective Fields:** Only request necessary fields from Plaid API
4. **Parallel Processing:** Consider parallel account processing for large datasets

### Rate Limits
- **Plaid API:** 100 requests/minute for production
- **Supabase:** Based on your plan; monitor usage
- **n8n:** Concurrent execution limits apply

## Security Notes

### Data Protection
1. **Never log sensitive data:** Avoid logging full access tokens or account numbers
2. **Use HTTPS:** All API calls should use secure endpoints
3. **Credential Management:** Store secrets in environment variables, not workflow JSON
4. **Access Control:** Limit webhook endpoint access with authentication if needed

### Compliance
- **GDPR/CCPA:** Ensure data processing complies with regulations
- **Financial Data:** Treat all financial data as highly sensitive
- **Audit Trail:** Maintain logs of data processing for compliance

## Integration Points

### Upstream Dependencies
- **Plaid Link:** For obtaining access tokens
- **Bank APIs:** Via Plaid's aggregation service

### Downstream Consumers
- **Financial Dashboard:** Web application consuming the data
- **Categorization Engine:** AI service processing transactions
- **Reporting Tools:** Analytics and financial insights

### Related Workflows
- **Teller Sync:** Similar workflow for Teller API
- **Categorization Trigger:** Workflow that processes new transactions
- **Balance Alerts:** Workflow that monitors account changes

## Maintenance

### Regular Tasks
1. **Refresh Access Tokens:** Plaid tokens expire and need renewal
2. **Monitor API Changes:** Plaid regularly updates their API
3. **Update Categories:** Review and update category mappings
4. **Performance Tuning:** Optimize based on usage patterns

### Version Control
- **Workflow JSON:** Store in version control (excluding credentials)
- **Documentation:** Keep this file updated with workflow changes
- **Backups:** Export workflow backups regularly

---

**Last Updated:** January 2026  
**Version:** 2.0  
**Compatible with:** n8n v1.x, Plaid API v2020-09-14
