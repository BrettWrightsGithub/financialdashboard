---
description: Implement transfer detection and reimbursement handling per `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` (FR-07, FR-08, FR-09).
auto_execution_mode: 1
---

## Steps

1. Re-read:
   - `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` (FR-07, FR-08, FR-09, Risks section)
   - `docs/financial-command-center-overview.md` (is_transfer, is_pass_through flags)

2. Ensure `transactions` table has:
   - `is_transfer` (boolean, default false)
   - `is_pass_through` (boolean, default false)
   - `reimbursement_of_id` (UUID, FK to transactions, nullable)

3. Create `lib/categorization/transferDetection.ts`:
   - `detectInternalTransfer(transaction: Transaction, allTransactions: Transaction[]): boolean`
     - Heuristic: Same amount (opposite sign) within 3 days between same-owner accounts.
     - Returns TRUE if likely internal transfer.
   - `isKnownP2PService(merchantName: string): boolean`
     - Whitelist: Venmo, Zelle, PayPal, Cash App.
   - `classifyP2PTransaction(transaction: Transaction): 'transfer' | 'expense' | 'income'`
     - If between same-owner accounts → transfer.
     - If external P2P → default to expense (user can override).

4. Create `lib/categorization/reimbursementHandler.ts`:
   - `linkReimbursement(reimbursementTxId: string, originalExpenseTxId: string): void`
     - Sets `reimbursement_of_id` on the reimbursement transaction.
     - Optionally sets same category as original expense.
   - `getReimbursementPairs(month: string): { original: Transaction, reimbursement: Transaction }[]`
     - For reporting: shows linked pairs.

5. Add API routes:
   - `app/api/transactions/mark-transfer/route.ts` – POST to toggle `is_transfer`.
   - `app/api/transactions/link-reimbursement/route.ts` – POST to link reimbursement to original.

6. Update Transactions page:
   - Add "Mark as Transfer" toggle in row actions.
   - Add "Link Reimbursement" action that opens a modal to select the original expense.
   - Show linked reimbursements with visual indicator (e.g., chain icon).

7. Update cashflow calculations in `lib/cashflow.ts`:
   - Exclude `is_transfer = TRUE` from net cashflow.
   - For reimbursements: net against original category or show as separate line item.

8. Run the Transfer Heuristic Test from the MVP doc:
   - Manually label 50 likely transfers.
   - Run heuristic, measure false positive rate.
   - Target: <10% false positives.

9. Write tests:
   - Internal transfer detection accuracy.
   - P2P classification (Venmo expense vs Venmo transfer).
   - Reimbursement linking and netting.

10. Document in `docs/categorization/transfers_and_reimbursements.md`.
