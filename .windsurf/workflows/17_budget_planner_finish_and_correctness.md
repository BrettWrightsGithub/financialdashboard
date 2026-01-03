---
description: Finish and validate Budget Planner behavior (budget vs actual correctness, filters, refunds, split handling) per docs/financial-command-center-overview.md.
auto_execution_mode: 1
---

## Context to re-read (source of truth)

- `docs/financial-command-center-overview.md` (Budget Planner section)
- `docs/db-schema.md` (`budget_targets`, `transactions`, `categories`, `accounts`)
- `.windsurf/paths/cashflow-calculations.md`

## Current implementation (starting point)

- Route: `app/budget-planner/page.tsx`
- Components:
  - `components/budget/MonthSelector.tsx`
  - `components/budget/BudgetTable.tsx`
- Data:
  - `lib/queries.ts` -> `getBudgetSummary(month)`

## Goals

1. Ensure budget-vs-actual numbers are **correct** and match the system’s cashflow conventions.
2. Handle edge cases: refunds, transfers, split parents.
3. Keep UI clean, grouped by cashflow group.

## Key rules

- Exclude:
  - `status != 'posted'`
  - `is_transfer = TRUE`
  - `is_split_parent = TRUE`
- Prefer filtering to `accounts.include_in_cashflow = TRUE` so budget aligns with Dashboard cashflow.
- Refund correctness:
  - Do **not** apply `Math.abs()` during aggregation.
  - Use signed sums and transform only for display.

## Steps

1. Fix `getBudgetSummary(month)` aggregation
   - In `lib/queries.ts`, update `getBudgetSummary(month)` to:
     - join `transactions` to `accounts` and filter `accounts.include_in_cashflow = true`
     - exclude `is_split_parent = true`
     - aggregate actuals by `life_category_id` using signed sums
   - Confirm how you want to treat `is_pass_through`:
     - Default recommendation: exclude pass-through from “Actual” *or* add a toggle.

2. Validate BudgetTable display math
   - In `components/budget/BudgetTable.tsx`, ensure:
     - Expected/Actual/Variance use consistent sign rules
     - Income rows behave differently than expense rows (already partially handled)
     - Refunds reduce expense actuals

3. Add optional UI enhancements (only if desired)
   - Add a small toggle: “Include pass-through”
   - Add a quick link to Transactions filtered to the selected month (optional)

## Success criteria (manual checklist)

- For a month with budget targets:
  - totals show reasonable Net Planned
  - income vs expenses totals compute correctly
- Refund test:
  - a positive amount in an expense category reduces Actual and improves variance
- Split test:
  - split parent is not counted, children are

## Optional follow-ups

- Add unit tests for the aggregation helper to prevent regressions.
