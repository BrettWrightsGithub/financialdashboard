# Database Schema (Supabase / Postgres)

This file is the canonical reference for tables and fields. Keep it in sync with actual migrations.

---

## Table: provider_connections

Stores access tokens and connection metadata for Plaid/Teller integrations. One connection = one institution link.

| Column              | Type        | Nullable | Default           | Notes |
|---------------------|-------------|----------|-------------------|-------|
| id (pk)             | uuid        | NO       | gen_random_uuid() | |
| provider            | text        | NO       | —                 | `plaid`, `teller`. |
| provider_item_id    | text        | NO       | —                 | Plaid `item_id` or Teller enrollment id. |
| access_token        | text        | NO       | —                 | **SENSITIVE** — never expose to frontend. |
| institution_id      | text        | YES      | —                 | e.g., `ins_3` (Plaid), `chase` (Teller). |
| institution_name    | text        | YES      | —                 | e.g., `Chase`. |
| status              | text        | NO       | `'healthy'`       | `healthy`, `needs_reauth`, `error`. |
| error_code          | text        | YES      | —                 | e.g., `ITEM_LOGIN_REQUIRED`. |
| consent_expiration  | timestamptz | YES      | —                 | For Plaid connections with expiring consent. |
| transaction_cursor  | text        | YES      | —                 | Cursor for incremental transaction sync. |
| created_at          | timestamptz | YES      | now()             | |
| updated_at          | timestamptz | YES      | now()             | |

---

## Table: accounts

Represents any financial account (bank, credit card, loan, etc.).

| Column              | Type        | Nullable | Default           | Notes |
|---------------------|-------------|----------|-------------------|-------|
| id (pk)             | uuid        | NO       | gen_random_uuid() | |
| provider            | text        | NO       | —                 | `teller`, `plaid`, `gmail_venmo`, `manual`, etc. |
| provider_account_id | text        | YES      | —                 | External ID (e.g., Teller `acc_…`, Plaid `account_id`). |
| name                | text        | NO       | —                 | Account name from provider. |
| institution         | text        | YES      | —                 | Bank/institution name. |
| account_type        | text        | YES      | —                 | `checking`, `savings`, `credit_card`, etc. |
| mask                | text        | YES      | —                 | Last 4 digits. |
| balance_current     | numeric     | YES      | —                 | Current balance. |
| balance_available   | numeric     | YES      | —                 | Available balance. |
| include_in_cashflow | boolean     | YES      | true              | Whether to include in cashflow calculations. |
| is_active           | boolean     | YES      | true              | |
| connection_id       | uuid        | YES      | —                 | FK → provider_connections.id. |
| created_at          | timestamptz | YES      | now()             | |
| updated_at          | timestamptz | YES      | now()             | |

---

## Table: categories

Logical spending/earning categories.

| Column        | Type        | Nullable | Default           | Notes |
|---------------|-------------|----------|-------------------|-------|
| id (pk)       | uuid        | NO       | gen_random_uuid() | |
| name          | text        | NO       | —                 | e.g., `Groceries`, `Restaurants`. |
| cashflow_group| text        | NO       | —                 | `Income`, `Fixed`, `Variable Essentials`, `Discretionary`, `Debt`, `Savings/Investing`, `Business`, `Transfer`, `Detractors`, `Other`. |
| description   | text        | YES      | —                 | |
| color         | text        | YES      | —                 | Hex color for UI. |
| icon          | text        | YES      | —                 | Icon name for UI. |
| sort_order    | integer     | YES      | 0                 | For UI ordering. |
| is_active     | boolean     | YES      | true              | |
| created_at    | timestamptz | YES      | now()             | |

---

## Table: categorization_rules

Rules for automatic transaction categorization.

| Column                  | Type        | Nullable | Default           | Notes |
|-------------------------|-------------|----------|-------------------|-------|
| id (pk)                 | uuid        | NO       | gen_random_uuid() | |
| name                    | text        | NO       | —                 | Rule name. |
| description             | text        | YES      | —                 | |
| priority                | integer     | NO       | 0                 | Higher = evaluated first. |
| is_active               | boolean     | YES      | true              | |
| match_merchant_contains | text        | YES      | —                 | Case-insensitive substring match on description. |
| match_merchant_exact    | text        | YES      | —                 | Exact match on description. |
| match_amount_min        | numeric     | YES      | —                 | Minimum amount filter. |
| match_amount_max        | numeric     | YES      | —                 | Maximum amount filter. |
| match_account_id        | uuid        | YES      | —                 | Filter by specific account. |
| match_account_subtype   | text        | YES      | —                 | Filter by account type. |
| match_direction         | text        | YES      | —                 | `inflow`, `outflow`. |
| assign_category_id      | uuid        | NO       | —                 | FK → categories.id. Category to assign. |
| assign_is_transfer      | boolean     | YES      | —                 | Set is_transfer flag. |
| assign_is_pass_through  | boolean     | YES      | —                 | Set is_pass_through flag. |
| created_at              | timestamptz | YES      | now()             | |
| updated_at              | timestamptz | YES      | now()             | |

---

## Table: category_batches

Tracks batch categorization operations.

| Column            | Type        | Nullable | Default           | Notes |
|-------------------|-------------|----------|-------------------|-------|
| id (pk)           | uuid        | NO       | gen_random_uuid() | |
| operation_type    | text        | NO       | —                 | e.g., `rule_apply`, `ai_batch`. |
| rule_id           | uuid        | YES      | —                 | FK → categorization_rules.id if rule-based. |
| description       | text        | YES      | —                 | |
| transaction_count | integer     | YES      | —                 | Number of transactions affected. |
| created_at        | timestamptz | YES      | now()             | |

---

## Table: category_overrides

Pattern-based overrides for transaction categorization.

| Column                      | Type        | Nullable | Default           | Notes |
|-----------------------------|-------------|----------|-------------------|-------|
| id (pk)                     | uuid        | NO       | gen_random_uuid() | |
| description_pattern         | text        | NO       | —                 | Pattern to match against transaction description. |
| counterparty_name           | text        | YES      | —                 | Counterparty name to assign. |
| category_id                 | uuid        | NO       | —                 | FK → categories.id. |
| is_transfer                 | boolean     | YES      | —                 | |
| is_pass_through             | boolean     | YES      | —                 | |
| is_business                 | boolean     | YES      | —                 | |
| priority                    | integer     | YES      | 0                 | Higher = applied first. |
| is_active                   | boolean     | YES      | true              | |
| source                      | text        | YES      | —                 | Where override was created: `manual`, `ai`, `rule`. |
| rule_id                     | uuid        | YES      | —                 | FK → categorization_rules.id if created from rule. |
| confidence_score            | numeric     | YES      | —                 | AI confidence if AI-generated. |
| batch_id                    | uuid        | YES      | —                 | FK → category_batches.id. |
| created_from_transaction_id | uuid        | YES      | —                 | FK → transactions.id. Source transaction. |
| created_at                  | timestamptz | YES      | now()             | |

---

## Table: counterparties

Named people/entities (tenants, T-Mobile families, etc.).

| Column              | Type        | Nullable | Default           | Notes |
|---------------------|-------------|----------|-------------------|-------|
| id (pk)             | uuid        | NO       | gen_random_uuid() | |
| name                | text        | NO       | —                 | e.g., `Stephani Walker`, `Rachel McBeth`. |
| type                | text        | YES      | —                 | `tenant`, `tmobile_family`, `tmobile_person`, `other`. |
| default_category_id | uuid        | YES      | —                 | FK → categories.id. Default category for this counterparty. |
| notes               | text        | YES      | —                 | |
| created_at          | timestamptz | YES      | now()             | |

---

## Table: expected_inflows

Expected inflows for a given month (rent, T-Mobile share, etc.).

| Column                 | Type        | Nullable | Default           | Notes |
|------------------------|-------------|----------|-------------------|-------|
| id (pk)                | uuid        | NO       | gen_random_uuid() | |
| source                 | text        | NO       | —                 | Description of inflow source. |
| counterparty_id        | uuid        | YES      | —                 | FK → counterparties.id. |
| expected_amount        | numeric     | NO       | —                 | Expected amount. |
| expected_date          | date        | YES      | —                 | Expected date of inflow. |
| recurrence             | text        | YES      | —                 | `monthly`, `weekly`, `one-time`. |
| category_id            | uuid        | YES      | —                 | FK → categories.id. |
| matched_transaction_id | uuid        | YES      | —                 | FK → transactions.id when matched. |
| actual_amount          | numeric     | YES      | —                 | Actual amount received. |
| actual_date            | date        | YES      | —                 | Actual date received. |
| status                 | text        | YES      | `'pending'`       | `pending`, `received`, `partial`, `missed`. |
| month                  | date        | NO       | —                 | First day of month (e.g., `2025-03-01`). |
| notes                  | text        | YES      | —                 | |
| created_at             | timestamptz | YES      | now()             | |
| updated_at             | timestamptz | YES      | now()             | |

---

## Table: budget_targets

Budgeted monthly amounts by category.

| Column      | Type        | Nullable | Default           | Notes |
|-------------|-------------|----------|-------------------|-------|
| id (pk)     | uuid        | NO       | gen_random_uuid() | |
| category_id | uuid        | NO       | —                 | FK → categories.id. |
| month       | date        | NO       | —                 | First day of month (e.g., `2025-03-01`). |
| amount      | numeric     | NO       | —                 | Planned monthly amount. |
| notes       | text        | YES      | —                 | |
| created_at  | timestamptz | YES      | now()             | |
| updated_at  | timestamptz | YES      | now()             | |

---

## Table: transactions

Master ledger joining Teller, Plaid, Venmo, manual entries.

| Column                  | Type        | Nullable | Default           | Notes |
|-------------------------|-------------|----------|-------------------|-------|
| id (pk)                 | uuid        | NO       | gen_random_uuid() | |
| provider                | text        | NO       | —                 | `teller`, `plaid`, `gmail_venmo`, `manual`, etc. |
| provider_transaction_id | text        | NO       | —                 | External transaction ID. |
| account_id              | uuid        | NO       | —                 | FK → accounts.id. |
| provider_account_id     | text        | YES      | —                 | External account id for reference. |
| date                    | date        | NO       | —                 | Posting date. |
| amount                  | numeric     | NO       | —                 | Normalized: positive = inflow, negative = outflow. |
| description_raw         | text        | YES      | —                 | Raw description from provider. |
| description_clean       | text        | YES      | —                 | Cleaned merchant/payee name. |
| life_category_id        | uuid        | YES      | —                 | FK → categories.id (final category). |
| cashflow_group          | text        | YES      | —                 | Denormalized from categories.cashflow_group. |
| flow_type               | text        | YES      | —                 | `Income`, `Expense`, `Transfer`. |
| category_ai             | text        | YES      | —                 | AI-suggested category name. |
| category_ai_conf        | integer     | YES      | —                 | AI confidence (0–100). |
| category_locked         | boolean     | YES      | false             | TRUE if user manually locked category. |
| status                  | text        | YES      | `'posted'`        | `posted`, `pending`. |
| provider_type           | text        | YES      | —                 | e.g., `card_payment`, `transfer`. |
| processing_status       | text        | YES      | `'complete'`      | `pending`, `complete`. |
| counterparty_name       | text        | YES      | —                 | E.g., tenant name, Venmo sender. |
| counterparty_id         | uuid        | YES      | —                 | FK → counterparties.id. |
| is_transfer             | boolean     | YES      | false             | TRUE for neutral internal transfers. |
| is_pass_through         | boolean     | YES      | false             | TRUE for mostly reimbursed flows (e.g., T-Mobile). |
| is_business             | boolean     | YES      | false             | TRUE for business flows. |
| transfer_subtype        | text        | YES      | —                 | e.g., `internal`, `external`. |
| category_source         | text        | YES      | —                 | `manual`, `ai`, `rule`, `override`. |
| pending_transaction_id  | text        | YES      | —                 | Links pending → posted transaction. |
| reimbursement_of_id     | uuid        | YES      | —                 | FK → transactions.id. Links reimbursement to original. |
| parent_transaction_id   | uuid        | YES      | —                 | FK → transactions.id. For split transactions. |
| is_split_child          | boolean     | YES      | false             | TRUE if this is a split child. |
| is_split_parent         | boolean     | YES      | false             | TRUE if this transaction has been split. Excluded from cashflow and sync. |
| applied_rule_id         | uuid        | YES      | —                 | FK → categorization_rules.id. Rule that categorized this. |
| category_batch_id       | uuid        | YES      | —                 | FK → category_batches.id. |
| category_confidence     | numeric     | YES      | —                 | Categorization confidence (0–1). |
| created_at              | timestamptz | YES      | now()             | |
| updated_at              | timestamptz | YES      | now()             | |

---

## View: v_transactions_with_details

Denormalized view joining transactions with account, category, and counterparty details.

| Column                    | Type        | Notes |
|---------------------------|-------------|-------|
| id                        | uuid        | transactions.id |
| provider                  | text        | |
| provider_transaction_id   | text        | |
| account_id                | uuid        | |
| provider_account_id       | text        | |
| date                      | date        | |
| amount                    | numeric     | |
| description_raw           | text        | |
| description_clean         | text        | |
| life_category_id          | uuid        | |
| cashflow_group            | text        | |
| flow_type                 | text        | |
| category_ai               | text        | |
| category_ai_conf          | integer     | |
| category_locked           | boolean     | |
| status                    | text        | |
| provider_type             | text        | |
| processing_status         | text        | |
| counterparty_name         | text        | |
| counterparty_id           | uuid        | |
| is_transfer               | boolean     | |
| is_pass_through           | boolean     | |
| is_business               | boolean     | |
| created_at                | timestamptz | |
| updated_at                | timestamptz | |
| account_name              | text        | From accounts.name |
| account_institution       | text        | From accounts.institution |
| account_type              | text        | From accounts.account_type |
| category_name             | text        | From categories.name |
| category_cashflow_group   | text        | From categories.cashflow_group |
| category_color            | text        | From categories.color |
| counterparty_display_name | text        | From counterparties.name |
| counterparty_type         | text        | From counterparties.type |
