---
description: Finish and validate Budget Planner behavior (budget vs actual correctness, filters, refunds, split handling) per docs/financial-command-center-overview.md.
auto_execution_mode: 1
---

## Context to re-read (source of truth)

- `docs/financial-command-center-overview.md` (Budget Planner section)
- `docs/db-schema.md` (`budget_targets`, `transactions`, `categories`, `accounts`)
- `.windsurf/paths/cashflow-calculations.md`

## Database interaction rules (must follow)

- **Read-only first:** Use Supabase MCP read tools to inspect tables/columns and run `SELECT` queries before proposing any writes.
- **Schema changes:** If you add/alter a table, column, index, view, function, or RPC:
  - Update `docs/db-schema.md` in the same change set.
  - Add a new migration under `supabase/migrations/` (never ad-hoc DDL).
  - Re-generate types if your workflow includes that step.
- **Writes require intent:** Any `INSERT`/`UPDATE`/`DELETE`/migration should be explicitly called out as a user-confirm step.

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

## Testing plan (frontend + backend)

- **Unit tests (automated, checked into repo):**
  - Use `vitest` (`npm run test`).
  - Focus on pure helpers (e.g., actual aggregation, variance rules for Income vs Expense).
  - Add/extend tests under `lib/`.
- **Backend verification (automated via Supabase MCP):**
  - Use Supabase MCP to:
    - Inspect schema (`list_tables`).
    - Run read-only `SELECT` sanity checks for a known month:
      - posted count for month
      - transfers excluded
      - split parents excluded
      - cashflow accounts included
- **UI smoke tests (manual by user):**
  - Start the app (`npm run dev`).
  - Visit `/budget-planner`.
  - Change month; table and totals should update.
  - Verify empty state messaging when no targets exist.
- **E2E automation with Playwright:**
  - Use the Playwright MCP server for automated UI testing:
    - `mcp1_browser_navigate` to visit `http://localhost:3000/budget-planner`
    - `mcp1_browser_snapshot` to capture page state
    - `mcp1_browser_click` to interact with month selector
    - `mcp1_browser_wait_for` to wait for data updates
    - `mcp1_browser_evaluate` to verify budget calculations match expectations
  - Example test flow:
    1. Navigate to budget planner
    2. Take snapshot to verify initial state
    3. Click month selector, choose different month
    4. Wait for loading states to complete
    5. Verify budget table updates with new data
    6. Verify totals (Expected, Actual, Variance) recalculate correctly
    7. Verify empty state shows when no budget targets exist

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

4. Add/extend unit tests
   - Add tests that cover:
     - refunds (positive amounts in expense categories)
     - split-parent exclusion
     - transfer exclusion
     - cashflow account inclusion
   - Run `npm run test`.

5. Run backend sanity checks (Supabase MCP)
   - Use the Supabase MCP server to:
     - confirm required tables exist
     - run a few `SELECT` queries for a known month to confirm filters are correct

## Success criteria (manual checklist)

- For a month with budget targets:
  - totals show reasonable Net Planned
  - income vs expenses totals compute correctly
- Refund test:
  - a positive amount in an expense category reduces Actual and improves variance
- Split test:
  - split parent is not counted, children are

## Finalization

- When this workflow’s steps are complete and validated, rename this file to:
  - `17_budget_planner_finish_and_correctness_COMPLETED.md`

## Optional follow-ups

- Add unit tests for the aggregation helper to prevent regressions.
