# Transaction Splitting

**Status:** Implemented | **Date:** 2026-01-02

---

## Overview

Transaction splitting allows users to divide a single transaction into multiple child transactions, each with its own category. This is essential for handling multi-category purchases (e.g., Amazon orders containing groceries, household supplies, and gifts).

## Data Model

### Parent-Child Relationship

- **Parent Transaction**: The original transaction from the bank/provider
- **Child Transactions**: User-created splits that sum to the parent amount

### Key Fields (transactions table)

| Field | Type | Description |
|-------|------|-------------|
| `parent_transaction_id` | uuid (nullable) | FK to parent transaction. Set on child transactions. |
| `is_split_child` | boolean | TRUE for child transactions created from splits |
| `is_split_parent` | boolean | TRUE for parent transactions that have been split. **Excluded from cashflow, sync, and categorization.** |

### Behavior

1. **When a transaction is split:**
   - Child transactions are created with `parent_transaction_id` pointing to the parent
   - Each child has `is_split_child = TRUE`
   - Parent is marked with `is_split_parent = TRUE`
   - Each child gets its own `life_category_id`
   - Children inherit: date, account, counterparty, flags from parent

2. **Cashflow calculations:**
   - Split parents (`is_split_parent = TRUE`) are **excluded** from all cashflow calculations
   - Only child transactions are counted
   - This prevents double-counting

3. **Future sync protection:**
   - The parent transaction remains in the database (not deleted)
   - `is_split_parent = TRUE` signals to sync processes to skip re-processing
   - The original `provider_transaction_id` is preserved for deduplication
   - Children have synthetic IDs: `{parent_id}_split_1`, `{parent_id}_split_2`, etc.

3. **Display:**
   - Parent shows "SPLIT" badge and amber background
   - Children are indented under parent with ↳ indicator
   - Parent shows "Unsplit" action, children show no split actions

## API Endpoints

### POST /api/transactions/split

Create splits for a parent transaction.

**Request:**
```json
{
  "parent_id": "uuid",
  "splits": [
    { "amount": 50.00, "category_id": "uuid", "description": "Groceries" },
    { "amount": 30.00, "category_id": "uuid", "description": "Household" }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "parent_id": "uuid",
  "children": [...],
  "message": "Created 2 split transactions"
}
```

**Validation:**
- At least 2 splits required
- Split amounts must sum to parent amount (±$0.01 tolerance)
- Each split must have positive amount and category

### DELETE /api/transactions/split?parent_id=uuid

Remove all splits and restore parent to normal state.

**Response:**
```json
{
  "success": true,
  "parent_id": "uuid",
  "deleted_count": 2,
  "message": "Removed 2 split transactions"
}
```

### GET /api/transactions/split?parent_id=uuid

Get all child transactions for a parent.

**Response:**
```json
{
  "parent_id": "uuid",
  "children": [...],
  "count": 2
}
```

## UI Components

### SplitModal (`components/transactions/SplitModal.tsx`)

Modal for creating splits:
- Shows parent amount at top
- Dynamic split rows (minimum 2)
- Each row: amount input, category dropdown, optional description
- "Fill" button to auto-fill remaining amount
- Real-time validation of totals
- Submit creates child transactions

### TransactionTable Updates

- "Split" button on eligible rows (not already split, not a child)
- "Unsplit" button on split parents
- Children displayed indented under parent
- Visual grouping with background colors

## Implementation Files

| File | Purpose |
|------|---------|
| `lib/categorization/transactionSplitting.ts` | Core split/unsplit logic |
| `app/api/transactions/split/route.ts` | API endpoints |
| `components/transactions/SplitModal.tsx` | Split creation UI |
| `components/transactions/TransactionTable.tsx` | Display with split grouping |
| `lib/cashflow.ts` | Updated to exclude split parents |
| `lib/queries.ts` | Updated dashboard calculations |

## Edge Cases

1. **Cannot split a child**: Attempting to split a child transaction returns an error
2. **Cannot re-split**: Must unsplit first before creating new splits
3. **Amount validation**: Splits must sum exactly to parent (within $0.01)
4. **Category inheritance**: Children don't inherit parent category - each gets its own

## Related Documentation

- [FR-10, A20 in official-plan-synthesis_mvp_categorization_ai2.md](./official-plan-synthesis_mvp_categorization_ai2.md)
- [Database Schema](../db-schema.md)
