# Bulk Edit & Review Queue

**Status:** Implemented | **Date:** 2026-01-02

---

## Overview

The Review Queue and Bulk Edit features help users efficiently manage transactions that need attention, reducing the time spent on manual categorization to <5 min/week (per FR-13, C11).

## Review Queue

### What Goes in the Queue

Transactions appear in the review queue if they meet any of these criteria:

1. **Uncategorized** - `life_category_id IS NULL`
2. **Low Confidence** - `category_confidence < 0.7`
3. **Large Plaid-categorized** - `category_source = 'plaid'` AND `amount < -$500`

### Features

- **Stats Bar** - Shows total needing review, uncategorized count, low confidence count
- **Sorting** - By date, confidence, or amount
- **Quick Actions** - Assign category directly from dropdown
- **Bulk Selection** - Checkbox column with "Select All"
- **Bulk Actions** - Assign category, approve, mark as transfer

### API Endpoints

**GET /api/review-queue**
- `?countOnly=true` - Returns just the count (for navbar badge)
- `?statsOnly=true` - Returns breakdown stats
- `?month=YYYY-MM` - Filter by month
- `?sortBy=date|confidence|amount` - Sort field
- `?sortOrder=asc|desc` - Sort direction

## Bulk Edit

### Actions Available

1. **Assign Category** - Apply a category to all selected transactions
   - Sets `category_source = 'manual'`
   - Sets `category_locked = true`
   - Optionally creates payee memory entries

2. **Approve** - Lock transactions with their current suggested category
   - Only works on transactions that have a category but aren't locked

3. **Update Flags** - Set is_transfer, is_pass_through, or is_business

### API Endpoint

**POST /api/transactions/bulk-edit**

```json
{
  "action": "assign_category" | "update_flags" | "approve",
  "transaction_ids": ["uuid1", "uuid2", ...],
  "category_id": "uuid",  // for assign_category
  "flags": { "is_transfer": true },  // for update_flags
  "learn_payee": true  // optional, creates payee memory
}
```

**Response:**
```json
{
  "success": true,
  "updated": 5,
  "skipped": 2,
  "message": "Updated 5 transactions, skipped 2 locked"
}
```

### Behavior Notes

- **Locked transactions are skipped** - Bulk edit respects `category_locked = true`
- **Payee memory** - When `learn_payee = true`, creates `category_overrides` entries for unique payees
- **Audit trail** - All changes set `category_source = 'manual'`

## Navigation

The navbar includes a "Review Queue" link with a badge showing the count of transactions needing review. The badge:
- Updates every 30 seconds
- Shows "99+" for counts over 99
- Only appears when count > 0

## Implementation Files

| File | Purpose |
|------|---------|
| `lib/categorization/reviewQueue.ts` | Queue filtering and stats logic |
| `lib/categorization/bulkEdit.ts` | Bulk edit operations |
| `app/api/review-queue/route.ts` | Review queue API |
| `app/api/transactions/bulk-edit/route.ts` | Bulk edit API |
| `app/review-queue/page.tsx` | Review queue page UI |
| `components/Navigation.tsx` | Navbar with badge |

## Success Metrics

Per the categorization MVP requirements:
- **Target:** Users spend <5 min/week on corrections
- **Measure:** Track time from entering review queue to completion

## Related Documentation

- [FR-11, FR-13, C13 in official-plan-synthesis_mvp_categorization_ai2.md](./official-plan-synthesis_mvp_categorization_ai2.md)
- [Transaction Splitting](./transaction_splitting.md)
