---
description: Add and edit budgets (targets + expected inflows) with inline editing and copy-forward workflow
---

# Budget Add/Edit Implementation

This workflow implements the Budget Add/Edit functionality for the Budget Planner page, enabling users to manage budget targets and expected inflows with inline spreadsheet-style editing.

## Design Decisions (from Research)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | Budget Targets + Expected Inflows | True cashflow clarity requires visualizing expected reimbursements |
| Creation Model | Copy Forward from Last Month | Avoids template complexity; respects user's recent reality |
| Edit UX | Inline Editing (spreadsheet) | Efficiency: 1 click vs 3 clicks per category |
| Category Management | Pick from existing list only | Preserves taxonomy integrity; no on-the-fly creation |
| Rollover Logic | Exact copy, no auto-adjustments | Avoids runaway automation from one-off expenses |
| Validation | Soft guardrails (visual only) | Users may have variable income or planned withdrawals |

---

## Prerequisites

- Existing `budget_targets` table (per `docs/db-schema.md`)
- Existing `expected_inflows` table (per `docs/db-schema.md`)
- Existing `categories` table with `cashflow_group` assignments
- Current read-only `BudgetTable` component at `components/budget/BudgetTable.tsx`

---

## Implementation Steps

### Phase 1: Data Layer & API Routes

#### Step 1.1: Create Budget Management API Routes

Create API routes for CRUD operations on budget targets.

**File:** `app/api/budget-targets/route.ts`

```typescript
// GET: Fetch budget targets for a month
// POST: Create/update budget target for a category+month
// DELETE: Remove a budget target
```

Required endpoints:
- `GET /api/budget-targets?month=YYYY-MM` — Returns all targets for the month
- `POST /api/budget-targets` — Upsert a target (body: `{ category_id, month, amount, notes? }`)
- `DELETE /api/budget-targets/:id` — Remove a target

#### Step 1.2: Create Expected Inflows API Routes

Create API routes for managing expected inflows.

**File:** `app/api/expected-inflows/route.ts`

```typescript
// GET: Fetch expected inflows for a month
// POST: Create/update expected inflow
// DELETE: Remove an expected inflow
```

Required endpoints:
- `GET /api/expected-inflows?month=YYYY-MM` — Returns all expected inflows for the month
- `POST /api/expected-inflows` — Upsert an inflow
- `DELETE /api/expected-inflows/:id` — Remove an inflow

#### Step 1.3: Create Copy-Forward API Route

Create an API route to clone budget from one month to another.

**File:** `app/api/budget-targets/copy-forward/route.ts`

```typescript
// POST: Copy all targets from source month to destination month
// Body: { sourceMonth: 'YYYY-MM', destMonth: 'YYYY-MM', includeExpectedInflows: boolean }
```

Logic:
1. Fetch all `budget_targets` where `month = sourceMonth`
2. For each, upsert into `destMonth` (skip if already exists OR overwrite—TBD by user preference)
3. If `includeExpectedInflows`, copy `expected_inflows` rows similarly
4. Return count of items copied

---

### Phase 2: UI Components

#### Step 2.1: Create Inline Editable Cell Component

Create a reusable inline-edit cell for currency values.

**File:** `components/budget/InlineEditCell.tsx`

Features:
- Display mode: Shows formatted currency
- Edit mode: Input field with number formatting
- Keyboard: Enter to save, Escape to cancel, Tab to move to next
- Auto-save on blur
- Loading state during save

```typescript
interface InlineEditCellProps {
  value: number;
  onSave: (newValue: number) => Promise<void>;
  disabled?: boolean;
}
```

#### Step 2.2: Create "Left to Budget" Summary Bar

Create a visual bar showing budget allocation status.

**File:** `components/budget/BudgetAllocationBar.tsx`

Features:
- Shows: Total Income Budget | Total Allocated | Remaining
- Color coding: Green if positive, Orange/Red if negative
- No hard blocks—just visual feedback

#### Step 2.3: Create "Add Category" Dropdown

Create a dropdown to add categories not yet in the budget.

**File:** `components/budget/AddCategoryDropdown.tsx`

Features:
- Fetches categories from `categories` table
- Filters out categories already in current month's budget
- Groups by `cashflow_group` for easy navigation
- On select: Creates a new budget target with $0 amount (user then edits inline)

#### Step 2.4: Create Expected Inflows Section

Create a dedicated section for managing expected inflows.

**File:** `components/budget/ExpectedInflowsSection.tsx`

Features:
- List view of `expected_inflows` for the month
- Columns: Source | Counterparty | Expected Amount (editable) | Status | Actions
- Inline editing for amounts
- Add new inflow button (opens small form or inline row)

#### Step 2.5: Create Copy-Forward Modal

Create a modal/dialog for the copy-forward workflow.

**File:** `components/budget/CopyForwardModal.tsx`

Features:
- Triggered when navigating to a month with no budget targets
- Shows source month (previous month with data)
- Checkbox: "Include expected recurring inflows?"
- Preview of what will be copied (optional)
- Confirm/Cancel buttons

---

### Phase 3: Refactor Budget Table for Editing

#### Step 3.1: Update BudgetTable Component

Modify the existing `BudgetTable` to support inline editing.

**File:** `components/budget/BudgetTable.tsx`

Changes:
1. Add columns: "Last Month Actual" and "3-Mo Avg" (read-only, for context)
2. Replace static "Expected" column with `InlineEditCell`
3. Add "Remaining" column (Budget - Actual)
4. Add row-level actions: Hide/Remove category from budget
5. Add keyboard navigation (Tab between editable cells)

New data requirements:
- Fetch last month's actuals per category
- Fetch 3-month rolling average per category

#### Step 3.2: Add Header Actions

Add bulk action buttons to the budget table header.

Actions:
- **"Reset All to Last Month's Actuals"** — Sets each category's budget to its actual from last month
- **"Add Category"** — Opens the `AddCategoryDropdown`

---

### Phase 4: Page Integration

#### Step 4.1: Update Budget Planner Page

Refactor `app/budget-planner/page.tsx` to integrate all components.

**File:** `app/budget-planner/page.tsx`

Structure:
```
┌─────────────────────────────────────────────────────┐
│  Budget Planner          [Month Selector]           │
├─────────────────────────────────────────────────────┤
│  [BudgetAllocationBar]                              │
│  Income: $X,XXX | Allocated: $X,XXX | Left: $XXX   │
├─────────────────────────────────────────────────────┤
│  SECTION: Expected Inflows                          │
│  ┌─────────────────────────────────────────────────┐│
│  │ [ExpectedInflowsSection]                        ││
│  │ Rent, T-Mobile shares, etc.                     ││
│  └─────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────┤
│  SECTION: Budget Targets                            │
│  [Reset to Actuals] [Add Category]                  │
│  ┌─────────────────────────────────────────────────┐│
│  │ [BudgetTable with inline editing]               ││
│  │ Income, Fixed, Variable, Discretionary, etc.   ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

#### Step 4.2: Implement Empty State with Copy-Forward

When the selected month has no budget targets:
1. Show `CopyForwardModal` automatically (or as a prominent CTA)
2. Find the most recent month with budget data as the source
3. After copy, reload the page with new data

---

### Phase 5: Data Queries

#### Step 5.1: Add Query for Historical Actuals

Add a query function to fetch actuals for comparison columns.

**File:** `lib/queries.ts`

```typescript
// Get actuals for a specific month by category
export async function getActualsByCategory(month: string): Promise<CategoryActual[]>

// Get 3-month rolling average by category
export async function getThreeMonthAverage(endMonth: string): Promise<CategoryActual[]>

// Get most recent month with budget data
export async function getMostRecentBudgetMonth(): Promise<string | null>
```

#### Step 5.2: Add Mutation Functions

Add functions for saving budget changes.

**File:** `lib/queries.ts`

```typescript
// Upsert a budget target
export async function upsertBudgetTarget(
  categoryId: string, 
  month: string, 
  amount: number, 
  notes?: string
): Promise<void>

// Delete a budget target
export async function deleteBudgetTarget(id: string): Promise<void>

// Copy budget from one month to another
export async function copyBudgetForward(
  sourceMonth: string, 
  destMonth: string, 
  includeInflows: boolean
): Promise<{ targetsCopied: number; inflowsCopied: number }>
```

---

## Database Considerations

### No Schema Changes Required

The existing `budget_targets` and `expected_inflows` tables support all required functionality:

- `budget_targets`: `category_id`, `month`, `amount`, `notes`
- `expected_inflows`: `source`, `counterparty_id`, `expected_amount`, `month`, `recurrence`, etc.

### Unique Constraint Check

Ensure there's a unique constraint on `budget_targets(category_id, month)` to support upsert operations. If not present, add via migration:

```sql
ALTER TABLE budget_targets 
ADD CONSTRAINT budget_targets_category_month_unique 
UNIQUE (category_id, month);
```

---

## Testing Requirements

### Unit Tests (Vitest)
- [ ] **Inline edit logic:** `components/budget/InlineEditCell.test.tsx`
  - Test value formatting and parsing
  - Test keyboard navigation (Enter, Escape, Tab)
  - Test auto-save on blur
  - Test loading states

- [ ] **Budget calculations:** `lib/budget-calculations.test.ts`
  - Test remaining budget calculations
  - Test allocation bar logic
  - Test copy-forward calculations

### Component Tests (React Testing Library)
- [ ] **InlineEditCell component:** Test rendering and user interactions
- [ ] **BudgetAllocationBar component:** Test color coding and display logic
- [ ] **AddCategoryDropdown component:** Test category filtering and selection
- [ ] **CopyForwardModal component:** Test modal behavior and preview

### Integration Tests (Vitest + MSW)
- [ ] **API routes:** `app/api/budget-targets/route.test.ts`
  - Test GET by month
  - Test POST upsert
  - Test DELETE
- [ ] **Copy-forward endpoint:** `app/api/budget-targets/copy-forward/route.test.ts`
  - Test successful copy
  - Test duplicate handling
- [ ] **Expected inflows API:** `app/api/expected-inflows/route.test.ts`

### E2E Tests (Playwright MCP)
- [ ] **Budget CRUD Flow**
  - Navigate to Budget Planner
  - Create new budget via copy-forward
  - Edit budget amounts inline
  - Add new category
  - Verify persistence after refresh

- [ ] **Expected Inflows Management**
  - Add new expected inflow
  - Edit inflow amount
  - Delete inflow
  - Verify calculations update

---

## Verification Phase (Playwright MCP)

### Test 1: Budget CRUD and Persistence

1. **Setup:**
   - [ ] `mcp1_browser_navigate({ url: "http://localhost:3000/budget-planner" })`
   - [ ] `mcp1_browser_snapshot({ filename: "budget-initial-state" })`

2. **Copy-forward Workflow:**
   - [ ] `mcp1_browser_click({ element: "Month selector", ref: "button:has-text('Next Month')" })`
   - [ ] `mcp1_browser_snapshot({ filename: "copy-forward-modal" })`
   - [ ] `mcp1_browser_click({ element: "Copy from Previous Month button", ref: "button:has-text('Copy from Previous Month')" })`
   - [ ] `mcp1_browser_wait_for({ time: 2 })`
   - [ ] `mcp1_browser_snapshot({ filename: "budget-data-loaded" })`

3. **Inline Editing Loop:**
   - [ ] `mcp1_browser_click({ element: "First budget amount cell", ref: "[data-testid='budget-amount-0']" })`
   - [ ] `mcp1_browser_type({ element: "Budget input", ref: "[data-testid='budget-amount-0'] input", text: "1500" })`
   - [ ] `mcp1_browser_press_key({ key: "Tab" })`
   - [ ] `mcp1_browser_type({ element: "Next budget input", ref: "[data-testid='budget-amount-1'] input", text: "200" })`
   - [ ] `mcp1_browser_press_key({ key: "Enter" })`
   - [ ] `mcp1_browser_wait_for({ time: 1 })`
   - [ ] `mcp1_browser_snapshot({ filename: "updated-budget-values" })`

4. **Add Category Workflow:**
   - [ ] `mcp1_browser_click({ element: "Add Category button", ref: "button:has-text('Add Category')" })`
   - [ ] `mcp1_browser_click({ element: "Category dropdown option", ref: "option:has-text('Groceries')" })`
   - [ ] `mcp1_browser_wait_for({ time: 1 })`
   - [ ] `mcp1_browser_snapshot({ filename: "new-category-row" })`

5. **Persistence Check:**
   - [ ] `mcp1_browser_navigate({ url: "http://localhost:3000/budget-planner" })`
   - [ ] `mcp1_browser_evaluate({ function: "() => document.body.innerText.includes('1500')" })`
   - [ ] Cleanup: Remove test category if needed

### Test 2: Expected Inflows Management

1. **Setup:**
   - [ ] `mcp1_browser_navigate({ url: "http://localhost:3000/budget-planner" })`
   - [ ] `mcp1_browser_snapshot({ filename: "inflows-initial-state" })`

2. **Add Inflow:**
   - [ ] `mcp1_browser_click({ element: "Add Expected Inflow button", ref: "button:has-text('Add Expected Inflow')" })`
   - [ ] `mcp1_browser_type({ element: "Source input", ref: "[placeholder*='Source']", text: "T-Mobile Reimbursement" })`
   - [ ] `mcp1_browser_type({ element: "Amount input", ref: "[placeholder*='Amount']", text: "75" })`
   - [ ] `mcp1_browser_click({ element: "Save button", ref: "button:has-text('Save')" })`
   - [ ] `mcp1_browser_wait_for({ time: 1 })`
   - [ ] `mcp1_browser_snapshot({ filename: "new-inflow-added" })`

3. **Edit Inflow:**
   - [ ] `mcp1_browser_click({ element: "Inflow amount cell", ref: "[data-testid='inflow-amount-0']" })`
   - [ ] `mcp1_browser_type({ element: "Inflow amount input", ref: "[data-testid='inflow-amount-0'] input", text: "85" })`
   - [ ] `mcp1_browser_press_key({ key: "Enter" })`
   - [ ] `mcp1_browser_wait_for({ time: 1 })`
   - [ ] `mcp1_browser_snapshot({ filename: "inflow-amount-updated" })`

4. **Persistence Check:**
   - [ ] `mcp1_browser_navigate({ url: "http://localhost:3000/budget-planner" })`
   - [ ] `mcp1_browser_evaluate({ function: "() => document.body.innerText.includes('85')" })`
   - [ ] Cleanup: Delete test inflow

---

## Development Commands (Windows)

### Start Development Server
```bash
cmd /c "npm run dev"
```

### Run Unit Tests
```bash
cmd /c "npm run test"
```

### Run Component Tests
```bash
cmd /c "npm run test -- components"
```

### Run Integration Tests
```bash
cmd /c "npm run test -- api"
```

### Run Test Coverage
```bash
cmd /c "npm run test:coverage"
```

### Type Checking
```bash
cmd /c "npm run type-check"
```

---

## Testing Checklist

### Functional Tests
- [ ] Can edit a budget target inline and save
- [ ] Tab key navigates between editable cells
- [ ] Escape cancels edit and reverts to original value
- [ ] Adding a category creates a $0 target row
- [ ] Removing a category deletes the budget target
- [ ] Copy-forward copies all targets from source month
- [ ] Copy-forward with inflows also copies expected_inflows
- [ ] "Reset to Actuals" updates all budgets to last month's actuals
- [ ] Left-to-Budget bar updates in real-time as values change

### Edge Cases
- [ ] First-ever budget (no previous month to copy from)
- [ ] Month with partial budget (some categories, not all)
- [ ] Category with $0 budget displays correctly
- [ ] Very large numbers format correctly
- [ ] Negative expected inflows (if applicable)

### UX Tests
- [ ] Loading states shown during saves
- [ ] Error messages displayed on save failure
- [ ] Keyboard-only navigation works
- [ ] Mobile responsiveness (touch-friendly inputs)

### Playwright MCP Verification
- [ ] Navigation succeeds without 404/500 errors
- [ ] All form inputs accept data via playwright_fill
- [ ] Primary actions trigger via playwright_click
- [ ] Screenshots capture success states
- [ ] Data persists after page refresh
- [ ] No arbitrary sleeps used - relies on event-based waiting

---

## File Summary

| File | Action | Description |
|------|--------|-------------|
| `app/api/budget-targets/route.ts` | Create | CRUD for budget targets |
| `app/api/budget-targets/copy-forward/route.ts` | Create | Copy-forward endpoint |
| `app/api/expected-inflows/route.ts` | Create | CRUD for expected inflows |
| `components/budget/InlineEditCell.tsx` | Create | Reusable inline edit component |
| `components/budget/BudgetAllocationBar.tsx` | Create | Visual budget status bar |
| `components/budget/AddCategoryDropdown.tsx` | Create | Add category to budget |
| `components/budget/ExpectedInflowsSection.tsx` | Create | Manage expected inflows |
| `components/budget/CopyForwardModal.tsx` | Create | Copy-forward dialog |
| `components/budget/BudgetTable.tsx` | Modify | Add inline editing, new columns |
| `app/budget-planner/page.tsx` | Modify | Integrate all components |
| `lib/queries.ts` | Modify | Add historical actuals + mutation queries |

---

## Implementation Order

1. **API routes first** — Establish data layer before UI
2. **InlineEditCell** — Core reusable component
3. **BudgetTable refactor** — Add editing to existing table
4. **BudgetAllocationBar** — Quick win, visible progress
5. **AddCategoryDropdown** — Enable adding categories
6. **CopyForwardModal** — Enable new month setup
7. **ExpectedInflowsSection** — Complete the inflows management
8. **Testing & polish** — Keyboard nav, error handling, mobile

---

## Out of Scope (Future Enhancements)

- Auto-suggest budget adjustments based on spending trends
- Budget categories grouping/reordering
- Multi-month budget planning view
- Budget sharing between users
- Import/export budget templates
- Category creation from Budget page (intentionally excluded for taxonomy integrity)

## Finalization

- When this workflow’s steps are complete and validated, rename this file to:
  - `18_budget_add_edit_COMPLETED.md`

## Optional follow-ups

- Add unit tests for the aggregation helper to prevent regressions.
