# Prioritized Requirements & Implementation Plan

**Strategy:** "Trust & Ease of Use"

**Goal:** Establish data integrity first, then implement an AI Assistant to drastically reduce the friction of maintaining that data.

---

## Phase 1: Foundation of Trust (Data Integrity)

**Objective:** Ensure the "Safe-to-Spend" number is mathematically accurate and the system is stable.

### 1. Application Maintenance & Testing Framework (Feature #13)

**Context:** Extends workflow 05 (Data Validation) and workflow 14 (Stored Procedures).

**Research Alignment:** "Legacy systems failed due to passive aggregation." Active verification is required to ensure the "Command Center" metrics (Net Cashflow, Safe-to-Spend) are always trustworthy.

#### Functional Requirements

1. **Unit Testing (Vitest):**
   - **Cashflow Logic:** Verify NetCashflow = Income - Expenses handles `is_transfer` and `is_pass_through` flags correctly.
   - **Rule Engine:** Test regex matching, amount range logic, and priority collision (Rule A vs Rule B).
   - **Date Boundaries:** Verify "Weekly Safe-to-Spend" correctly handles month-end overlaps.

2. **Integration Testing:**
   - **Supabase RPC:** Verify `fn_run_categorization_waterfall` correctly updates `category_id` and logs to `category_audit_log`.
   - **Rollback Safety:** Test `fn_undo_batch` to ensure it cleanly reverses a bad batch update.

3. **End-to-End (E2E) Critical Paths:**
   - User logs in → Views Dashboard → Safe-to-Spend matches Database calculation.
   - User edits transaction category → Audit log updates → Cashflow recalculates.

#### Technical Implementation

- **Stack:** Vitest, Supabase Local (Docker), Playwright_mcp, React Testing Library.
- **CI/CD:** Github Actions pipeline to run tests on PR.
- **Coverage Target:** 100% coverage on `lib/cashflow.ts` and `supabase/migrations/`.

---

### 2. Internal Transfer Detection & Visualization (Feature #12)

**Context:** Enhances workflow 08 (Transfer Handling).

**Research Alignment:** "Sankey Diagrams" and "Cash Flow" best practices (Monarch/Copilot) emphasize neutralizing internal movements to avoid double-counting.

#### Functional Requirements

1. **Detection Algorithm (Background/On-Sync):**
   - **Time Window:** Identify transactions with identical amounts (+/-) within a 3-day window.
   - **Fuzzy Matching:** Match Venmo - Cashout (Inflow) with Venmo (Transfer Out) even if descriptions differ slightly.
   - **Provider Patterns:** Hard-coded detection for "Zelle to Self", "Amex Payment", "Chase Transfer".

2. **Auto-Flagging:**
   - Mark identified pairs as `is_transfer = TRUE`.
   - Assign `category_id` to "Internal Transfer" (neutral cashflow group).

3. **Visualization (The "Chain"):**
   - In Transaction Detail view, show the "Counterpart Transaction".
   - Example: "This Credit Card payment of -$500 is linked to Checking withdrawal of -$500."
   - Allow users to "Break Link" if false positive.

#### Edge Cases

- **Split Transfers:** $1000 withdrawal pays for two $500 credit card payments.
- **Fees:** Venmo instant transfer (Withdrawal $100, Deposit $99.50). Algorithm must allow configurable tolerance (e.g., 1%).

---

## Phase 2: The "Assistant" Interface (Interactive Automation)

**Objective:** Remove "Form Fatigue" by interacting with the app via chat.

### 3. Natural Language Rule Creation (Feature #1)

**Context:** Replaces/Augments workflow 06 (Rules Engine).

**Research Alignment:** "Hybrid Intelligence" – synthesizing deterministic logic (JSON rules) via adaptive reasoning (LLM).

#### User Story

As a user, I see a recurring "Starbucks" charge. Instead of opening a settings menu, I click the "Assistant" icon and type: "Categorize Starbucks under $15 as Coffee, but over $15 as Dining." The Assistant confirms the rule and saves it.

#### Functional Requirements

1. **Chat Interface:**
   - Floating Action Button (FAB) or dedicated sidebar available on the Unified Transactions Page.
   - Context aware: If I have a transaction selected, the chat knows I'm referring to it.

2. **LLM Processing:**
   - **Input:** Natural language string + (Optional) Selected Transaction JSON.
   - **System Prompt:** "Map user intent to categorization_rules schema."
   - **Output:** JSON object matching the DB schema (`merchant_match`, `amount_min`, `amount_max`, `new_category_id`).

3. **Verification Flow:**
   - Assistant displays the generated rule card: "Here is the rule I designed. Does this look right?"
   - User clicks "Confirm" → Calls `POST /api/categorization/rules`.

#### Technical Implementation

- **Model:** OpenAI GPT-4o-mini or Claude 3 Haiku (low latency, high structure).
- **Schema Mapping:**
  - `merchant_match_type`: Infer exact vs contains based on user phrasing.
  - `priority`: Default to "Medium" (50) unless user specifies "Always" (High) or "If nothing else matches" (Low).

---

### 4. Backfill with Review (Feature #2)

**Context:** Extends workflow 13 (Retroactive Rules).

#### Functional Requirements

1. **Trigger:**
   - Immediately after creating a rule (via Chat or Form), ask: "Do you want to apply this to existing transactions?"

2. **Impact Analysis (Preview):**
   - Query DB for all matching transactions.
   - Display: "This will affect 43 transactions totaling $1,250."
   - Show "Before/After" table for the top 5 examples.

3. **Execution:**
   - On confirmation, fire `fn_run_categorization_waterfall` for the specific rule ID.
   - Show progress bar for large datasets.
   - **Undo Capability:** Create a `rule_application_batch` ID so the user can revert if the backfill ruins their history.

---

### 5. Unified Transactions & Review Page (Feature #17)

**Context:** Merges workflow 04 (Transactions) and workflow 10 (Review Queue).

**Research Alignment:** The "Command Center" model requires a single source of truth, not fragmented views.

#### Functional Requirements

1. **Unified Layout:**
   - **Top Section (Actionable):** "Review Queue" / "Top 5 Suggestions" (collapsible).
   - **Bottom Section (History):** Full Transaction Ledger (searchable, filterable).

2. **Global Filters:**
   - Filters (Date, Account, Category) apply to both sections to maintain context.

3. **Review Mode Indicators:**
   - Transactions needing review have a distinct visual state (e.g., yellow border or badge).
   - "Approve" checkmark appears on hover for single-click confirmation.

4. **Assistant Integration:**
   - The Chat Assistant lives in this view, ready to take action on selected rows.

---

## Phase 3: Workflow Polish (Daily Drivers)

**Objective:** Optimize the visual experience once the AI workflow is established.

### 6. Modern Sidebar Navigation (UI Overhaul)

**Context:** Modernizes the application shell for better space utilization and usability. Replaces the traditional top navbar with a collapsible side drawer.

#### Functional Requirements

1. **Left-Side Drawer (Collapsible):**
   - **State:** Collapsible (Icon-only mode) vs Expanded (Icon + Label).
   - **Behavior:** Fixed to the left viewport height. Main content area adjusts width accordingly.
   - **Responsiveness:** On mobile, drawer is hidden by default and toggled via hamburger menu (overlay mode).

2. **Navigation Structure:**
   - **Top Section:** App Logo/Brand, Dashboard, Unified Transactions, Budget Planner.
   - **Bottom Section (Fixed):** User Profile, Settings (Gear Icon).

3. **Settings Access:**
   - **Gear Icon:** Located at the absolute bottom of the sidebar.
   - **Action:** Clicking the gear icon navigates directly to the `/admin` page (or opens a settings modal with Admin link).

---

### 7. Daily Top 5 Categorization Suggestions (Feature #18)

**Context:** Smart sorting for the "Unified Page".

#### Functional Requirements

1. **Scoring Algorithm:**
   - Calculate `PriorityScore = (Frequency * 0.4) + (Amount * 0.3) + (Uncertainty * 0.3)`.
   - Transactions with high scores float to the "Top Section" of the Unified Page.

2. **Daily Refresh:**
   - "Daily Briefing" card: "Good Morning! You have 3 high-value transactions to review."

3. **Quick Actions:**
   - "Accept Suggestion" (if AI has a guess).
   - "Create Rule" (opens Assistant).

---

### 8. Visual Hierarchy for Split Transactions (Feature #3)

**Context:** Extends workflow 09 (Splitting).

#### Functional Requirements

1. **Tree View:**
   ```
   Parent Transaction (Total $100)
   └─ Child (Groceries $60)
   └─ Child (Home Goods $40)
   ```

2. **Interaction:**
   - Collapsing the Parent hides the Children.
   - Editing the Parent warns user ("This will reset split categories").
   - Deleting a Child prompts to redistribute the remaining amount or delete the Parent.

---

### 9. Mobile Friendliness (Feature #4)

**Context:** Global UI update.

#### Functional Requirements

1. **Responsive Tables:**
   - On Mobile (<768px): Convert Transaction Table rows into "Cards".
   - Hide low-priority columns (Transaction ID, Original Description).

2. **Touch Targets:**
   - Ensure "Approve/Reject" buttons are min 44px height.

3. **Assistant Drawer:**
   - On mobile, the Assistant Chat opens as a bottom-sheet drawer (half-height) to allow viewing data while typing.

---

## Implementation Priority Order

1. **Phase 1 (Foundation):** Features #13, #12
2. **Phase 2 (Assistant):** Features #1, #2, #17
3. **Phase 3 (Polish):** Features #6, #18, #3, #4

## Success Metrics

- **Trust:** 100% test coverage on critical paths, zero cashflow calculation errors
- **Ease of Use:** 80% reduction in clicks for rule creation via Assistant
- **Adoption:** Users interact with Assistant 3+ times per week
