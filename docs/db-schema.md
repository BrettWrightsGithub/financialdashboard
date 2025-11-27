# Database Schema (Supabase / Postgres)

This file is the canonical reference for tables and fields. Keep it in sync with actual migrations.

---

## Table: accounts

Represents any financial account (bank, credit card, loan, property, Venmo balance, etc.).

| Column              | Type        | Notes |
|---------------------|------------|------|
| id (pk)             | uuid       | Generated in Supabase. |
| provider            | text       | `teller`, `plaid`, `gmail_venmo`, `manual`, etc. |
| provider_account_id | text       | External ID (e.g., Teller `acc_…`, Plaid `account_id`). |
| name                | text       | Raw provider name. |
| display_name        | text       | Human-friendly label (e.g., `AFCU Checking`). |
| institution_id      | text       | Bank ID (e.g., `afcu`, `chase`). |
| institution_name    | text       | Bank name. |
| currency            | text       | e.g., `USD`. |
| status              | text       | `open`, `closed`. |
| subtype             | text       | `checking`, `savings`, `credit_card`, `loan`, `hsa`, `property`, `vehicle`, `crypto`, `other`. |
| balance_class       | text       | `Asset` or `Liability`. |
| account_group       | text       | `Cash`, `Savings`, `Debt`, `Investment`, `Property`, `Vehicle`, `Crypto`, `Other`. |
| owner               | text       | `Brett`, `Ashley`, `Joint`. |
| is_primary_cashflow | boolean    | TRUE for AFCU checking. |
| include_in_cashflow | boolean    | Whether to include in cashflow calculations. |
| last_four           | text       | Last 4 digits when applicable. |
| ledger_balance      | numeric    | Ledger balance. |
| available_balance   | numeric    | Available balance. |
| current_balance     | numeric    | Main balance to display (usually available for assets, balance for liabilities). |
| credit_limit        | numeric    | For credit cards. |
| interest_rate_apr   | numeric    | For loans / credit cards. |
| created_at          | timestamptz| default now(). |
| updated_at          | timestamptz| updated on sync. |

---

## Table: categories

Logical spending/earning categories.

| Column        | Type  | Notes |
|---------------|-------|------|
| id (pk)       | uuid  | |
| name          | text  | e.g., `Groceries`, `Restaurants`, `Home Rental Income`. |
| life_group    | text  | e.g., `Living`, `Kids`, `Utilities`, `Business`, `Discretionary`, `Detractors`. |
| flow_type     | text  | `Income`, `Expense`, `Transfer`. |
| cashflow_group| text  | `Income`, `Fixed`, `Variable Essentials`, `Discretionary`, `Debt`, `Savings/Investing`, `Business`, `Transfer`, `Detractors`, `Other`. |
| is_active     | bool  | default true. |
| sort_order    | int   | for UI ordering. |

Populate this table using your existing mapping sheet.

---

## Table: transactions

Master ledger joining Teller, Plaid, Venmo, manual entries.

| Column                  | Type        | Notes |
|-------------------------|------------|------|
| id (pk)                 | uuid       | Internal transaction ID. |
| provider                | text       | `teller`, `plaid`, `gmail_venmo`, `manual`, etc. |
| provider_transaction_id | text       | External transaction ID (Teller `txn_…`, Plaid `transaction_id`, Gmail message id). |
| account_id              | uuid       | FK → accounts.id. |
| provider_account_id     | text       | External account id for reference. |
| date                    | date       | Posting date. |
| amount                  | numeric    | Normalized: positive = inflow, negative = outflow. |
| description_raw         | text       | Raw description from provider/email. |
| description_clean       | text       | Cleaned merchant / payee name. |
| life_category_id        | uuid       | FK → categories.id (final category). |
| cashflow_group          | text       | Denormalized from categories.cashflow_group. |
| flow_type               | text       | Denormalized from categories.flow_type. |
| category_ai             | text       | AI-suggested category name. |
| category_ai_conf        | numeric    | 0–1 confidence. |
| category_locked         | boolean    | TRUE if user manually changed category. |
| status                  | text       | `posted`, `pending`. |
| provider_type           | text       | e.g., `card_payment`, `transfer`. |
| processing_status       | text       | `pending`, `complete` (from Teller). |
| counterparty_name       | text       | E.g., tenant name, Venmo sender. |
| counterparty_id         | uuid       | FK → counterparties.id (nullable). |
| is_transfer             | boolean    | TRUE for neutral internal transfers. |
| is_pass_through         | boolean    | TRUE for mostly reimbursed flows (e.g., T-Mobile). |
| is_business             | boolean    | TRUE for business flows. |
| created_at              | timestamptz| |
| updated_at              | timestamptz| |

---

## Table: counterparties

Named people/entities (tenants, T-Mobile families, etc.).

| Column        | Type  | Notes |
|---------------|-------|------|
| id (pk)       | uuid  | |
| name          | text  | e.g., `Stephani Walker`, `Rachel McBeth`, `Fife`, `Worwood`. |
| type          | text  | `tenant`, `tmobile_family`, `tmobile_person`, `other`. |
| venmo_username| text  | e.g., `Gary-Carpenter-4`. |
| notes         | text  | Optional notes. |
| active        | bool  | default true. |
| created_at    | timestamptz | |

---

## Table: expected_inflows

Recurring expected inflows (rent, T-Mobile share, etc.).

| Column          | Type  | Notes |
|-----------------|-------|------|
| id (pk)         | uuid  | |
| counterparty_id | uuid  | FK → counterparties.id. |
| description     | text  | e.g., `Eagle Mt Unit – Stephani rent`. |
| amount          | numeric | Expected amount per period. |
| frequency       | text  | `monthly` (v1). |
| due_day_of_month| int   | e.g., 1, 7, 10. |
| account_id      | uuid  | Account where inflow is expected. |
| category_id     | uuid  | Usually `Home Rental Income` or `Reimbursable`. |
| active          | bool  | |
| created_at      | timestamptz | |

---

## Table: budget_targets

Budgeted monthly amounts by category.

| Column        | Type  | Notes |
|---------------|-------|------|
| id (pk)       | uuid  | |
| period_month  | date  | First day of month (e.g., `2025-03-01`). |
| category_id   | uuid  | FK → categories.id. |
| amount        | numeric | Planned monthly amount. |
| notes         | text  | Optional. |

---

## Table: category_overrides

Captures manual category changes (helps improve AI later).

| Column              | Type        | Notes |
|---------------------|------------|------|
| id (pk)             | uuid       | |
| transaction_id      | uuid       | FK → transactions.id. |
| description_snapshot| text       | Raw description at time of override. |
| old_category_id     | uuid       | Previous category. |
| new_category_id     | uuid       | New category. |
| reason              | text       | Optional explanation. |
| created_at          | timestamptz| |
