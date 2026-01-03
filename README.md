# Financial Command Center

A personal finance “command center” that aggregates bank accounts, credit cards, Venmo flows, rental income, and debts into a single place. The goal is to make it obvious:

- Am I cashflow positive or negative this month?
- What is my safe-to-spend amount **this week**?
- Which inflows (rent, T-Mobile reimbursements, etc.) are still missing?

---

## Core Features (V1)

- **Unified transaction ledger**
  - Normalized `accounts` and `transactions` tables in Supabase.
  - Data comes from Teller, Plaid (AFCU), and Gmail (Venmo) via n8n.
- **Categorization Engine (MVP)**
  - **Rules Engine:** Programmatic categorization based on merchant, amount, etc.
  - **Payee Memory:** Learns from user overrides automatically.
  - **Review Queue:** Dedicated workflow for low-confidence/uncategorized items.
  - **Audit Trail:** Full "explainability" for why a transaction was categorized a certain way.
- **Budget Planner**
  - “Expected” values per category (income, fixed, essentials, discretionary, debt, savings).
  - “Actual” values calculated from real transactions.
  - Net Planned for the month (Income – Expenses – Savings).
- **Weekly Safe-to-Spend**
  - Uses only **discretionary** categories and ignores transfers / pass-through flows.
- **Expected vs Received income**
  - Tracks expected rent from tenants and T-Mobile shares from family.
  - Shows outstanding amounts for the current month.
- **Master Transaction Sheet**
  - Filter by date, account, cashflow group, and flags (Transfer, Pass-Through, Business).
  - Inline category edits with manual override tracking.
  - Split transaction support for multi-category purchases.

---

## Tech Stack

**Frontend**

- Next.js (App Router) with React and TypeScript.
- TailwindCSS for styling and layout.

**Data**

- Supabase (PostgreSQL) as the single source of truth.
- Key tables:
  - accounts
  - transactions
  - categories
  - budget_targets
  - counterparties
  - expected_inflows
  - category_overrides
  - categorization_rules (NEW)
  - audit_logs (NEW)

**Automations (outside this repo)**

- n8n orchestrates:
  - Teller (non-AFCU accounts)
  - Plaid (AFCU checking)
  - Gmail (Venmo “paid you” emails)
- n8n writes normalized rows into Supabase.

**Categorization Logic**

- **Hybrid approach:**
  1. **User Overrides:** Explicit manual choices (Highest priority).
  2. **Rules Engine:** Deterministic logic stored in Supabase.
  3. **Payee Memory:** Heuristic matching based on past behavior.
  4. **Plaid/Provider:** Fallback to bank-provided category.
- Logic is implemented via Supabase Stored Procedures for performance and consistency.

---

## Data Flow (High Level)

1. **Ingestion (n8n)**
   - Teller and Plaid are polled on a schedule to sync accounts and transactions.
   - Gmail node pulls Venmo emails with the label "venmo-payment" and parses payer, amount, and notes.
   - All raw events become rows in Supabase.

2. **Categorization (Waterfall)**
   - New transactions flow through the categorization engine:
     - Checked against existing overrides.
     - Checked against active rules (priority ordered).
     - Checked against payee memory.
   - Results are stored with full provenance (`categorization_method`, `rule_id`, etc.).

3. **Application (Next.js)**
   - Reads from Supabase (with appropriate RLS).
   - Computes:
     - Monthly net cashflow
     - Weekly Safe-to-Spend
     - Expected inflows not yet received
   - Renders Dashboard, Budget Planner, Transactions, and Review Queue views.

For domain details (groups, flags, and formulas), see:

- docs/financial-command-center-overview.md
- docs/db-schema.md
- docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md

---

## Screens

### 1. Dashboard

- Monthly net cashflow card (with short history).
- Weekly Safe-to-Spend number.
- Alerts:
  - Cashflow negative this month.
  - Overspend vs budget in key categories.
  - Outstanding income (rent / T-Mobile) above a threshold.

### 2. Budget Planner

- Planned vs Actual for a selected month.
- Sections:
  - Income
  - Fixed expenses
  - Debt service
  - Variable essentials
  - Discretionary
  - (Optional) Savings & Investing
- Uses budget_targets for “Expected” and transactions for “Actual”.

### 3. Transactions

- Master transaction sheet:
  - Date, Description, Category, Account, Amount.
  - Flags: Transfer, Pass-Through, Business.
- Filters:
  - Date range (default: current month).
  - Account.
  - Cashflow group (Income, Fixed, Essentials, Discretionary, Debt, Savings, Business, Transfer).
  - Toggles for hiding transfers and pass-through items.
- Inline editing:
  - Category dropdown.
  - Flag checkboxes.
  - Split transaction modal.

### 4. Review Queue (NEW)

- Dedicated view for:
  - Uncategorized transactions.
  - Low-confidence categorizations.
- Features:
  - Bulk multi-select editing.
  - "Quick accept" actions.
  - Explainability badges (why was this categorized this way?).

### 5. Rules Management (NEW)

- Admin interface for creating and managing categorization rules.
- Drag-and-drop priority ordering.
- "Dry run" testing against historical data.

---

## Local Development

### 1. Install dependencies

'''
npm install
'''

### 2. Environment variables

Create a file named .env.local in the project root with:

'''
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=service_role_key_for_server_only
'''

The service role key must only be used in server contexts (API routes or server components), never in the browser.

### 3. Run the dev server

'''
npm run dev
'''

Then open:

- http://localhost:3000

---

## Development Workflow with Windsurf

This repo is designed to play nicely with Windsurf and Cascade.

1. **Context bootstrapping**
   - When starting a coding session, instruct Windsurf to read:
     - .windsurfrules
     - README.md
     - docs/financial-command-center-overview.md
     - docs/db-schema.md
     - docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md

2. **Use workflows**
   - There are guiding files under .windsurf/workflows (e.g., `06_categorization_rule_engine_COMPLETED.md`).
   - Ask Cascade to follow a specific workflow when implementing or modifying features.

3. **Small, explicit tasks**
   - Prefer focused instructions such as:
     - “Implement the Budget Planner table using the schema in docs/db-schema.md.”
     - “Add Safe-to-Spend calculation using lib/cashflow helpers.”

4. **Keep docs as the source of truth**
   - If you (or Windsurf) change the schema or domain behavior, update:
     - docs/db-schema.md
     - docs/financial-command-center-overview.md
   - The .windsurfrules file assumes these docs are authoritative.

---

## Roadmap

**Completed (MVP Phase 1 & 2)**
- [x] Implement basic data fetching from Supabase for transactions and categories.
- [x] Build Transactions table with filters and category editing.
- [x] Implement Budget Planner view with Expected vs Actual per category.
- [x] Implement Dashboard Safe-to-Spend and cashflow cards.
- [x] Wire in expected_inflows and outstanding income logic.
- [x] **Categorization Engine:** Rules, Payee Memory, and Waterfall logic.
- [x] **Review Queue UI:** Bulk edit and explainability.
- [x] **Rules Management UI:** Priority ordering and retroactive application.
- [x] **Split Transactions:** Parent-child transaction support.

**Next Steps**
- [ ] Connect N8n workflows for live data ingestion.
- [ ] End-to-end testing with live banking data.
- [ ] Mobile responsiveness improvements.


This README should be enough context for Windsurf (and future you) to understand what the project is trying to do and how the pieces fit together.
