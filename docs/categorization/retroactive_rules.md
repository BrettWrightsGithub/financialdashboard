# Retroactive Rule Application

This document describes how to apply categorization rules to past transactions with preview and undo capabilities.

## Overview

When creating or modifying a rule, users can apply it retroactively to existing transactions:

1. **Preview** - See which transactions would be affected (dry run)
2. **Apply** - Execute the rule on selected transactions
3. **Undo** - Revert all changes from a batch operation

## Database Schema

### rule_application_batches

Tracks each retroactive application for undo support.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| rule_id | UUID | FK to categorization_rules |
| operation_type | TEXT | 'rule_apply', 'waterfall', 'bulk_edit' |
| applied_at | TIMESTAMPTZ | When applied |
| transaction_count | INTEGER | Number affected |
| date_range_start | DATE | Optional filter |
| date_range_end | DATE | Optional filter |
| is_undone | BOOLEAN | TRUE if reverted |
| undone_at | TIMESTAMPTZ | When undone |
| description | TEXT | Description of operation |
| created_by | TEXT | Who initiated |

## Stored Procedures

### fn_apply_rule_retroactive(rule_id, transaction_ids, created_by)

Applies a rule to specified transactions:
1. Creates batch record
2. For each transaction:
   - Skip if `category_locked = TRUE`
   - Skip if already has target category
   - Update category and metadata
   - Log to `category_audit_log` with batch_id
3. Returns batch_id, applied_count, skipped_locked

### fn_undo_batch(batch_id)

Reverts all changes from a batch:
1. Validates batch exists and not already undone
2. For each audit entry in batch:
   - Restore previous category
   - Mark audit entry as reverted
3. Marks batch as undone
4. All operations in single transaction (ACID)

## API Endpoints

### POST /api/rules/preview

Preview rule application (dry run).

**Request:**
```json
{
  "rule_id": "uuid",
  "date_range": {
    "start": "2025-01-01",
    "end": "2025-01-31"
  }
}
```

**Response:**
```json
{
  "ruleId": "uuid",
  "ruleName": "Starbucks → Coffee",
  "matchingTransactions": [
    {
      "id": "uuid",
      "date": "2025-01-15",
      "description": "STARBUCKS #1234",
      "amount": -5.50,
      "currentCategory": "Restaurants",
      "newCategory": "Coffee",
      "isLocked": false
    }
  ],
  "totalMatching": 15,
  "wouldChange": 12,
  "wouldSkipLocked": 3
}
```

### POST /api/rules/apply-retroactive

Apply rule to transactions.

**Request:**
```json
{
  "rule_id": "uuid",
  "transaction_ids": ["uuid1", "uuid2", "..."],
  "created_by": "user"
}
```

**Response:**
```json
{
  "success": true,
  "batch_id": "uuid",
  "applied_count": 12,
  "skipped_locked": 3
}
```

### POST /api/rules/undo-batch

Undo a batch operation.

**Request:**
```json
{
  "batch_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "transactions_reverted": 12
}
```

## Library Functions

### previewRuleApplication(ruleId, dateRange?)

Returns preview without modifying data.

### applyRuleRetroactively(ruleId, transactionIds, createdBy)

Applies rule and creates batch record.

### undoBatch(batchId)

Reverts batch using stored procedure.

### getBatches(options)

Lists batch history with filtering.

## UI Flow

### Apply to Past Transactions Modal

1. User clicks "Apply to Past Transactions" on a rule
2. Modal shows:
   - Date range selector (optional)
   - "Preview" button
3. Preview results show:
   - List of matching transactions
   - Count of changes vs locked
   - Warning about scope
4. "Apply" button (disabled until preview run)
5. Success shows batch_id for undo reference

### Batch History Page (/admin/rules/batches)

Table showing:
- Rule name
- Applied at
- Transaction count
- Status (active/undone)
- Undo button (only if not undone)

## Safety Features

1. **Preview required** - Must preview before applying
2. **Locked transactions respected** - Never overwrites locked
3. **Idempotent** - Re-running skips already-correct categories
4. **ACID undo** - Undo is all-or-nothing
5. **Audit trail** - Every change logged with batch_id
