---
description: Implement bulk editing and review queue for uncategorized/low-confidence transactions per `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` (FR-11, FR-13).
auto_execution_mode: 1
---

## Steps

1. Re-read:
   - `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` (FR-11, FR-13, C13)

2. Create `lib/categorization/reviewQueue.ts`:
   - `getReviewQueueTransactions(filters?: { month?: string }): Transaction[]`
     - Returns transactions where:
       - `category_id IS NULL` (uncategorized), OR
       - `category_confidence < 0.7` (low confidence), OR
       - `category_source = 'plaid'` AND flagged as ambiguous (P2P, large amount).
   - `getReviewQueueCount(): number` – for badge display.

3. Add `category_confidence` column to `transactions` if not present:
   - Numeric (0.0 to 1.0), populated from Plaid confidence or rule confidence.

4. Create Review Queue page at `app/(routes)/review-queue/page.tsx`:
   - Shows only transactions needing attention.
   - Sorted by date (newest first) or confidence (lowest first).
   - Quick actions: Approve suggested category (1-tap), Override, Split, Mark as Transfer.

5. Implement bulk editing in `lib/categorization/bulkEdit.ts`:
   - `bulkAssignCategory(transactionIds: string[], categoryId: string): void`
     - Updates all selected transactions.
     - Sets `category_source = 'manual'`, `category_locked = TRUE`.
     - Creates `category_overrides` records.
     - Optionally saves payee mappings for unique payees.

6. Add API route `app/api/transactions/bulk-edit/route.ts`:
   - POST: `{ transactionIds: string[], categoryId: string }` → applies bulk category.

7. Update Transactions page with bulk edit UI:
   - Checkbox column for multi-select.
   - "Select All" checkbox in header.
   - Bulk action bar appears when items selected:
     - "Assign Category" dropdown.
     - "Mark as Transfer" button.
     - "Clear Selection" button.

8. Add Review Queue link to navbar with badge showing count.

9. Track time-to-review metric:
   - Log when user enters review queue and when they finish.
   - Target: <5 min/week for corrections.

10. Write tests:
    - Bulk edit applies to all selected transactions.
    - Review queue filters correctly.
    - Bulk edit respects `category_locked` (skips locked transactions).

11. Document in `docs/categorization/bulk_edit_review_queue.md`.
