# Plaid Integration Context

Essential context for working with Plaid API integration, especially for transaction categorization.

## Quick Reference

**Plaid Docs:** https://plaid.com/docs/
**Transactions API:** https://plaid.com/docs/api/products/transactions/

## Key Endpoints

### `/transactions/sync` (REQUIRED for MVP - TI-02)
**Use this for all transaction syncing - NOT `/transactions/get`**

```javascript
// Cursor-based incremental sync
const response = await plaidClient.transactionsSync({
  access_token: connection.access_token,
  cursor: connection.transaction_cursor || undefined, // Start from last sync
  count: 500 // Max per request
});

// Update cursor for next sync
await updateConnection({
  transaction_cursor: response.next_cursor
});
```

**Why cursor-based sync:**
- Only fetches new/modified transactions (efficient)
- Prevents accidental overwriting of historical data
- Maintains data integrity (TI-02 requirement)
- Handles pending→posted transitions correctly

### `/transactions/get` (LEGACY - Don't Use)
**Problem:** Requires date ranges; can miss updates; no cursor tracking

## Transaction Fields

### Essential Fields

```typescript
interface PlaidTransaction {
  transaction_id: string;           // Store as provider_transaction_id
  account_id: string;               // Store as provider_account_id
  amount: number;                   // POSITIVE for outflows, NEGATIVE for inflows
  date: string;                     // YYYY-MM-DD format
  name: string;                     // Merchant name (store as description_raw)
  merchant_name?: string;           // Cleaned name (prefer this for description_clean)
  pending: boolean;                 // TRUE if not yet posted
  pending_transaction_id?: string;  // Links pending to posted (CRITICAL for TI-01)
  
  // Categorization fields
  personal_finance_category: {
    primary: string;                // e.g., "FOOD_AND_DRINK"
    detailed: string;               // e.g., "FOOD_AND_DRINK_RESTAURANTS"
    confidence_level?: string;      // "VERY_HIGH", "HIGH", "MEDIUM", "LOW", "UNKNOWN"
  };
  
  // Transfer detection
  payment_channel: string;          // "online", "in store", "other"
  transaction_type?: string;        // "special", "place", etc.
  
  // P2P detection
  payment_meta: {
    payment_method?: string;        // Can indicate Venmo, Zelle, etc.
    payee?: string;
    payer?: string;
  };
}
```

### Amount Sign Convention

**PLAID CONVENTION (opposite of what you'd expect):**
- **Positive amount** = money OUT (expense, withdrawal)
- **Negative amount** = money IN (income, deposit)

**YOUR APP CONVENTION:**
- **Positive amount** = inflow (income)
- **Negative amount** = outflow (expense)

**Therefore: MULTIPLY BY -1 when importing from Plaid**

```typescript
const normalizedAmount = plaidTransaction.amount * -1;
```

## Pending Transaction Handling (TI-01)

**Critical:** When a pending transaction settles, Plaid sends TWO events:
1. Pending transaction is marked `removed: true`
2. New posted transaction with `pending: false` and `pending_transaction_id` pointing to old ID

**Implementation:**

```typescript
async function handlePlaidTransactionUpdate(update: PlaidTransactionUpdate) {
  // Handle removed pending transactions
  for (const removedId of update.removed) {
    const pendingTxn = await getTransactionByProviderId(removedId);
    if (pendingTxn) {
      // Don't delete - mark as archived or update status
      await updateTransaction(pendingTxn.id, { 
        status: 'archived',
        processing_status: 'replaced_by_posted'
      });
    }
  }
  
  // Handle new/modified transactions
  for (const plaidTxn of update.added.concat(update.modified)) {
    // Check if this is a posted version of a pending transaction
    if (plaidTxn.pending_transaction_id) {
      const pendingTxn = await getTransactionByProviderId(plaidTxn.pending_transaction_id);
      
      if (pendingTxn?.category_locked) {
        // Copy user's categorization to posted transaction (TI-01)
        await createTransaction({
          ...mapPlaidToOurTransaction(plaidTxn),
          life_category_id: pendingTxn.life_category_id,
          category_locked: true,
          category_source: 'manual',
          pending_transaction_id: plaidTxn.pending_transaction_id
        });
        continue;
      }
    }
    
    // Normal transaction processing
    await upsertTransaction(mapPlaidToOurTransaction(plaidTxn));
  }
}
```

## Categorization Mapping

### Plaid Category → Your Category

**Plaid uses hierarchical categories:**
- Primary: `FOOD_AND_DRINK`
- Detailed: `FOOD_AND_DRINK_RESTAURANTS`

**Create mapping table:**

```typescript
const PLAID_CATEGORY_MAP: Record<string, string> = {
  // Food & Drink
  'FOOD_AND_DRINK_GROCERIES': 'groceries_category_id',
  'FOOD_AND_DRINK_RESTAURANTS': 'restaurants_category_id',
  'FOOD_AND_DRINK_COFFEE': 'coffee_category_id',
  
  // Transportation
  'TRANSPORTATION_GAS': 'gas_category_id',
  'TRANSPORTATION_PARKING': 'parking_category_id',
  'TRANSPORTATION_PUBLIC_TRANSIT': 'transit_category_id',
  
  // Income
  'INCOME_WAGES': 'wages_category_id',
  'INCOME_RENTAL_INCOME': 'rental_income_category_id',
  
  // Transfers (EXCLUDE from cashflow)
  'TRANSFER_IN': 'transfer_category_id',
  'TRANSFER_OUT': 'transfer_category_id',
  
  // Bills
  'LOAN_PAYMENTS_MORTGAGE_PAYMENT': 'mortgage_category_id',
  'UTILITIES_ELECTRIC': 'electricity_category_id',
  'UTILITIES_GAS': 'gas_utility_category_id',
  'UTILITIES_INTERNET': 'internet_category_id',
  
  // Default fallback
  'DEFAULT': 'uncategorized_category_id'
};

function mapPlaidCategory(plaidCategory: PlaidCategory): string {
  const detailed = plaidCategory.detailed;
  const primary = plaidCategory.primary;
  
  return PLAID_CATEGORY_MAP[detailed] || 
         PLAID_CATEGORY_MAP[primary] || 
         PLAID_CATEGORY_MAP.DEFAULT;
}
```

### Confidence Handling

```typescript
function mapPlaidConfidence(confidenceLevel?: string): number {
  const confidenceMap: Record<string, number> = {
    'VERY_HIGH': 0.95,
    'HIGH': 0.85,
    'MEDIUM': 0.70,
    'LOW': 0.50,
    'UNKNOWN': 0.50
  };
  
  return confidenceMap[confidenceLevel || 'UNKNOWN'] || 0.50;
}
```

**Review queue threshold:** Surface transactions with confidence < 0.70 (MEDIUM or below)

## Transfer Detection

### Internal Transfers

Plaid marks transfers with:
- `transaction_type === 'special'`
- Category: `TRANSFER_IN` or `TRANSFER_OUT`

**Additional heuristics needed:**
- Check if matching opposite transaction exists (same amount, opposite sign, within 3 days)
- Both accounts must be same-owner (your accounts)

```typescript
async function isInternalTransfer(plaidTxn: PlaidTransaction): Promise<boolean> {
  // Plaid explicitly marks some transfers
  if (plaidTxn.transaction_type === 'special' || 
      plaidTxn.personal_finance_category.primary === 'TRANSFER') {
    return true;
  }
  
  // Look for matching opposite transaction
  const startDate = addDays(plaidTxn.date, -3);
  const endDate = addDays(plaidTxn.date, 3);
  
  const matchingTransfer = await findTransaction({
    amount: -plaidTxn.amount, // Opposite sign
    date: { gte: startDate, lte: endDate },
    status: 'posted'
  });
  
  return !!matchingTransfer;
}
```

### P2P Payments (Venmo, Zelle, PayPal)

**Problem:** Plaid often marks these as TRANSFER, but they're EXPENSES to external parties.

**Detection:**

```typescript
function isExternalP2P(plaidTxn: PlaidTransaction): boolean {
  const p2pIndicators = [
    'venmo',
    'zelle',
    'paypal',
    'cash app',
    'apple cash'
  ];
  
  const merchantName = (plaidTxn.merchant_name || plaidTxn.name).toLowerCase();
  
  return p2pIndicators.some(indicator => merchantName.includes(indicator));
}

// Mark as expense (not transfer) unless user specifies otherwise
if (isExternalP2P(plaidTxn)) {
  transaction.is_transfer = false;
  transaction.transfer_subtype = 'external_p2p';
}
```

## Error Handling

### Common Errors

```typescript
const PLAID_ERROR_CODES = {
  ITEM_LOGIN_REQUIRED: 'User needs to re-authenticate',
  INVALID_ACCESS_TOKEN: 'Access token expired or invalid',
  PRODUCT_NOT_READY: 'Transactions not yet available',
  RATE_LIMIT_EXCEEDED: 'Too many requests'
};

async function handlePlaidError(error: PlaidError) {
  switch (error.error_code) {
    case 'ITEM_LOGIN_REQUIRED':
      // Update connection status; notify user
      await updateConnection(itemId, {
        status: 'needs_reauth',
        error_code: error.error_code
      });
      break;
      
    case 'RATE_LIMIT_EXCEEDED':
      // Exponential backoff
      await delay(error.suggested_retry_after || 60000);
      return retrySync();
      
    case 'PRODUCT_NOT_READY':
      // Wait and retry
      await delay(30000);
      return retrySync();
      
    default:
      console.error('Plaid error:', error);
      throw error;
  }
}
```

## Sync Strategy

### Initial Sync (New Connection)

```typescript
async function performInitialSync(accessToken: string, connectionId: string) {
  let hasMore = true;
  let cursor = undefined;
  let allTransactions: Transaction[] = [];
  
  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor: cursor,
      count: 500
    });
    
    // Process transactions
    const transactions = await Promise.all(
      response.added.map(plaidTxn => {
        return createTransaction({
          ...mapPlaidToOurTransaction(plaidTxn),
          // Apply categorization logic
          life_category_id: await categorizeTransaction(plaidTxn),
          category_source: 'plaid',
          category_confidence: mapPlaidConfidence(plaidTxn.personal_finance_category.confidence_level)
        });
      })
    );
    
    allTransactions.push(...transactions);
    
    hasMore = response.has_more;
    cursor = response.next_cursor;
  }
  
  // Save cursor for incremental sync
  await updateConnection(connectionId, {
    transaction_cursor: cursor,
    last_sync_at: new Date().toISOString()
  });
  
  return allTransactions;
}
```

### Incremental Sync (Daily/Hourly)

```typescript
async function performIncrementalSync(connectionId: string) {
  const connection = await getConnection(connectionId);
  
  if (!connection.transaction_cursor) {
    // No cursor - do initial sync
    return performInitialSync(connection.access_token, connectionId);
  }
  
  const response = await plaidClient.transactionsSync({
    access_token: connection.access_token,
    cursor: connection.transaction_cursor,
    count: 500
  });
  
  // Handle removed (pending→posted transitions)
  await handleRemovedTransactions(response.removed);
  
  // Handle added
  await Promise.all(response.added.map(processNewTransaction));
  
  // Handle modified
  await Promise.all(response.modified.map(updateExistingTransaction));
  
  // Update cursor
  await updateConnection(connectionId, {
    transaction_cursor: response.next_cursor,
    last_sync_at: new Date().toISOString()
  });
}
```

### Sync Schedule

**Recommended:**
- **Initial sync:** On connection (immediate)
- **Incremental sync:** Every 4 hours
- **On-demand sync:** User-triggered refresh

```typescript
// Cron job or background worker
setInterval(async () => {
  const activeConnections = await getActiveConnections();
  
  for (const connection of activeConnections) {
    try {
      await performIncrementalSync(connection.id);
    } catch (error) {
      await handlePlaidError(error);
    }
  }
}, 4 * 60 * 60 * 1000); // 4 hours
```

## Testing

### Sandbox Mode

```typescript
const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
      },
    },
  })
);
```

**Sandbox features:**
- Fake banks with test credentials
- Instant transaction generation
- No real financial data

**Test credentials:** See https://plaid.com/docs/sandbox/test-credentials/

### Validation Checklist

Before deploying Plaid integration:

- [ ] Using `/transactions/sync` (not `/transactions/get`)
- [ ] Cursor is persisted and used for incremental syncs
- [ ] Amount signs are inverted (multiply by -1)
- [ ] Pending transaction categorizations are preserved (TI-01)
- [ ] Transfer detection distinguishes internal vs P2P
- [ ] Plaid categories are mapped to your categories
- [ ] Confidence scores are stored and used for review queue
- [ ] Error handling updates connection status appropriately
- [ ] Sync runs automatically every 4 hours
- [ ] Manual refresh works from UI

## Security

**NEVER expose to frontend:**
- `access_token` (in `provider_connections` table)
- `PLAID_SECRET` environment variable

**Access tokens:**
- Store encrypted at rest
- Only accessible to backend API routes
- Rotate if compromised

## Performance

**Optimization tips:**
- Batch database inserts (don't insert one-by-one)
- Use upsert to handle duplicates gracefully
- Index on `provider_transaction_id` for fast lookups
- Cache category mappings in memory
- Process transactions in parallel where possible

```typescript
// Good: Batch insert
await supabase.from('transactions').insert(transactions);

// Bad: Loop with individual inserts
for (const txn of transactions) {
  await supabase.from('transactions').insert(txn);
}
```

## Useful Resources

- **Plaid Quickstart:** `quickstart/` directory in project
- **Plaid API Reference:** https://plaid.com/docs/api/
- **Plaid Postman Collection:** https://www.postman.com/plaid/
- **Categorization Guide:** https://plaid.com/docs/api/products/transactions/#transactionspersonal_finance_category
- **Webhook Guide:** https://plaid.com/docs/api/webhooks/

## Common Issues

### Issue: Transactions not syncing
- Check connection status is 'healthy'
- Verify access_token is valid
- Check for rate limiting
- Ensure cursor is being persisted

### Issue: Pending categorizations lost
- Implement TI-01: pending transaction handler
- Store `pending_transaction_id` when posted version arrives
- Copy categorization from pending to posted

### Issue: Transfers showing as expenses
- Check transfer detection logic
- Distinguish internal (same-owner) from P2P (external)
- Set `is_transfer = true` only for internal moves

### Issue: Low Plaid accuracy
- Expected: 75-85% baseline
- Supplement with programmatic rules
- Use payee memory after first manual categorization
- See validation plan in categorization docs
