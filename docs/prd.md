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
| category_source        | text       | `plaid`, `rule`, `manual`, `payee_memory` (how category was assigned). |
| category_confidence    | numeric    | 0–1 confidence score for categorization. |
| category_locked        | boolean    | TRUE once user manually overrides; rules/AI must not change. |
| applied_rule_id        | uuid       | FK → categorization_rules.id (nullable, tracks which rule applied). |
| pending_transaction_id | text       | Links pending transaction to posted for category handover. |
| reimbursement_of_id    | uuid       | FK → transactions.id (links reimbursement to original expense). |
| parent_transaction_id  | uuid       | FK → transactions.id (for split transactions). |
| is_split_parent        | boolean    | TRUE if transaction has been split into children. |
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

### 2.7 `categorization_rules`

Programmatic rules for automatic transaction categorization with priority-based waterfall logic.

| Field                   | Type    | Notes |
|------------------------|---------|-------|
| id (PK)                | uuid    | |
| name                   | text    | Human-readable rule name. |
| priority               | integer | Higher number = runs first in waterfall. |
| merchant_match         | text    | Pattern to match against transaction description. |
| merchant_match_type    | text    | `exact`, `contains`, `regex`. |
| amount_min             | numeric | Optional minimum amount filter. |
| amount_max             | numeric | Optional maximum amount filter. |
| account_id             | uuid    | Optional FK → accounts.id (filter by specific account). |
| direction              | text    | `debit`, `credit`, `any`. |
| target_category_id     | uuid    | FK → categories.id (category to assign). |
| is_active              | boolean | Default TRUE. |
| created_at             | timestamptz | |
| updated_at             | timestamptz | |

Rules are evaluated in priority order. First matching rule wins.

### 2.8 `payee_category_mappings`

Learns from user overrides to automatically categorize future transactions from the same payee.

| Field       | Type        | Notes |
|------------|------------|-------|
| id (PK)    | uuid       | |
| payee_name | text       | Normalized merchant/payee name. |
| category_id| uuid       | FK → categories.id. |
| confidence | numeric    | Default 1.0, can be adjusted. |
| usage_count| integer    | Increments each time mapping is applied. |
| created_at | timestamptz| |
| updated_at | timestamptz| |

Payee memory applies after rules but before Plaid defaults in the categorization waterfall.

### 2.9 `category_audit_log`

Tracks all category changes for explainability and undo operations.

| Field                | Type        | Notes |
|--------------------|------------|-------|
| id (PK)            | uuid       | |
| transaction_id     | uuid       | FK → transactions.id. |
| previous_category_id| uuid      | FK → categories.id (nullable). |
| new_category_id    | uuid       | FK → categories.id. |
| change_source      | text       | `plaid`, `rule`, `manual`, `payee_memory`, `pending_handover`. |
| rule_id            | uuid       | FK → categorization_rules.id (nullable). |
| batch_id           | uuid       | FK → rule_application_batches.id (nullable). |
| confidence_score   | numeric    | 0-1 confidence for AI/Plaid categorizations. |
| is_reverted        | boolean    | TRUE if batch was undone. |
| created_at         | timestamptz| |

Used for audit history, explainability badges, and batch undo operations.

### 2.10 `rule_application_batches`

Tracks batch rule applications for bulk undo capability.

| Field             | Type        | Notes |
|------------------|------------|-------|
| id (PK)          | uuid       | |
| rule_id          | uuid       | FK → categorization_rules.id. |
| applied_at       | timestamptz| |
| transaction_count| integer    | Number of transactions affected. |
| is_undone        | boolean    | TRUE if batch was reverted. |

Enables ACID undo of entire rule applications.

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

## 4. Categorization System

### 4.1 Categorization Waterfall (Priority Order)

The system uses a multi-layered waterfall approach for transaction categorization:

1. **Category Locked Check** - Skip transactions where `category_locked = TRUE`
2. **User-Defined Rules** - Apply `categorization_rules` in priority order (highest first)
3. **Payee Memory** - Check `payee_category_mappings` for learned patterns
4. **Plaid Defaults** - Fall back to Plaid categorization if confidence > 0.8
5. **Uncategorized** - Remains NULL for manual review

All categorization logic is implemented as **Supabase stored procedures** for performance and ACID guarantees.

### 4.2 Key Stored Procedures

**`fn_run_categorization_waterfall(p_batch_id UUID, p_transaction_ids UUID[])`**
- Executes the full waterfall logic for a batch of transactions
- Returns statistics: `{ processed, rules_applied, memory_applied, plaid_applied, skipped_locked }`
- Logs all changes to `category_audit_log`
- Called by n8n for bulk operations and by the UI for single transactions

**`fn_undo_batch(p_batch_id UUID)`**
- Reverts all categorization changes from a batch
- Restores previous categories using audit log
- Marks batch as undone in `rule_application_batches`
- Ensures ACID transaction integrity

**`fn_handle_pending_handover()`**
- Trigger that fires when posted transaction arrives
- Copies user categorization from pending to posted transaction using `pending_transaction_id`
- Deletes old pending record
- Prevents loss of manual categorization work

### 4.3 User Override and Learning

When a user manually changes a category:
1. Transaction is updated with new `category_id`
2. `category_locked` set to TRUE (protects from re-categorization)
3. `category_source` set to `'manual'`
4. Change logged to `category_audit_log`
5. Payee mapping saved to `payee_category_mappings` for future transactions

### 4.4 Transfer Detection and Reimbursement Handling

**Transfer Detection:**
- Heuristic: Same amount (opposite sign) within 3 days between same-owner accounts
- P2P services (Venmo, Zelle, PayPal) classified based on context
- Manual toggle available in UI for edge cases

**Reimbursements:**
- Link reimbursement to original expense using `reimbursement_of_id`
- T-Mobile family payments marked with `is_pass_through = TRUE`
- Enables proper netting in cashflow calculations

### 4.5 Transaction Splitting

Manual splitting for mixed-category purchases (e.g., groceries + household items at Target):
- Parent transaction marked with `is_split_parent = TRUE`
- Child transactions created with `parent_transaction_id` set
- Each child gets its own category
- Parent excluded from cashflow calculations (only children counted)

### 4.6 Review Queue and Bulk Editing

**Review Queue** surfaces transactions needing attention:
- Uncategorized (`category_id IS NULL`)
- Low confidence (`category_confidence < 0.7`)
- Ambiguous P2P transactions

**Bulk Editing:**
- Multi-select transactions for batch category assignment
- Creates `category_overrides` records
- Updates payee memory for unique payees
- Tracks changes in audit log

### 4.7 Explainability

Every transaction displays a **Category Source Badge**:
- **Plaid** (blue) - Plaid categorization with confidence score
- **Rule: [name]** (purple) - Matched a user-defined rule
- **Manual** (green) - User manually categorized
- **Learned** (orange) - Applied from payee memory

Click badge to view full audit history of category changes.

---

## 5. AI Categorization Prompt (v1 Skeleton - DEPRECATED)

**Note:** This section describes the original AI prompt approach. The system now uses a rule engine + payee memory waterfall (see Section 4). AI categorization may be reintroduced in the future for edge cases.

**Goal:** Given a single transaction JSON, return a structured classification object.

### 5.1 Expected output JSON

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

### 5.2 Prompt structure (stored in `prompts/transaction_categorizer_v1.md`)

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

## 6. Cashflow & Safe-to-Spend Logic

### 6.1 Included vs Excluded Accounts

- **Included for cashflow**: any account where `include_in_cashflow = TRUE` (AFCU checking, other active checking/savings, credit cards, loans).
- **Excluded**: 401k, HSA investments, Betterment, property/vehicle asset entries, and accounts explicitly set `include_in_cashflow = FALSE`.

### 6.2 Transfers vs Applied-to-debt/savings

- Transactions with:
  - `category_name = "Transfer"` and/or `cashflow_group = "Transfer"` and `is_transfer = true`
  - are treated as **neutral** (just moving money between your own pockets) and excluded from net cashflow.

- If you want to track actual savings contributions / extra paydown as spending knobs:
  - give them categories like `Investments`, `Emergency Prep`, `Extra Loan Payment` with `cashflow_group = 'Savings/Investing'` or `Debt`, and **do not** mark them as `Transfer`.

### 6.3 Monthly Net Cashflow

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

### 6.4 Weekly Safe-to-Spend

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

### 6.5 Expected Income Not Yet Received

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

## 7. Plaid Cost Planning (AFCU Only)

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

