# Gold-Standard User Scenarios

This document defines the high-value user workflows that represent the "20% of actions driving 80% of value" in the Financial Command Center.
All example tests below are based on a live DB snapshot taken on `2026-02-09` (latest posted transaction date in DB: `2026-02-03`).

## How To Use This

- Use these scenarios as acceptance criteria for product decisions, UX changes, and QA.
- Prefer optimizing these flows first before expanding lower-frequency features.
- Treat these as outcome-driven workflows, not just button-click paths.

## Top 10 Scenarios

### 1) Daily Money Check-In (Dashboard First)

**User goal:** Know "am I safe this week?" in under 60 seconds.  
**Primary screens:** Dashboard (`/`)  
**Core actions:**
- Open Dashboard.
- Read Safe-to-Spend card.
- Check current month cashflow status.
- Scan overspent categories alerts.
**Success signal:** User can decide immediately whether discretionary spending should pause, continue, or tighten.

**Example test (real DB data):**
- Set Dashboard month to `2026-02`.
- Verify Safe-to-Spend shows about `$69.28` remaining (`$300` monthly discretionary budget / `4.33`, with `$0` spent this week).
- Verify cashflow reflects current posted data: `Income $2,041`, `Variable Essentials $200`, `Net +$1,841`.
- Verify Outstanding Inflows includes one pending item for `T-Mobile Reimbursement` with `$30`.
- Verify Overspent Categories is empty for `2026-02`.
- Pass criteria: Values match the above numbers within normal currency rounding.

### 2) Clear The Review Queue

**User goal:** Fix uncategorized/low-confidence transactions quickly.  
**Primary screens:** Review Queue (`/review-queue`)  
**Core actions:**
- Open review queue.
- Bulk-select similar items.
- Assign correct category and apply.
- Confirm queue count decreases.
**Success signal:** Queue remains near zero and trust in reports stays high.

**Example test (real DB data):**
- Open `/review-queue` and filter month `2026-02`.
- Confirm initial count is `2`.
- Confirm rows include:
  - `6d86b99c-9e5c-4abe-be21-d593cdf50ce1` (`-184`, `Ashley Wright "Adalynn preschool"`)
  - `6a90e8f6-6415-4ec7-9c9a-f458044250fc` (`-200`, `Ashley Wright "February dates"`)
- Multi-select both and assign categories (example: `Household` and `Dining Out`, or other correct categories).
- Refresh queue.
- Pass criteria: Month review queue count drops from `2` to `0`.

### 3) Correct A Wrong Category And Teach The System

**User goal:** Fix one bad categorization and prevent repeated mistakes.  
**Primary screens:** Transactions (`/transactions`)  
**Core actions:**
- Find transaction.
- Change category inline.
- Verify category source updates to manual/learned behavior for future matches.
**Success signal:** Future same-merchant transactions auto-categorize correctly.

**Example test (real DB data):**
- In `/transactions`, find `877f20f3-7fdc-46d9-b18b-5d33eeecfeb9` (`-249.64`, `AUTOMATIC WITHDRAWAL, CAPITAL ONE CRCARDPMT WEB (S)`), currently in `Student Loan`.
- Re-categorize it to `Credit Card Payment`.
- Go to `/admin/rules` and create a rule:
  - Name: `Capital One CRCARDPMT`
  - Match contains: `CAPITAL ONE CRCARDPMT`
  - Assign category: `Credit Card Payment`
- Run preview and confirm historical matches exist (DB has 5 matching rows for this pattern in the recent set).
- Apply retroactive backfill.
- Pass criteria: matched rows move to `Credit Card Payment`, and future matching rows follow the rule.

### 4) Split A Mixed Purchase (Amazon/Costco Pattern)

**User goal:** Accurately allocate one charge across multiple categories.  
**Primary screens:** Transactions (`/transactions`)  
**Core actions:**
- Open a transaction with mixed spending.
- Split into child entries with separate categories.
- Validate totals match parent amount.
**Success signal:** Budget and category reporting reflect real spending composition.

**Example test (real DB data):**
- In `/transactions`, open `74b7a9fd-08d1-4c8e-8372-f5b99318d04c` (`2026-02-01`, `Costco`, `-200`, currently `Groceries`).
- Use Split to create:
  - Child 1: `-140` -> `Groceries`
  - Child 2: `-60` -> `Household`
- Save split.
- Pass criteria:
  - Parent becomes split parent.
  - Child amounts sum to `-200`.
  - Reporting reflects spend in both categories instead of a single `Groceries` line.

**Existing split references in DB (for validation behavior):**
- Parent `b9b62b3a-6266-4b59-9d1b-782c692562bb` (`450`) has children `449` + `1` (sum = `450`).
- Parent `cd460034-5b93-4eaa-87e3-7da364d1ede1` (`250`) has children `200` + `50` (sum = `250`).

### 5) Create Or Adjust Monthly Budget Targets

**User goal:** Set realistic monthly plan for category-level spending.  
**Primary screens:** Budget Planner (`/budget-planner`)  
**Core actions:**
- Select month.
- Edit category targets (and copy forward if useful).
- Review allocation bar and expected vs actual behavior.
**Success signal:** Budget targets are current before meaningful spending occurs.

**Example test (real DB data):**
- Open `/budget-planner`, month `2026-02`.
- Confirm current targets include:
  - `Salary 6385`
  - `Rental Income 2950`
  - `Groceries 800`
  - `Dining Out 300`
  - `Gas/Fuel 200`
  - `Subscriptions 150`
  - `Healthcare 0`
- Edit `Dining Out` from `300` to `350` and save.
- Refresh page.
- Pass criteria: `Dining Out` persists at `350`, and dashboard weekly target updates accordingly (`350 / 4.33`).

### 6) Midweek Budget Guardrail Check

**User goal:** Identify overspending early enough to recover this week.  
**Primary screens:** Dashboard (`/`), Budget Planner (`/budget-planner`)  
**Core actions:**
- Notice overspent category signal on Dashboard.
- Jump to budget details.
- Decide category tradeoff (reduce another category or stop spend).
**Success signal:** User corrects course before end-of-month surprises.

**Example test (real DB data):**
- Open Dashboard for `2026-02`.
- Verify Overspent Categories card is empty (current DB has no overspent categories for this month).
- Open Budget Planner for `2026-02` and verify:
  - `Groceries` actual spend is `200` vs budget `800`.
  - `Dining Out` is not overspent (currently no discretionary spend in week window).
- Pass criteria: app shows no overspend warning for this month with current data.

**Optional trigger test (using current data baseline):**
- Temporarily reduce `Groceries` budget from `800` to `150`.
- Return to Dashboard.
- Pass criteria: Overspent Categories should show `Groceries` overspent by about `$50`.

### 7) Track Missing Expected Inflows (Rent/Reimbursements)

**User goal:** Catch money that should have arrived but has not.  
**Primary screens:** Dashboard (`/`), Budget Planner expected inflows section  
**Core actions:**
- Review outstanding inflows card.
- Identify which counterparty is late.
- Follow up outside app and monitor resolution.
**Success signal:** Expected inflows outstanding balance trends toward zero each month.

**Example test (real DB data):**
- Open Dashboard for `2026-02`.
- Confirm Outstanding Inflows includes one pending inflow:
  - Source: `T-Mobile Reimbursement`
  - Amount: `$30`
  - Status: `pending`
- Open Budget Planner expected inflows section for `2026-02` and confirm the same pending row exists.
- Pass criteria: both Dashboard and Budget Planner show a consistent pending total of `$30`.

### 8) Confirm Transfers Are Neutral (No Double Counting)

**User goal:** Ensure internal account movement does not distort cashflow.  
**Primary screens:** Transactions (`/transactions`)  
**Core actions:**
- Filter/search recent transfer-like activity.
- Verify internal moves are flagged as transfer.
- Correct flags when needed.
**Success signal:** Net cashflow reflects true income/expense, not account shuffling.

**Example test (real DB data):**
- In `/transactions`, search `FUNDS TRANSFER`.
- Validate these rows exist and are categorized `Transfer`:
  - `f92c6701-237c-4b02-ba84-0efe41080b28` (`-300`, `FUNDS TRANSFER TO MONEY MARKET`)
  - `f402fe01-800d-49bd-b763-a0b9d3e20f23` (`+300`, `FUNDS TRANSFER FROM CHECKING`)
- Note: current DB has many transfer-category rows where `is_transfer = false` (representative cleanup target), while some are correctly true (example `6614172f-e487-4ce5-a194-e6995e288d17`).
- Update false positives/negatives so internal transfers are consistently flagged.
- Pass criteria: transfer rows are consistently marked, and dashboard net cashflow remains stable (no artificial movement from account shuffling).

### 9) Weekly Mobile Triage (Fast Corrections On Phone)

**User goal:** Keep data clean with short, low-friction sessions on mobile.  
**Primary screens:** Mobile transaction/review interactions  
**Core actions:**
- Open app on phone.
- Fix a handful of category issues.
- Use quick category selection flows.
**Success signal:** Review backlog never becomes a heavy desktop-only task.

**Example test (real DB data):**
- On mobile viewport, open review queue for `2026-02`.
- Confirm 2 pending items (same two Ashley Wright rows from Scenario 2).
- Categorize both using mobile quick category picker/drawer.
- Navigate back to dashboard and review queue badge.
- Pass criteria: badge/count reflects zero remaining for `2026-02` after mobile-only edits.

### 10) Use Assistant To Accelerate Rule/Category Work

**User goal:** Reduce manual cleanup effort via guided assistant actions.  
**Primary screens:** Assistant panel + rule preview flows  
**Core actions:**
- Ask assistant to help with categorization/rule intent.
- Review proposed rule/output.
- Accept and apply where appropriate.
**Success signal:** Time spent on repetitive categorization declines week over week.

**Example test (real DB data):**
- Open assistant and request: "Create a categorization rule for `Quickbooks Deposit` inflows to `Side Income`."
- Validate this is a high-value candidate:
  - DB currently has `16` `Quickbooks Deposit` transactions.
  - At least `4` recent ones are uncategorized (e.g., `e8d48082-2b27-4208-89dd-fa5ff30ccf60`, `2a0f4751-2d32-401f-8420-dab3c39e0ee3`, `bd7abbf8-5f25-4aeb-a961-367ea6a19302`, `715c5459-955f-497d-93a5-9cd85094951d`).
- Review the assistant-generated rule draft, confirm target category is `Side Income`, and apply.
- Run rule preview/backfill from Rules Admin.
- Pass criteria: matching Quickbooks rows are categorized, and review queue count drops accordingly for affected months.

## Prioritized "Core 5" (If You Need A Lean Benchmark)

If the team wants a minimal benchmark, prioritize these first:

1. Daily Money Check-In (Scenario 1)
2. Clear The Review Queue (Scenario 2)
3. Correct A Wrong Category And Teach The System (Scenario 3)
4. Split A Mixed Purchase (Scenario 4)
5. Create Or Adjust Monthly Budget Targets (Scenario 5)
