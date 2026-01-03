---
description: Finish and polish the Dashboard page (trend sparkline, overspent categories, selectors) per docs/financial-command-center-overview.md and cashflow-calculations.md.
auto_execution_mode: 1
---

## Context to re-read (source of truth)

- `docs/financial-command-center-overview.md` (Dashboard + Cashflow + Safe-to-Spend)
- `docs/db-schema.md` (`transactions`, `accounts`, `budget_targets`, `categories`, `expected_inflows`)
- `.windsurf/paths/cashflow-calculations.md`

## Current implementation (starting point)

- Dashboard route: `app/page.tsx` (nav points Dashboard to `/`)
- Cards:
  - `components/dashboard/SafeToSpendCard.tsx`
  - `components/dashboard/CashflowCard.tsx`
  - `components/dashboard/OutstandingInflowsCard.tsx`
  - `components/dashboard/AlertsCard.tsx`
- Data:
  - `lib/queries.ts` -> `getDashboardData(month)`

## Goals

1. Add **month selector** (view historical months).
2. Add **net cashflow trend** for last 3–6 months (sparkline).
3. Add **Top 3 overspent categories vs budget** card.
4. Ensure **calculation correctness**:
   - filter to `accounts.include_in_cashflow = TRUE`
   - exclude `status != 'posted'`
   - exclude `is_transfer = TRUE`
   - exclude `is_split_parent = TRUE`
   - handle refunds correctly (do not `abs()` during aggregation)

## Steps

1. Update data access for correctness
   - In `lib/queries.ts`, update `getDashboardData(month)` to ensure it filters to cashflow accounts.
     - Preferred approach: query `transactions` with an inner join to `accounts` and filter `accounts.include_in_cashflow = true`.
   - Ensure calculations use **signed amounts** for net cashflow.
     - Use `Math.abs()` only when presenting “expense magnitude” in the UI.

2. Add month selector to Dashboard
   - In `app/page.tsx`, add a month selector similar to `components/budget/MonthSelector.tsx`.
   - Drive `getDashboardData(selectedMonth)` + `getExpectedInflows(selectedMonth)` from this state.

3. Implement cashflow trend (last 6 months)
   - Add a new query helper in `lib/queries.ts` (or a dedicated file under `lib/`) that:
     - For the last N months, computes monthly net cashflow.
     - Use client-side aggregation first (fetch transactions for the whole window, then group by month).
   - Add a small dashboard component `components/dashboard/CashflowTrendCard.tsx`.
     - Render a simple sparkline or compact bar chart.
     - Keep the UI clean and “card-like” with Tailwind.

4. Implement “Top 3 overspent categories vs budget”
   - Add a query helper that computes budget vs actual per category for a month using:
     - `budget_targets` joined to `categories`
     - `transactions` grouped by `life_category_id`
   - Filter to expense categories (exclude `cashflow_group = 'Income'` and transfers).
   - Sort by most over budget (`actual - expected` descending) and take top 3.
   - Add `components/dashboard/OverspentCategoriesCard.tsx`.

5. Validate UI states
   - Loading skeletons (already present on Dashboard) should also cover new cards.
   - Empty states:
     - no budget targets -> overspent card should show a helpful message
     - no transactions -> trend card should show “No data”

## Success criteria (manual checklist)

- Dashboard loads without console errors.
- Selecting prior months changes:
  - cashflow card month label
  - outstanding inflows list
  - overspent categories
- Trend chart shows 3–6 months and the current month matches the cashflow card.
- Refund test:
  - add a positive transaction in an expense category and verify it reduces the month’s net spending and improves variance.

## Optional follow-ups

- Add unit tests for aggregation helpers (refunds, splits, transfers, excluded accounts).
- Performance optimization later: move monthly aggregates into a Postgres view/RPC if needed.
