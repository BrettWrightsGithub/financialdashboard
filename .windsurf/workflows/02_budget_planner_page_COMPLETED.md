---
description: Implement the Budget Planner UI and logic according to the mockups and the schema in `docs/db-schema.md` and `docs/financial-command-center-overview.md`.
auto_execution_mode: 1
---

## Steps

1. Re-read:
   - `docs/financial-command-center-overview.md` (Budget Planner section)
   - `docs/db-schema.md` (`budget_targets`, `transactions`, `categories`)
2. In `app/(routes)/budget-planner/page.tsx`, implement a layout with:
   - A top summary card showing "Net Planned" for the selected month.
   - Sections for Income, Fixed, Debt, Variable Essentials, Discretionary (and optionally Savings/Investing).
3. For each section:
   - Query `budget_targets` joined with `categories` for the selected month.
   - Query `transactions` to calculate actuals per category for that month.
   - Render rows with:
     - Category name
     - Expected amount
     - Actual amount (colored green or red depending on over/under).
4. Add a month selector (dropdown or date picker) to change the current planning month.
5. Create a helper function in `lib/cashflow.ts` that:
   - Given month + all relevant data, computes:
     - Net planned (Income – all planned expenses/savings)
     - Actual net cashflow for that month.
6. Display "Expected income not yet received" summary using `expected_inflows` and `transactions`.
7. Ensure the page uses reusable table components from `components/` where appropriate (e.g., a `<BudgetSection>` component).
8. Keep the code commented and straightforward so a low-code developer can follow and adjust values later.
