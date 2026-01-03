# Transfers & Reimbursements

**Status:** Implemented  
**Date:** 2026-01-01

---

## Overview

This module handles two related but distinct concepts:

1. **Transfers:** Money moving between accounts owned by the same person (should be excluded from cashflow)
2. **Reimbursements:** Money received to offset a previous expense (should net against the original expense)

---

## Transfer Detection

### Automatic Detection Heuristics

The system uses these heuristics to suggest internal transfers:

1. **Amount Matching:** Same amount with opposite sign (±$0.01 tolerance)
2. **Date Proximity:** Within 3 days of each other
3. **Different Accounts:** Between different accounts (same owner)
4. **Keyword Detection:** Description contains transfer-related keywords

### P2P Service Classification

Known P2P services are flagged for user review:
- Venmo, Zelle, PayPal, Cash App, Apple Cash, Google Pay

P2P transactions are classified as:
- **Transfer:** If between same-owner accounts
- **Expense:** If outflow to external party
- **Income:** If inflow from external party

### API

```typescript
// lib/categorization/transferDetection.ts

// Check if merchant is a P2P service
isKnownP2PService(merchantName: string): boolean

// Detect if transaction is likely an internal transfer
detectInternalTransfer(transaction, allTransactions): { isTransfer, matchingTransaction? }

// Classify P2P transaction
classifyP2PTransaction(transaction): 'transfer' | 'expense' | 'income' | 'unknown'

// Get suggested transfer pairs
getSuggestedTransferPairs(transactions): Array<{ outflow, inflow, confidence }>
```

---

## Reimbursement Handling

### Linking Reimbursements

When a user receives money that reimburses a previous expense:

1. User selects the incoming transaction
2. User links it to the original expense
3. System sets `reimbursement_of_id` on the reimbursement
4. System marks it as `is_pass_through = true`
5. Optionally copies the category from the original expense

### Cashflow Impact

- **Original expense:** Counted in cashflow
- **Reimbursement:** Marked as pass-through, excluded from net cashflow
- **Net effect:** Only the unreimbursed portion affects cashflow

### API

```typescript
// lib/categorization/reimbursementHandler.ts

// Link a reimbursement to its original expense
linkReimbursement(reimbursementTxId, originalExpenseTxId, copyCategory?): Promise<Result>

// Unlink a reimbursement
unlinkReimbursement(reimbursementTxId): Promise<Result>

// Get all reimbursement pairs for a month
getReimbursementPairs(month: string): Promise<ReimbursementPair[]>

// Find potential reimbursements for an expense
findPotentialReimbursements(expenseId, maxDaysDiff?): Promise<Transaction[]>

// Get summary for reporting
getReimbursementSummary(month): Promise<Summary>
```

---

## API Endpoints

### `POST /api/transactions/[id]/transfer`

Toggle transfer status.

**Request:**
```json
{ "is_transfer": true }
```

### `POST /api/transactions/[id]/reimbursement`

Link reimbursement to original expense.

**Request:**
```json
{
  "original_expense_id": "uuid",
  "copy_category": true
}
```

### `DELETE /api/transactions/[id]/reimbursement`

Unlink reimbursement.

---

## Database Schema

### Transactions Table Fields

| Column | Type | Description |
|--------|------|-------------|
| `is_transfer` | boolean | TRUE if internal transfer |
| `is_pass_through` | boolean | TRUE if reimbursement (excluded from cashflow) |
| `reimbursement_of_id` | UUID | FK to original expense transaction |

---

## UI Integration

### Transaction Table

- **Transfer Toggle (T):** Already exists, toggles `is_transfer`
- **Pass-Through Toggle (P):** Already exists, toggles `is_pass_through`
- **Chain Icon:** Shows when transaction has `reimbursement_of_id` set

### Reimbursement Linking Flow

1. User clicks "Link Reimbursement" on an incoming transaction
2. Modal shows recent expenses with similar amounts
3. User selects the original expense
4. System links them and updates flags

---

## Cashflow Calculation Updates

In `lib/cashflow.ts`:

```typescript
// Exclude transfers from net cashflow
if (transaction.is_transfer) {
  // Skip - internal movement, not income or expense
  continue;
}

// Exclude pass-through (reimbursements) from net cashflow
if (transaction.is_pass_through) {
  // Skip - nets against original expense
  continue;
}
```

---

## Common Scenarios

### Scenario 1: Credit Card Payment

- **Outflow from checking:** -$500 to credit card
- **Inflow to credit card:** +$500 payment received
- **Detection:** Same amount, opposite sign, within 1 day
- **Action:** Both marked as `is_transfer = true`
- **Cashflow impact:** None (internal movement)

### Scenario 2: T-Mobile Family Reimbursement

- **Original expense:** -$150 T-Mobile bill
- **Reimbursement:** +$100 from family member via Venmo
- **Action:** Link reimbursement to original
- **Cashflow impact:** Net -$50 (your share)

### Scenario 3: Venmo Payment to Friend

- **Transaction:** -$25 Venmo to John
- **Classification:** P2P outflow → expense
- **Action:** User categorizes as "Dining" or "Gifts"
- **Cashflow impact:** -$25 expense

---

## Related Documents

- `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` - FR-07, FR-08, FR-09
- `docs/financial-command-center-overview.md` - is_transfer, is_pass_through flags
- `docs/db-schema.md` - Database schema
