# Stored Procedures (The Engine)

**Status:** Implemented | **Last Updated:** 2026-01-03

This document describes the Supabase stored procedures that power the transaction categorization engine.

---

## Architecture Overview

Per Section L of the MVP plan, Supabase stored procedures are "The Engine" that executes:

- **Waterfall categorization logic**: Rules → Payee Memory → Plaid defaults
- **Batch undo with ACID guarantees**: All-or-nothing transaction rollback
- **Pending→posted transaction handover**: Preserve user categorization across status changes

### Why Stored Procedures?

| Concern | Client-Side | Stored Procedure |
|---------|-------------|------------------|
| **Performance** | Minutes for 1,000 txns | Microseconds |
| **ACID Guarantees** | Complex to implement | Built-in |
| **Network Round-trips** | Many | Single RPC call |
| **Audit Logging** | Easy to miss | Guaranteed |

---

## Current Functions (Production)

### `fn_run_categorization_waterfall`

**Purpose:** Apply the categorization waterfall to a batch of transactions.

```sql
fn_run_categorization_waterfall(p_transaction_ids uuid[]) -> jsonb
```

**Parameters:**
- `p_transaction_ids`: Array of transaction UUIDs to categorize

**Returns:** JSONB with statistics:
```json
{
  "processed": 10,
  "rules_applied": 5,
  "memory_applied": 2,
  "plaid_applied": 1,
  "skipped_locked": 1,
  "uncategorized": 1
}
```

**Waterfall Logic:**
1. **Rules** (highest priority first) - Check `categorization_rules` table
2. **Payee Memory** - Check `category_overrides` for learned patterns
3. **Plaid Defaults** - Use `category_ai` if confidence ≥ 80%

**Skips:** Transactions where `category_locked = TRUE`

---

### `fn_undo_batch`

**Purpose:** Revert all category changes from a batch operation.

```sql
fn_undo_batch(p_batch_id uuid) -> TABLE(success boolean, transactions_reverted integer, error text)
```

**Parameters:**
- `p_batch_id`: UUID of the batch to undo

**Returns:**
- `success`: Whether the undo succeeded
- `transactions_reverted`: Count of transactions reverted
- `error`: Error message if failed

**Behavior:**
- Reverts `life_category_id` to `previous_category_id` from audit log
- Marks audit log entries as `is_reverted = TRUE`
- Marks batch as `is_undone = TRUE`
- **Respects locked transactions** - Won't revert if `category_locked = TRUE`

---

### `fn_apply_rule_retroactive`

**Purpose:** Apply a categorization rule to specific transactions retroactively.

```sql
fn_apply_rule_retroactive(
  p_rule_id uuid,
  p_transaction_ids uuid[],
  p_created_by text DEFAULT 'system'
) -> TABLE(batch_id uuid, applied_count integer, skipped_locked integer)
```

**Parameters:**
- `p_rule_id`: The rule to apply
- `p_transaction_ids`: Transactions to apply the rule to
- `p_created_by`: User/system identifier for audit

**Returns:**
- `batch_id`: UUID of the created batch (for undo support)
- `applied_count`: Transactions successfully categorized
- `skipped_locked`: Transactions skipped due to lock

---

### `fn_log_category_change`

**Purpose:** Log a category change to the audit trail.

```sql
fn_log_category_change(
  p_transaction_id uuid,
  p_previous_category_id uuid,
  p_new_category_id uuid,
  p_change_source category_change_source,
  p_rule_id uuid DEFAULT NULL,
  p_confidence_score numeric DEFAULT NULL,
  p_changed_by text DEFAULT 'system',
  p_batch_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
) -> uuid
```

**Change Sources (enum):**
- `plaid` - Plaid's category suggestion
- `rule` - Matched a categorization rule
- `manual` - User manual override
- `payee_memory` - Matched learned payee pattern
- `bulk_edit` - Bulk edit operation
- `reimbursement_link` - Linked as reimbursement
- `system` - System operation

---

### `fn_handle_pending_handover` (Trigger)

**Purpose:** Preserve user categorization when pending transactions become posted.

**Trigger:** `BEFORE INSERT ON transactions`

**Behavior:**
When a new transaction is inserted with `status = 'posted'` and `pending_transaction_id` is set:

1. Find matching pending transaction by `provider_transaction_id`
2. Copy user-set fields: `life_category_id`, `category_locked`, `category_source`, `counterparty_*`, `is_transfer`, `is_pass_through`, `is_business`
3. Archive the pending transaction (`status = 'archived'`)
4. Log the handover to audit log

---

## Enhanced Functions (Migration Pending)

The migration `20260103_stored_procedures_enhanced.sql` adds:

### Enhanced `fn_run_categorization_waterfall`

```sql
fn_run_categorization_waterfall(
  p_batch_id uuid DEFAULT NULL,
  p_transaction_ids uuid[]
) -> jsonb
```

**Enhancements:**
- Accepts optional `p_batch_id` for grouping operations
- Auto-creates batch record if not provided
- Logs ALL categorization changes to `category_audit_log`
- Returns `batch_id` in result for undo support

### `fn_categorize_transactions` (Convenience Wrapper)

```sql
fn_categorize_transactions(p_transaction_ids uuid[]) -> jsonb
```

Simple wrapper that auto-creates a batch. Equivalent to calling waterfall with `NULL` batch_id.

### `fn_undo_batch_detailed`

```sql
fn_undo_batch_detailed(p_batch_id uuid) -> jsonb
```

Enhanced undo with more detailed statistics:
```json
{
  "success": true,
  "batch_id": "...",
  "reverted": 8,
  "skipped_locked": 2,
  "already_reverted": 0
}
```

### `fn_get_categorization_stats`

```sql
fn_get_categorization_stats(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
) -> jsonb
```

Returns categorization statistics:
```json
{
  "date_range": {"start": "2026-01-01", "end": "2026-01-31"},
  "total": 100,
  "categorized": 85,
  "uncategorized": 15,
  "locked": 20,
  "by_source": {"rule": 50, "payee_memory": 20, "plaid": 10, "manual": 5},
  "categorization_rate": 85.0
}
```

---

## TypeScript Wrappers

All stored procedures have TypeScript wrappers in `lib/categorization/ruleEngine.ts`:

```typescript
import { 
  triggerCategorizationWaterfall,
  categorizeTransactionsSimple,
  undoBatchDetailed,
  getCategorizationStats 
} from "@/lib/categorization";

// Categorize transactions
const result = await triggerCategorizationWaterfall(transactionIds);

// With batch tracking (after migration)
const result = await triggerCategorizationWaterfall(transactionIds, batchId);

// Get stats
const stats = await getCategorizationStats();

// Undo a batch
const undoResult = await undoBatchDetailed(batchId);
```

**Backward Compatibility:** Wrappers automatically fall back to basic functions if enhanced versions aren't deployed.

---

## Deployment

### Apply Migration

```bash
# Via Supabase CLI
supabase db push

# Or run SQL directly in Supabase Dashboard
# Copy contents of supabase/migrations/20260103_stored_procedures_enhanced.sql
```

### Verify Deployment

```sql
-- Check available functions
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE 'fn_%';
```

---

## Related Documentation

- [MVP Categorization Plan](./official-plan-synthesis_mvp_categorization_ai2.md) - Section L
- [Audit Log](./audit_log.md)
- [Database Schema](../db-schema.md)
