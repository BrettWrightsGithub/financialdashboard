---
description: Implement manual transaction splitting with parent-child model per `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` (FR-10, A20).
auto_execution_mode: 1
---

## Testing Reference

Follow `docs/testing/testing_strategy.md` for all testing requirements:
- **Unit tests:** `lib/categorization/transactionSplitting.test.ts`
- **Component tests:** Split modal form inputs, amount validation
- **E2E tests:** Full split flow - open modal, add splits, verify children created

## Steps

1. Re-read:
   - `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` (FR-10, A20, A7)
   - `docs/db-schema.md`

2. Ensure `transactions` table has:
   - `parent_transaction_id` (UUID, FK to transactions, nullable)
   - `is_split_parent` (boolean, default false)
   - `split_amount` (numeric, nullable – the portion of parent amount)

3. Add migration for new columns if needed.

4. Create `lib/categorization/transactionSplitting.ts`:
   - `splitTransaction(parentId: string, splits: { amount: number, categoryId: string }[]): Transaction[]`
     - Validates splits sum to parent amount.
     - Creates child transactions with `parent_transaction_id` set.
     - Marks parent as `is_split_parent = TRUE`.
     - Each child gets its own category.
   - `unsplitTransaction(parentId: string): void`
     - Deletes child transactions.
     - Resets parent `is_split_parent = FALSE`.
   - `getSplitChildren(parentId: string): Transaction[]`

5. Add API route `app/api/transactions/split/route.ts`:
   - POST: Create splits for a parent transaction.
   - DELETE: Unsplit (remove children, reset parent).

6. Create UI component `components/transactions/SplitModal.tsx`:
   - Opens when user clicks "Split" on a transaction row.
   - Shows parent amount and allows adding split rows.
   - Each row: amount input + category dropdown.
   - Validates total equals parent amount.
   - Submit creates child transactions.

7. Update Transactions page:
   - Add "Split" action button on eligible rows (not already a child).
   - Show split children indented under parent with visual grouping.
   - Allow editing individual split categories.

8. Update cashflow calculations:
   - When `is_split_parent = TRUE`, exclude parent from calculations.
   - Include child transactions with their respective categories.

9. Write tests:
   - Split amounts must sum to parent.
   - Children inherit parent date and account.
   - Unsplit restores parent to normal state.
   - Cashflow correctly uses children, not parent.

10. Document in `docs/categorization/transaction_splitting.md`.

11. **Puppeteer Verification:** Use the Puppeteer MCP server to:
    - Navigate to http://localhost:3000/transactions
    - Take a screenshot of the split modal
    - Test splitting a transaction into multiple categories
    - Verify split children display indented under parent
    - Test unsplit functionality
