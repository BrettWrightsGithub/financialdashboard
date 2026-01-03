# Audit Log & Explainability

This document describes the audit logging system for transaction categorization, providing full traceability and explainability for all category changes.

## Overview

Every category change is logged to the `category_audit_log` table, enabling:
- **Explainability**: Users see badges indicating how each transaction was categorized
- **Audit trail**: Full history of all category changes per transaction
- **Debugging**: Admin view to troubleshoot categorization issues
- **Undo support**: Batch operations can be reverted using audit history

## Database Schema

### category_audit_log

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| transaction_id | UUID | FK to transactions |
| previous_category_id | UUID | Previous category (nullable for first assignment) |
| new_category_id | UUID | New category |
| change_source | ENUM | Source of change (see below) |
| rule_id | UUID | FK to categorization_rules (if rule-based) |
| confidence_score | NUMERIC(4,3) | Confidence 0.000-1.000 |
| changed_by | TEXT | 'system' or user identifier |
| batch_id | UUID | FK to rule_application_batches |
| notes | TEXT | Additional context |
| is_reverted | BOOLEAN | TRUE if change was undone |
| created_at | TIMESTAMPTZ | When change occurred |

### Change Sources

- `plaid` - Categorized by Plaid's ML
- `rule` - Applied by user-defined rule
- `manual` - Manual user override
- `payee_memory` - Learned from previous user categorizations
- `bulk_edit` - Bulk category assignment
- `reimbursement_link` - Linked as reimbursement
- `system` - System operations (e.g., pending→posted handover)

## UI Components

### CategorySourceBadge

Displays a colored badge indicating categorization source:
- **Plaid** (blue) - ML-categorized
- **Rule** (purple) - Shows rule name on hover
- **Manual** (green) - User-set
- **Learned** (amber) - Payee memory
- **Bulk** (indigo) - Bulk edit
- **Linked** (teal) - Reimbursement link

### AuditHistoryModal

Timeline view showing all category changes for a transaction:
- Chronological list of changes
- Previous → New category for each change
- Source badge and rule name
- Confidence score if available
- Timestamp and who made the change

## API Endpoints

### GET /api/transactions/[id]/audit
Returns audit history for a transaction.

**Response:**
```json
{
  "history": [
    {
      "id": "uuid",
      "transactionId": "uuid",
      "previousCategoryId": "uuid",
      "previousCategoryName": "Groceries",
      "newCategoryId": "uuid",
      "newCategoryName": "Restaurants",
      "changeSource": "manual",
      "ruleName": null,
      "confidenceScore": null,
      "changedBy": "user",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ]
}
```

## Library Functions

### logCategoryChange(params)
Logs a category change to the audit log.

```typescript
await logCategoryChange({
  transactionId: "uuid",
  previousCategoryId: "old-uuid",
  newCategoryId: "new-uuid",
  source: "manual",
  changedBy: "user"
});
```

### getAuditHistory(transactionId)
Returns all audit entries for a transaction.

### getAuditLogByDateRange(startDate, endDate, options)
Query audit log with filtering and pagination.

## Integration Points

All categorization functions should call `logCategoryChange()`:

1. **applyRules.ts** - Log when rule matches
2. **userOverride.ts** - Log manual changes
3. **payeeMemory.ts** - Log memory-based categorization
4. **reimbursementHandler.ts** - Log reimbursement links
5. **fn_apply_user_override** - DB function logs changes

## Admin Views

### /admin/audit-log
Filterable view of all category changes:
- Filter by date range
- Filter by source type
- Filter by transaction
- Export for debugging
