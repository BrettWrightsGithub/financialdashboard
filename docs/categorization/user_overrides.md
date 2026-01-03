# User Overrides & Payee Memory

**Status:** Implemented  
**Date:** 2026-01-01

---

## Overview

When a user manually categorizes a transaction, the system:
1. Updates the transaction's category
2. Sets `category_locked = TRUE` to prevent future rule/Plaid overwrites
3. Records the override in `category_overrides` for audit trail
4. Saves to payee memory for future transactions with the same payee

---

## Key Principle: "Overrides Must Stick"

Per the MVP plan (FR-05), user overrides always win. Once a user manually sets a category:
- Rules will not overwrite it
- Plaid updates will not overwrite it
- Only the user can change it again

This is enforced by the `category_locked` flag on transactions.

---

## Database Schema

### `payee_category_mappings` Table

Stores learned payee→category mappings.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `payee_name` | text | Original payee name |
| `payee_name_normalized` | text | Normalized for matching |
| `category_id` | UUID | FK to categories |
| `confidence` | numeric | Confidence score (default 1.0) |
| `usage_count` | integer | Times this mapping was applied |
| `last_used_at` | timestamp | Last time mapping was used |

### `transactions` Table Updates

| Column | Type | Description |
|--------|------|-------------|
| `category_locked` | boolean | TRUE if user manually set category |
| `category_source` | text | 'manual', 'rule', 'payee_memory', 'plaid' |

---

## Stored Procedures

### `fn_apply_user_override(p_transaction_id, p_new_category_id, p_learn_payee)`

Main function for applying user overrides:
1. Updates transaction category
2. Sets `category_source = 'manual'`
3. Sets `category_locked = TRUE`
4. Inserts audit record into `category_overrides`
5. Optionally saves to payee memory

**Returns:**
```json
{
  "success": true,
  "old_category_id": "uuid",
  "new_category_id": "uuid",
  "payee_learned": true
}
```

### `fn_normalize_payee_name(raw_name)`

Normalizes payee names for consistent matching:
- Lowercase and trim
- Remove common suffixes (Inc, LLC, Ltd, Corp, Co)
- Remove common prefixes (The, A, An)
- Remove special characters
- Collapse multiple spaces

### `fn_save_payee_mapping(p_payee_name, p_category_id)`

Saves or updates a payee→category mapping. If the payee already exists, updates the category and increments usage count.

### `fn_get_payee_mapping(p_payee_name)`

Retrieves the category mapping for a payee name.

---

## API Endpoints

### `POST /api/transactions/[id]/override`

Apply a user override to a transaction.

**Request:**
```json
{
  "category_id": "uuid",
  "learn_payee": true
}
```

**Response:**
```json
{
  "success": true,
  "old_category_id": "uuid",
  "new_category_id": "uuid",
  "payee_learned": true
}
```

### `PUT /api/transactions/[id]/override`

Lock or unlock a transaction's category.

**Request:**
```json
{
  "locked": true
}
```

---

## TypeScript API

### `lib/categorization/userOverride.ts`

```typescript
// Apply user override (main function)
applyUserOverride(transactionId, newCategoryId, learnPayee?): Promise<OverrideResult>

// Lock/unlock category
lockTransactionCategory(transactionId): Promise<boolean>
unlockTransactionCategory(transactionId): Promise<boolean>

// Bulk operations
applyBulkOverride(transactionIds, newCategoryId, learnPayee?): Promise<{success, failed}>

// Audit trail
getTransactionOverrideHistory(transactionId): Promise<OverrideHistory[]>
```

### `lib/categorization/payeeMemory.ts`

```typescript
// Normalize payee name
normalizePayeeName(rawName): string

// Get/save mappings
getPayeeMapping(payeeName): Promise<PayeeMapping | null>
savePayeeMapping(payeeName, categoryId): Promise<string | null>

// Admin functions
getAllPayeeMappings(): Promise<PayeeMapping[]>
deletePayeeMapping(id): Promise<void>
```

---

## UI Integration

The Transactions page inline category editor now:
1. Calls `/api/transactions/[id]/override` instead of direct DB update
2. Shows 🔒 icon for locked transactions
3. Shows `CategorySourceBadge` indicating how category was set

---

## Categorization Waterfall Order

The waterfall respects user overrides:

1. **Check `category_locked`** → If TRUE, skip (user override sticks)
2. **Apply Rules** → Match against `categorization_rules`
3. **Apply Payee Memory** → Match against `payee_category_mappings`
4. **Apply Plaid** → Use Plaid category if confidence ≥ 80%

---

## Migration

Run the SQL migration to create the payee memory infrastructure:

```bash
# File: supabase/migrations/20260101_payee_memory.sql
```

---

## Related Documents

- `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` - FR-05, FR-06
- `docs/categorization/rule_engine.md` - Rule engine documentation
- `docs/db-schema.md` - Database schema
