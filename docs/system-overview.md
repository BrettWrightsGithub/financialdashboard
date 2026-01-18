# Project Overview

The **Financial Command Center** is a personal financial operating system designed to provide a consolidated view of household finances. Its primary goal is to answer critical "safe-to-spend" and cashflow questions that traditional aggregators (like Mint or YNAB) often obscure with complexity.

- **Primary User:** Single household (Brett & Ashley).
- **Purpose:** Aggregate data from multiple sources (AFCU, Chase, Venmo), categorize transactions automatically, and calculate specific metrics like "Weekly Safe-to-Spend" and "Monthly Net Cashflow".
- **Non-Goals:** It is **not** a multi-tenant SaaS application, a tax filing tool, or a complex investment portfolio tracker. It does not aim to support every possible bank interaction, only those relevant to the specific user.

# High-Level Architecture

The system follows a "Hybrid Automation" architecture, decoupling data ingestion from user interaction.

### Major Subsystems

1.  **Frontend (Next.js App Router):**
    -   **Responsibility:** Renders the Dashboard, Budget Planner, and Transaction views. Handles user interactions for categorization overrides and splitting transactions.
    -   **Location:** `app/` directory.
    -   **Tech:** Next.js 15, React, TailwindCSS.

2.  **Data & Logic Core (Supabase/PostgreSQL):**
    -   **Responsibility:** Acts as the single source of truth. Stores all transactions, accounts, and rules.
    -   **Key Feature:** Implements heavy business logic (Categorization Waterfall, Undo capabilities) directly in PostgreSQL Stored Procedures (`plpgsql`).
    -   **Location:** `supabase/migrations/` (Schema & Functions).

3.  **Ingestion & Orchestration (n8n):**
    -   **Responsibility:** Connects to external providers (Plaid, Teller) and parses unstructured data (Gmail for Venmo). Normalizes data before inserting it into Supabase.
    -   **Location:** `docker/n8n/` (Infrastructure) and `docs/n8n/` (Workflow definitions).

### External Services

-   **Supabase:** Hosted PostgreSQL database + Auth + Realtime.
-   **Plaid:** Syncs AFCU checking account (Primary Cashflow).
-   **Teller:** Syncs other banking institutions (Chase, etc.).
-   **Gmail:** Source for parsing Venmo transaction emails via n8n.

### Data Boundaries

-   **Trust Assumption:** The system assumes `SUPABASE_SERVICE_ROLE_KEY` is available only in server-side contexts (`app/api` or n8n). The frontend uses the `NEXT_PUBLIC_SUPABASE_ANON_KEY` and relies on Row Level Security (RLS) policies (though currently configured for a single-tenant context).
-   **Boundary:** n8n writes raw data; Supabase Stored Procedures refine it. The Frontend mostly reads refined data, writing only user overrides.

# Data Flow (End-to-End)

### 1. Ingestion (Asynchronous)
1.  **Trigger:** n8n workflows run on a schedule (defined in `docs/n8n/`).
2.  **Fetch:**
    -   **Plaid/Teller:** Connects to APIs to fetch recent transactions.
    -   **Gmail:** Polls for emails with label `venmo-payment`, parsing body for amount and sender.
3.  **Normalize:** n8n transforms provider-specific JSON into a standardized `transactions` row format.
4.  **Write:** n8n inserts rows into the Supabase `transactions` table.

### 2. Categorization & Processing (Synchronous to DB Insert)
1.  **Waterfall Execution:** New transactions trigger the `fn_run_categorization_waterfall` stored procedure (referenced in `docs/categorization/rule_engine.md` and migrations).
2.  **Logic Steps:**
    -   **Check Locks:** Skips if `category_locked = true`.
    -   **Apply Rules:** Matches against `categorization_rules` (priority order).
    -   **Apply Memory:** Checks `payee_category_mappings` for past user overrides.
    -   **Apply Defaults:** Uses Plaid/Teller provided category if high confidence.
3.  **Audit:** Changes are logged to `category_audit_log` with the `change_source` (e.g., 'rule', 'payee_memory').

### 3. Presentation (Synchronous to User Request)
1.  **Read:** Next.js Server Components fetch data from Supabase tables (`transactions`, `budget_targets`).
2.  **Calculate:**
    -   **Cashflow:** Aggregates income/expense by `cashflow_group`.
    -   **Safe-to-Spend:** Computes `(Monthly Discretionary Target / 4.33) - Current Week Discretionary Spend`.
    -   **Outstanding Inflows:** Compares `expected_inflows` vs actual received transactions.
3.  **Render:** UI displays the Dashboard and Tables.

### 4. User Feedback Loop
1.  **Override:** User updates a category in the UI.
2.  **Write:** API updates `transactions` table (`category_id`, `category_locked=true`).
3.  **Learn:** Trigger/Procedure updates `payee_category_mappings` to "teach" the system for next time.

# Key Design Decisions

-   **Logic in Database:**
    -   **Decision:** Core categorization logic (Waterfall, Payee Memory) is implemented in SQL Stored Procedures (`supabase/migrations/`).
    -   **Tradeoff:** Harder to unit test with standard JS tools, but ensures data consistency regardless of whether the update comes from n8n, API, or direct SQL access. Reduces latency for batch operations.

-   **Lean Application Layer:**
    -   **Decision:** Next.js is primarily a view layer. It does not contain heavy ETL or business rule processing logic.
    -   **Tradeoff:** Keeps the frontend snappy and simple; shifts complexity to SQL and n8n workflows.

-   **Hybrid Automation:**
    -   **Decision:** Explicit prioritization: User Override > Explicit Rule > Learned Memory > Provider Default.
    -   **Explicit Choice:** See `docs/categorization/rule_engine.md`. This avoids "black box" AI frustration by prioritizing deterministic user rules.

-   **Containerized Orchestration:**
    -   **Decision:** Using n8n via Docker for data syncing (`docker/n8n/`).
    -   **Tradeoff:** Adds infrastructure complexity (maintaining Docker compose) vs using a managed SaaS integration tool, but offers full control and privacy.

# Known Limitations

-   **Sync Latency:** Data is not real-time. It depends on the n8n polling schedule (likely daily or hourly).
-   **Single-Tenant Assumptions:** The codebase assumes a single "household" entity. There is no complex multi-tenancy or user isolation logic beyond basic RLS placeholders.
-   **Limited Mobile Optimization:** While Tailwind is used, the complex tables (Budget Planner, Transaction Master) are likely optimized for desktop/tablet "Command Center" usage.
-   **Auth Implementation:** No `middleware.ts` found. The system relies on Supabase's client-side auth state (`lib/supabase.ts`) or is intended to run in a protected local/network environment. Server-side route protection is not explicitly enforced in `app/` code.

# Assumptions & Inferences

-   **Inferred:** The system is intended to be run locally or on a private VPS (e.g., Coolify, Portainer) given the `docker-compose.yml` and `Deploy` docs.
-   **Inferred:** The `pilot_` files in `data/` suggests the system was prototyped with static data before being connected to live feeds.
-   **Assumption:** "Safe-to-Spend" logic intentionally excludes "Fixed" and "Essential" expenses, assuming those are committed, and focuses strictly on "Discretionary" cash.
