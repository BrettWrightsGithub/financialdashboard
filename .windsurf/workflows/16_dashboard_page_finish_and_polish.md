---
description: Finish and polish the Dashboard page (trend sparkline, overspent categories, selectors) per docs/financial-command-center-overview.md and cashflow-calculations.md.
auto_execution_mode: 1
---

## Context to re-read (source of truth)

- `docs/financial-command-center-overview.md` (Dashboard + Cashflow + Safe-to-Spend)
- `docs/db-schema.md` (`transactions`, `accounts`, `budget_targets`, `categories`, `expected_inflows`)
- `.windsurf/paths/cashflow-calculations.md`

## Database interaction rules (must follow)

- **Read-only first:** Use Supabase MCP read tools to inspect tables/columns and run `SELECT` queries before proposing any writes.
- **Schema changes:** If you add/alter a table, column, index, view, function, or RPC:
  - Update `docs/db-schema.md` in the same change set.
  - Add a new migration under `supabase/migrations/` (never ad-hoc DDL).
  - Re-generate types if your workflow includes that step.
- **Writes require intent:** Any `INSERT`/`UPDATE`/`DELETE`/migration should be explicitly called out as a user-confirm step.

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

## Testing plan (frontend + backend)

- **Unit tests (automated, checked into repo):**
  - Use `vitest` (`npm run test`).
  - Focus on pure functions/helpers (e.g., monthly aggregation, overspent computation, refund handling, split-parent exclusion).
  - Add/extend tests under `lib/` (keep logic pure where possible so it’s testable without Supabase).
- **Backend verification (automated via Supabase MCP):**
  - Use Supabase MCP to:
    - Inspect schema (`list_tables`, optionally `list_extensions`).
    - Run read-only `SELECT` sanity checks for a known month:
      - Posted vs pending counts
      - Transfers excluded
      - Split parents excluded
      - Cashflow accounts included
- **UI smoke tests (manual by user):**
  - Start the app (`npm run dev`).
  - Visit `/`.
  - Validate month selector switches data.
  - Validate trend card appears and matches the cashflow card for current month.
  - Validate overspent card renders top 3 (or shows a clear empty state).
- **E2E automation with Playwright:**
  - Use the Playwright MCP server for automated UI testing:
    - `mcp1_browser_navigate` to visit `http://localhost:3000`
    - `mcp1_browser_snapshot` to capture page state
    - `mcp1_browser_click` to interact with month selector
    - `mcp1_browser_wait_for` to wait for data updates
    - `mcp1_browser_evaluate` to verify card values match expectations
  - Example test flow:
    1. Navigate to dashboard
    2. Take snapshot to verify initial state
    3. Click month selector, choose previous month
    4. Wait for loading states to complete
    5. Verify cashflow card shows different month
    6. Verify trend chart displays historical data
    7. Verify overspent categories update or show empty state 

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

6. Add/extend unit tests
   - Add tests that cover:
     - refunds (positive amounts in expense categories)
     - split-parent exclusion
     - transfer exclusion
     - cashflow account inclusion
   - Run `npm run test`.

7. Run backend sanity checks (Supabase MCP)
   - Use the Supabase MCP server to:
     - confirm required tables exist
     - run a few `SELECT` queries for the current month to confirm filters are correct

## Success criteria (manual checklist)

- Dashboard loads without console errors.
- Selecting prior months changes:
  - cashflow card month label
  - outstanding inflows list
  - overspent categories
- Trend chart shows 3–6 months and the current month matches the cashflow card.
- Refund test:
  - add a positive transaction in an expense category and verify it reduces the month’s net spending and improves variance.

## Finalization

- When this workflow’s steps are complete and validated, rename this file to:
  - `16_dashboard_page_finish_and_polish_COMPLETED.md`

## Optional follow-ups

- Add unit tests for aggregation helpers (refunds, splits, transfers, excluded accounts).
- Performance optimization later: move monthly aggregates into a Postgres view/RPC if needed.
