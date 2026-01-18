# Databases & Schemas

The system relies on a single **Supabase (PostgreSQL)** database. Logic is heavily pushed into the database layer via Stored Procedures to ensure consistency across ingestion (n8n) and application (Next.js) layers.

## Core Tables

### `transactions`
The master ledger containing all financial events.
- **Purpose:** Normalized storage for Plaid, Teller, and Venmo transactions.
- **Key Fields:**
    - `id` (UUID, PK)
    - `amount` (Numeric): Normalized (Positive = Income, Negative = Expense).
    - `life_category_id` (FK -> categories): The final resolved category.
    - `category_locked` (Boolean): If `true`, automation will NOT overwrite this row.
    - `is_split_parent` (Boolean): If `true`, this row is excluded from cashflow; look at its children.
    - `parent_transaction_id` (FK -> transactions): Links split children to parent.
    - `pending_transaction_id` (Text): Links a posted transaction to its ephemeral pending version.
    - `category_ai` (Text): Suggested category. Primarily populated by Plaid Enrichment (Workflow 2). The dedicated AI Categorizer (Workflow 4) is currently in design phase.
- **Relationships:** Belongs to `accounts`; references `categories`, `counterparties`.

### `accounts`
Financial containers (Bank Accounts, Credit Cards, Loans).
- **Purpose:** Tracks current/available balance and sync status.
- **Key Fields:**
    - `provider_account_id`: External ID from Plaid/Teller.
    - `include_in_cashflow` (Boolean): Determines if this account affects "Safe-to-Spend".
- **Relationships:** Belongs to `provider_connections`.

### `categories`
The taxonomy for spending and income.
- **Purpose:** Defines grouping logic for reports.
- **Key Fields:** `cashflow_group` (Enum: Income, Fixed, Discretionary, etc.), `flow_type` (Income/Expense/Transfer).

### `categorization_rules`
User-defined logic for assigning categories.
- **Purpose:** Deterministic "if/then" engine.
- **Key Fields:** `priority` (Int), `match_merchant_contains` (Text), `assign_category_id` (UUID).

### `payee_category_mappings` (Payee Memory)
Machine learning (simple frequency-based) memory.
- **Purpose:** Remembers that "Chevron #123" is usually "Gas".
- **Key Fields:** `payee_name_normalized`, `category_id`, `confidence`.

### `category_audit_log`
Explainability trail.
- **Purpose:** records *who* changed a category and *why* (Rule vs. Manual vs. Plaid).
- **Key Fields:** `change_source` (Enum), `previous_category_id`, `new_category_id`.

## Logic Layer (Stored Procedures)

- **`fn_run_categorization_waterfall`**: The core "Brain". Runs Rules -> Memory -> Plaid Default.
- **`fn_undo_batch_detailed`**: ACID compliance for reverting bulk categorization actions.
- **`fn_handle_pending_handover`**: Trigger that copies manual categories from a pending tx to its matching posted tx.

---

# Write Paths

### 1. Ingestion (External -> DB)
- **Source:** n8n Workflows (`docs/n8n/`).
- **Mechanism:** HTTP Requests to Supabase REST API.
- **Frequency:** Scheduled (hourly/daily).
- **Tables Touched:**
    - `transactions` (Upsert based on `provider_transaction_id`).
    - `accounts` (Upsert balance updates).

### 2. Auto-Categorization (DB Internal)
- **Source:** Stored Procedure `fn_run_categorization_waterfall`.
- **Mechanism:** Triggered by API or n8n after ingestion.
- **Tables Touched:**
    - `transactions`: Updates `life_category_id`, `category_source`.
    - `category_audit_log`: Inserts history.

### 3. User Actions (Next.js -> DB)
- **Manual Override:**
    - **Route:** `POST /api/transactions/[id]/override`
    - **Effect:** Updates `transactions` (`category_locked=true`), updates `payee_category_mappings`.
- **Bulk Edit:**
    - **Route:** `POST /api/transactions/bulk-edit`
    - **Effect:** Batch updates `transactions`, logs to `category_audit_log`.
- **Splitting:**
    - **Route:** `POST /api/transactions/split`
    - **Effect:** Marks parent `is_split_parent=true`, inserts new child rows in `transactions`.

---

# Read Paths

### 1. Dashboard & Reports (Next.js UI)
- **Consumers:** `app/page.tsx`, `app/budget-planner/page.tsx`.
- **Mechanism:** Server Components calling `lib/supabase.ts` (using RLS policies/Anon key) or `lib/queries.ts`.
- **Key Queries:**
    - "Safe-to-Spend": Sum `transactions` where `cashflow_group='Discretionary'` & `date` = this week.
    - "Net Cashflow": Sum all `transactions` by `cashflow_group`.

### 2. Sync Logic (n8n)
- **Consumers:** n8n Workflows.
- **Mechanism:** REST API.
- **Key Reads:** Fetches `accounts` to map external IDs to internal UUIDs during ingestion.

---

# Constraints & Invariants

1.  **Sign Convention:** `amount` MUST be negative for expenses and positive for income. (Enforced by n8n transformation logic).
2.  **Locking:** If `category_locked` is `true`, the `fn_run_categorization_waterfall` MUST skip the row.
3.  **Split Integrity:** A transaction is either a standard row OR a parent (excluded from calcs) OR a child. It cannot be both a parent and a normal transaction.
4.  **Provider Uniqueness:** `(provider, provider_transaction_id)` is a composite unique constraint to prevent duplicate ingestion.

---

# Risk Areas

### 1. Data Ingestion Reliability
-   **Risk:** n8n is external. If the docker container dies or credential expires, data stops flowing.
-   **Detection:** `sync_state` table exists but needs active monitoring (e.g., "Last sync > 24h ago" alert).

### 2. Pending vs. Posted Drift
-   **Risk:** Banks often change the description between "Pending" and "Posted".
-   **Mitigation:** `fn_handle_pending_handover` attempts to match, but if the description changes too much or amount changes (tips), the link might break, causing double-counting or lost categorization.

### 3. Split Transaction Complexity
-   **Risk:** Deleting a parent transaction *without* cascading delete to children could leave "orphan" child transactions that mess up sums.
-   **Mitigation:** Application logic (`transactions/split/route.ts`) handles this, but raw SQL deletions could bypass it.
