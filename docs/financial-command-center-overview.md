# Financial Command Center – Overview

## Purpose

Provide a single, trustworthy view of:

- **Monthly net cashflow** (Income – all spending and savings)
- **Weekly Safe-to-Spend** for discretionary spending
- **Expected but missing income** (rental payments, T-Mobile reimbursements)
- Status of debts and key accounts

This is a personal tool for a single household (Brett + Ashley), not a multi-tenant SaaS.

---

## Key Concepts

### 1. Accounts

- All accounts (checking, savings, credit cards, loans, properties, Venmo, HSA, etc.) live in a single `accounts` table.
- Important fields:
  - `balance_class`: `Asset` or `Liability`
  - `account_group`: `Cash`, `Savings`, `Debt`, `Investment`, `Property`, `Vehicle`, `Crypto`, etc.
  - `owner`: `Brett`, `Ashley`, `Joint`
  - `is_primary_cashflow`: `TRUE` for AFCU checking (command center)
  - `include_in_cashflow`: whether to include this account in cashflow calculations.

### 2. Categories and Groups

Each transaction gets:

- a **category** (e.g., `Groceries`, `Restaurants`, `Home Rental Income`)
- a **life_group** (e.g., `Living`, `Kids`, `Utilities`, `Business`, `Discretionary`)
- a **flow_type**: `Income`, `Expense`, or `Transfer`
- a **cashflow_group**:

  - `Income`
  - `Fixed` (mortgage, phone, some utilities)
  - `Variable Essentials` (groceries, basic utilities, gas, core healthcare)
  - `Discretionary` (restaurants, family fun, travel, non-essential subscriptions)
  - `Debt` (loan payments, interest)
  - `Savings/Investing` (HSA contributions, emergency fund, Betterment, extra principal payments)
  - `Business` (rental utilities, Turo expenses)
  - `Transfer` (internal moves like checking → savings, Venmo cashouts)
  - `Detractors` (fees, unneeded subscriptions)
  - `Other`

The `categories` table encodes this mapping.

### 3. Flags on Transactions

Key boolean flags per transaction:

- `is_transfer`: internal money moves that should **not** affect net cashflow.
- `is_pass_through`: flows like T-Mobile reimbursements where Brett fronts the payment but gets reimbursed.
- `is_business`: business-related items (rental, Turo, etc.).
- `category_locked`: true if manually overridden in the UI (AI cannot change).

These drive filtering and cashflow logic.

---

## Cashflow and Safe-to-Spend Logic

### Included vs Excluded

- **Included in cashflow:**
  - Accounts where `include_in_cashflow = TRUE` (AFCU checking, active credit cards, loans, etc.)
- **Excluded from cashflow:**
  - 401k, HSA investments, Betterment, property/vehicle asset rows, or any account with `include_in_cashflow = FALSE`.

### Net Cashflow (per month)

For a calendar month **M**:

1. Take transactions where:
   - `status = 'posted'`
   - `is_transfer = FALSE`
   - `accounts.include_in_cashflow = TRUE`

2. Sum amounts by `cashflow_group`. Amounts are normalized:
   - Income = positive
   - Expenses and savings = negative

3. Net cashflow formula:

   > **NetCashflow(M) = Income + Fixed + Variable Essentials + Discretionary + Debt + Savings/Investing + Business**

If NetCashflow(M) < 0 → cashflow negative for that month.

### Safe-to-Spend (per week)

1. Compute **Monthly Discretionary Budget** from `budget_targets`:

   - Sum planned amounts where `cashflow_group = 'Discretionary'`.

2. Convert to weekly target:

   - `WeeklyDiscretionaryTarget = MonthlyDiscretionaryBudget / 4.33`

3. For a given week (Mon–Sun):

   - `DiscretionarySpentThisWeek = ABS(sum of amounts)` for posted transactions where:
     - `cashflow_group = 'Discretionary'`
     - `is_transfer = FALSE`
     - `is_pass_through = FALSE`
     - `date` in current week
     - account included in cashflow

4. Safe-to-Spend:

   > **SafeToSpendThisWeek = WeeklyDiscretionaryTarget – DiscretionarySpentThisWeek**

This number is the headline figure on the Dashboard.

### Expected Income Not Received

Using `expected_inflows` and `transactions`:

For each expected inflow row (e.g., Stephani rent, Rachel rent, Fife T-Mobile share):

- `Expected = amount` for the month.
- `Actual = SUM(transactions.amount)` in that month where:
  - `counterparty_id` and `category_id` match.
- `Outstanding = max(Expected – Actual, 0)`

The Dashboard shows:

- Total outstanding for the month
- Breakdown by tenant / T-Mobile family.

---

## Screens and their Data Needs

### Dashboard

- Monthly net cashflow summary with sparkline of last 3–6 months.
- Current Safe-to-Spend for this week.
- Cards:
  - “Cashflow Status” (green/red)
  - “Outstanding Inflows”
  - “Top 3 overspent categories vs budget”.

### Budget Planner

- For each category with `budget_targets`:
  - `Expected` (from `budget_targets`)
  - `Actual` (sum of `transactions` for that category in the month)
- Grouped visually into:
  - Income
  - Fixed
  - Debt
  - Variable Essentials
  - Discretionary
  - Savings / Investing (optional in v1)

### Transactions

- Master list with:
  - Date, Description, Category, Account, Amount
  - Flags (Transfer, Pass-Through, Business)
- Filters for:
  - Month / custom range
  - Account
  - Cashflow group
  - flags

Inline edit of category and flags updates `transactions` and `category_overrides`.

This overview plus `docs/db-schema.md` should be enough context for Windsurf to implement UI and logic correctly.
