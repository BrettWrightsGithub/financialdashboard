# Financial Command Center – PRD & Schema

## 1. Overview

Personal financial OS that aggregates multi-bank accounts (Teller, Plaid), Venmo flows, rental + Turo income, T‑Mobile pass‑through, and multiple debts into one **Safe‑to‑Spend** dashboard.

Core stack:
- **DB:** Supabase/Postgres
- **Bank Feeds:** Teller (Chase/others), Plaid (AFCU)
- **Workflows:** n8n
- **UI:** React + Tailwind
- **Email Source:** Gmail (Venmo notifications)

Key outputs:
- Monthly **net cashflow**
- Weekly **Safe‑to‑Spend**
- **Expected income not received** (rent, T‑Mobile)

---

## 2. Database Schema

### 2.1 `accounts`

Single table for Teller, Plaid, Venmo, manual.

| Field                | Type        | Notes |
|----------------------|------------|-------|
| id (PK)              | uuid       | Internal account ID. |
| provider             | text       | `teller`, `plaid`, `manual`, `gmail_venmo`, etc. |
| provider_account_id  | text       | Teller `acc_…`, Plaid `account_id`, or `NULL` for manual. |
| name                 | text       | Raw provider name. |
| display_name         | text       | Human-friendly name (e.g. "AFCU Checking"). |
| institution_id       | text       | Provider institution id, e.g. `security_cu`, `afcu`, `chase`. |
| institution_name     | text       | Bank name, e.g. "America First CU". |
| currency             | text       | `USD` etc. |
| status               | text       | `open` / `closed`. |
| subtype              | text       | Normalized: `checking`, `savings`, `credit_card`, `loan`, `hsa`, `mm`, `property`, `vehicle`, `crypto`, etc. |
| balance_class        | text       | From your mapping: `Asset` / `Liability`. |
| account_group        | text       | For dashboards: `Cash`, `Savings`, `Debt`, `Investment`, `Property`, `Vehicle`, `Crypto`, `Other`. |
| owner                | text       | `Brett`, `Ashley`, `Joint`. |
| is_primary_cashflow  | boolean    | `TRUE` for AFCU checking. |
| include_in_cashflow  | boolean    | Include in cashflow calcs (`TRUE` for most checking/CC/loans, `FALSE` for 401k, HSA investments, etc.). |
| last_four            | text       | Last 4 digits when applicable. |
| ledger_balance       | numeric    | From Teller/Plaid balances. |
| available_balance    | numeric    | From Teller/Plaid balances. |
| current_balance      | numeric    | Main display balance (usually = available for depository, = ledger for cards/loans). |
| credit_limit         | numeric    | For utilization. |
| interest_rate_apr    | numeric    | For debt priority. |
| created_at           | timestamptz| Default now. |
| updated_at           | timestamptz| Updated on sync. |

---

### 2.2 `categories`

Encodes your category, life grouping, and engine-level cashflow grouping.

| Field         | Type  | Example |
|---------------|-------|---------|
| id (PK)       | uuid  | |
| name          | text  | `Groceries`, `Restaurants`, `Home Rental Income`, `Car Rental Expenses` |
| life_group    | text  | From your sheet: `Living`, `Kids`, `Utilities`, `Business`, `Discretionary`, `Detractors`, `Bills`, `Debt`, `Saving`, `Work`, etc. |
| flow_type     | text  | `Income` / `Expense` / `Transfer` (from your `Type`). |
| cashflow_group| text  | Engine group: `Income`, `Fixed`, `Variable Essentials`, `Discretionary`, `Debt`, `Savings/Investing`, `Business`, `Transfer`, `Detractors`, `Other`. |
| is_active     | bool  | Soft deletion. |
| sort_order    | int   | For UI ordering. |

Example mappings:
- `Groceries` → (life_group: `Living`, flow_type: `Expense`, cashflow_group: `Variable Essentials`)
- `Restaurants` → (Discretionary, Expense, Discretionary)
- `Home Rental Income` → (Business, Income, Income)
- `Car Rental Income` → (Primary Income, Income, Income)
- `Car Payment` → (Living, Expense, Debt)
- `Loan Payment` → (Debt, Expense, Debt)
- `Mortgage` → (Debt, Expense, Fixed)
- `Utilities`/`Electricity`/`Gas` → (`Utilities`/`Bills`, Expense, `Variable Essentials`)
- `Phone` → (Bills, Expense, Fixed)
- `Work Projects` → (Discretionary, Expense, Discretionary)
- `Business Expense` / `Car Rental Expenses` → (Business, Expense, Business)
- `Reimbursable` → (Work, Expense, Business)
- `Subscriptions` → (Discretionary, Expense, Discretionary)
- `Unneeded Subscriptions` / `Fees & Charges` → (Detractors, Expense, Detractors)
- `Transfer` → (Transfer Types, Transfer, Transfer)

---

### 2.3 `transactions`

Master ledger from Teller, Plaid, Venmo (Gmail), and manual entries.

| Field                  | Type        | Notes |
|------------------------|------------|-------|
| id (PK)                | uuid       | Internal transaction id. |
| provider               | text       | `teller`, `plaid`, `gmail_venmo`, `manual`, etc. |
| provider_transaction_id| text       | Teller `txn_…`, Plaid `transaction_id`, Gmail `message.id`, etc. |
| account_id             | uuid       | FK → accounts.id. |
| provider_account_id    | text       | Teller/Plaid account id for convenience. |
| date                   | date       | Posting date. |
| amount                 | numeric    | Normalized: negative = outflow, positive = inflow. |
| description_raw        | text       | Raw description (bank/email). |
| description_clean      | text       | Cleaned merchant/payee (post-processing). |
| life_category_id       | uuid       | FK → categories.id (final chosen category). |
| cashflow_group         | text       | Denorm from categories.cashflow_group. |
| flow_type              | text       | Denorm from categories.flow_type (`Income`/`Expense`/`Transfer`). |
| category_ai            | text       | AI-suggested category name. |
| category_ai_conf       | numeric    | 0–1 confidence. |
| category_locked        | boolean    | TRUE once user manually overrides; AI must not change. |
| status                 | text       | `posted` / `pending`. |
| provider_type          | text       | Teller `type` (`card_payment`, `transfer`), Plaid transaction type, etc. |
| processing_status      | text       | Teller `details.processing_status` (`pending`/`complete`). |
| counterparty_name      | text       | Teller `details.counterparty.name`, Plaid `name`, Venmo payer, etc. |
| counterparty_id        | uuid       | FK → counterparties.id, nullable. |
| is_transfer            | boolean    | TRUE for internal money moves that shouldn’t affect net worth. |
| is_pass_through        | boolean    | TRUE when money is mostly not yours long-term (e.g., T-Mobile shares reimbursed by family). |
| is_business            | boolean    | TRUE for business-related flows (rental utilities, business expenses). |
| created_at             | timestamptz| |
| updated_at             | timestamptz| |

Notes:
- `is_transfer` is used to exclude neutral internal moves from cashflow (checking → card, Venmo cashout when underlying txns are categorized separately).
- Non-transfer savings / extra debt payments get their own categories and DO affect Safe-to-Spend.

---

### 2.4 `counterparties`

Tenants, T‑Mobile families, and other named parties.

| Field      | Type  | Example |
|------------|-------|---------|
| id (PK)    | uuid  | |
| name       | text  | `Stephani Walker`, `Rachel McBeth`, `Fife`, `Worwood`, `Carpenter`, `Steck`. |
| type       | text  | `tenant`, `tmobile_family`, `tmobile_person`, `other`. |
| venmo_username | text | e.g. `Jared-Fife-1`, `Daniel-Worwood`, `Gary-Carpenter-4`, `SteckDEV`. |
| notes      | text  | E.g. "Downstairs tenant", "T-Mobile share: $72/mo". |
| active     | boolean | |
| created_at | timestamptz | |

---

### 2.5 `expected_inflows`

For recurring rent, T‑Mobile payments, etc.

| Field          | Type  | Example |
|----------------|-------|---------|
| id (PK)        | uuid  | |
| counterparty_id| uuid  | FK → counterparties.id. |
| description    | text  | `Eagle Mt Unit: Stephani rent`, `T-Mobile – Fife share`. |
| amount         | numeric | Expected amount per period. |
| frequency      | text  | `monthly` (v1). |
| due_day_of_month | int | e.g. 1, 7, 10. |
| account_id     | uuid  | Account where it’s expected to land (Venmo, AFCU, etc.). |
| category_id    | uuid  | Likely `Home Rental Income` or `Reimbursable`. |
| active         | boolean | |
| created_at     | timestamptz | |

Used to compute: **expected income this month not yet received**.

---

### 2.6 `budget_targets`

Per-month budget for each category.

| Field        | Type  | Notes |
|--------------|-------|-------|
| id (PK)      | uuid  | |
| period_month | date  | First of month, e.g. `2025-03-01`. |
| category_id  | uuid  | FK → categories.id. |
| amount       | numeric | Planned monthly amount. |
| notes        | text  | Optional. |

Used for: monthly net vs budget, weekly Safe‑to‑Spend.

---

### 2.7 `category_overrides`

Stores manual corrections to help the AI "learn" over time.

| Field              | Type        | Notes |
|--------------------|------------|-------|
| id (PK)            | uuid       | |
| transaction_id     | uuid       | FK → transactions.id. |
| description_snapshot | text     | Description at time of override. |
| old_category_id    | uuid       | Previous category. |
| new_category_id    | uuid       | New corrected category. |
| reason             | text       | Optional explanation. |
| created_at         | timestamptz| |

Overrides can be summarized into patterns and fed back into the AI prompt.

---

## 3. Integrations

### 3.1 Teller (Chase and other supported banks)

- `accounts` mapping:
  - `provider = 'teller'`
  - `provider_account_id = Teller account id (acc_…)`
  - `name`, `institution_id`, `institution_name`, `currency`, `last_four`, etc. filled directly.

- `transactions` mapping:
  - `provider = 'teller'`
  - `provider_transaction_id = Teller transaction id (txn_…)`
  - `date`, `amount` (normalized sign), `description_raw = description`.
  - `provider_type = type` (e.g. `card_payment`, `transfer`).
  - `processing_status = details.processing_status`.
  - `counterparty_name = details.counterparty.name`.
  - `category_raw = details.category` (optional reference).

### 3.2 Plaid (AFCU)

Used for AFCU checking (main cashflow account).

- `accounts`:
  - `provider = 'plaid'`.
  - `provider_account_id = Plaid account_id`.
  - Map other fields similarly to Teller.

- `transactions`:
  - `provider = 'plaid'`.
  - `provider_transaction_id = Plaid transaction_id`.
  - `description_raw = name`.
  - `amount` normalized to negative = outflow, positive = inflow.

### 3.3 Gmail → Venmo

- Gmail node filters messages by label `venmo-payment`.
- For each message:
  - Use `Subject` and/or body snippet, e.g.:
    - `"Gary Carpenter paid you $72.00"`
    - `"Stephani Walker paid you $60.00"` with snippet containing "rent".
  - Parse payer name and amount with regex.

- Counterparty mapping:
  - `Stephani Walker` → tenant.
  - `Rachel McBeth` → tenant.
  - T-Mobile families by Venmo username:
    - Fife → `Jared-Fife-1`
    - Worwood → `Daniel-Worwood`
    - Carpenter → `Gary-Carpenter-4`
    - Steck → `SteckDEV`

- Insert as `transactions` rows:
  - `provider = 'gmail_venmo'`.
  - `provider_transaction_id = Gmail message.id`.
  - `account_id = Venmo Bank Account` in `accounts`.
  - `description_raw = Subject`.
  - `counterparty_name` and `counterparty_id` from `counterparties`.
  - Category logic:
    - Tenants → `Home Rental Income`.
    - T-Mobile family payments → `Reimbursable` or `TMobile Reimbursement`, `is_pass_through = true`.

Venmo cashouts landing in AFCU as ACH deposits get categorized as `Transfer` with `is_transfer = true` to avoid double-counting rental income.

---

## 4. AI Categorization Prompt (v1 Skeleton)

**Goal:** Given a single transaction JSON, return a structured classification object.

### 4.1 Expected output JSON

```json
{
  "category_name": "Groceries",
  "cashflow_group": "Variable Essentials",
  "flow_type": "Expense",
  "is_transfer": false,
  "is_pass_through": false,
  "counterparty_type": null,
  "notes": "Explanation for debugging only"
}
```

### 4.2 Prompt structure (stored in `prompts/transaction_categorizer_v1.md`)

Key elements:
- Explain category system (`name`, `life_group`, `flow_type`, `cashflow_group`).
- Provide explicit rules:
  - Transfers between own accounts → `Transfer`, `is_transfer = true`.
  - Rent descriptors ("Rent part 1 for March", "March Rent", etc.) → `Home Rental Income`.
  - T-Mobile ACH debits → `Phone` with `is_pass_through = true` (majority reimbursed).
  - Venmo cashouts → `Transfer`, `is_transfer = true`.
- Provide EXAMPLES from your real data:
  - `Smith's Food #4207` → `Groceries`.
  - `Mcdonald's Fx4285` → `Restaurants`.
  - `Automatic Withdrawal, Wells Fargo Autodraft Ppd` → `Car Payment`.
  - `Automatic Withdrawal, Dept Education Student Ln Ppd` → `Loan Payment`.
  - `Automatic Withdrawal, Questargas Questargas Ppd` → `Utilities`.
  - `Automatic Withdrawal, T-mobile Pcs Svc Web (r)` → `Phone`, `is_pass_through = true`.
  - `Rent part 2 for March` / `February Rent` / `March Rent` → `Home Rental Income`.
  - `Deposit Ach Venm Type: Cashout Co: Venmo` → `Transfer`, `is_transfer = true`.

- Include an `OVERRIDES_JSON` section that n8n injects based on `category_overrides` (patterns and forced categories), applied first.

---

## 5. Cashflow & Safe-to-Spend Logic

### 5.1 Included vs Excluded Accounts

- **Included for cashflow**: any account where `include_in_cashflow = TRUE` (AFCU checking, other active checking/savings, credit cards, loans).
- **Excluded**: 401k, HSA investments, Betterment, property/vehicle asset entries, and accounts explicitly set `include_in_cashflow = FALSE`.

### 5.2 Transfers vs Applied-to-debt/savings

- Transactions with:
  - `category_name = "Transfer"` and/or `cashflow_group = "Transfer"` and `is_transfer = true`
  - are treated as **neutral** (just moving money between your own pockets) and excluded from net cashflow.

- If you want to track actual savings contributions / extra paydown as spending knobs:
  - give them categories like `Investments`, `Emergency Prep`, `Extra Loan Payment` with `cashflow_group = 'Savings/Investing'` or `Debt`, and **do not** mark them as `Transfer`.

### 5.3 Monthly Net Cashflow

For month M:
- Include transactions where:
  - `accounts.include_in_cashflow = TRUE` (join),
  - `transactions.status = 'posted'`,
  - `transactions.is_transfer = FALSE`.

Compute sums per `cashflow_group`:

- `Income` = sum(amount where `cashflow_group = 'Income'`).
- `Fixed` = sum(amount where `cashflow_group = 'Fixed'`).
- `Variable Essentials` = sum(amount where `cashflow_group = 'Variable Essentials'`).
- `Discretionary` = sum(amount where `cashflow_group = 'Discretionary'`).
- `Debt` = sum(amount where `cashflow_group = 'Debt'`).
- `Savings/Investing` = sum(amount where `cashflow_group = 'Savings/Investing'`).
- `Business` = sum(amount where `cashflow_group = 'Business'`).

With amounts normalized (income positive, expenses negative):

> **NetCashflow(M) = Income + Fixed + Variable Essentials + Discretionary + Debt + Savings/Investing + Business**

If NetCashflow < 0 ⇒ cashflow negative.

### 5.4 Weekly Safe-to-Spend

1. Compute monthly discretionary budget from `budget_targets`:
   - `MonthlyDiscretionaryBudget = SUM(amount)` for month M where `categories.cashflow_group = 'Discretionary'`.

2. Convert to weekly:
   - `WeeklyDiscretionaryTarget = MonthlyDiscretionaryBudget / 4.33`.

3. For current week W (Mon–Sun):
   - `DiscretionarySpentThisWeek = ABS(SUM(amount)` where
     - `cashflow_group = 'Discretionary'`
     - `date` in week W
     - accounts included in cashflow
   ).

4. Result:
   - `SafeToSpendThisWeek = WeeklyDiscretionaryTarget - DiscretionarySpentThisWeek`.

This is the main number shown on the dashboard.

### 5.5 Expected Income Not Yet Received

For each row in `expected_inflows` for month M:

- `Expected = amount`.
- `Actual = SUM(transactions.amount)` where
  - `transactions.counterparty_id = expected_inflows.counterparty_id`,
  - `transactions.category_id = expected_inflows.category_id`,
  - `transactions.date` in month M.

- `Outstanding = MAX(Expected - Actual, 0)`.

Summaries:
- Per tenant / per T‑Mobile family.
- Total expected but not yet received for the month.

---

## 6. Plaid Cost Planning (AFCU Only)

Plaid pricing (relevant parts):
- Balance: **$0.10 per call**
- Transactions: **$0.30 per connected account / month**
- Enrich: **$2.00 per 1,000 transactions**
- Recurring Transactions: **$0.15 per connected account / month**
- Transactions Refresh: **$0.12 per successful call**

### Recommended v1 usage

Assume 1 AFCU checking account and ~300 tx/month.

- **Balance**: 1 call/day ⇒ ~30 calls/month
  - Cost ≈ 30 × $0.10 = **$3.00**
- **Transactions**: standard pricing per account/month ⇒ **$0.30**
- **Enrich**: 300 tx ⇒ 0.3k × $2.00 ≈ **$0.60**
- **Recurring Transactions** (optional v1): **$0.15**
- **Transactions Refresh**: start at 0 (daily sync likely sufficient).

Total rough v1 cost for Plaid (AFCU) ≈ **$4–5 per month**.

You can later increase balance polling frequency or add refresh calls if you need more real-time accuracy, expecting costs to rise to the ~$10–15/month range if you go aggressive.

