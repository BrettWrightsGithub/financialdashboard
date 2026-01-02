---
description: Build the Dashboard page with monthly net cashflow, Safe-to-Spend, and outstanding inflows cards per `docs/financial-command-center-overview.md`.
auto_execution_mode: 1
---

## Steps

1. Re-read:
   - `docs/financial-command-center-overview.md` (Dashboard section, Cashflow and Safe-to-Spend Logic)
   - `docs/db-schema.md` (`transactions`, `accounts`, `budget_targets`, `expected_inflows`, `categories`)

2. In `app/(routes)/dashboard/page.tsx`, implement the main layout with:
   - A headline "Safe-to-Spend This Week" card showing the computed value.
   - A "Cashflow Status" card (green if positive, red if negative) for the current month.
   - An "Outstanding Inflows" card listing expected income not yet received.
   - A "Top 3 Overspent Categories" card comparing actuals vs budget.

3. Create or extend `lib/cashflow.ts` with functions:
   - `getNetCashflow(month: string)`: Computes Income + Fixed + Variable Essentials + Discretionary + Debt + Savings/Investing + Business for posted, non-transfer transactions in cashflow accounts.
   - `getSafeToSpend(weekStart: Date, weekEnd: Date)`: Computes WeeklyDiscretionaryTarget – DiscretionarySpentThisWeek.
   - `getOutstandingInflows(month: string)`: For each `expected_inflows` row, computes Expected – Actual.

4. Create a `components/dashboard/` folder with reusable cards:
   - `<SafeToSpendCard />`
   - `<CashflowStatusCard />`
   - `<OutstandingInflowsCard />`
   - `<OverspentCategoriesCard />`

5. Add a sparkline or mini chart showing net cashflow for the last 3–6 months (use a simple charting library like recharts or a lightweight alternative).

6. Ensure all queries filter by:
   - `status = 'posted'`
   - `is_transfer = FALSE`
   - `accounts.include_in_cashflow = TRUE`

7. Add a month/week selector to allow viewing historical data.

8. Test the page with real Supabase data and verify calculations match the formulas in the overview doc.

9. Keep code well-commented so a low-code developer can adjust thresholds or display logic.
