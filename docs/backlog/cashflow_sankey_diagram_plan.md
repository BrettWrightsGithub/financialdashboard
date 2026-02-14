# Cashflow Sankey Diagram - Implementation Plan

## Objective
Add a Sankey diagram to the dashboard that visualizes how money flows from income streams to outflow buckets, so users can quickly understand monthly cashflow composition.

## Feature Definition
- Add a new dashboard card that renders a Sankey diagram for the selected month.
- Left side: income streams (top contributors).
- Middle: cash pool for the month.
- Right side: outflow buckets (Fixed, Variable Essentials, Discretionary, Debt, Savings/Investing, Business Outflow, etc.).
- Include balancing flow so the diagram always reconciles:
  - Surplus month: `Cash Pool -> Net Increase`.
  - Deficit month: `Prior Cash/Credit -> Cash Pool`.

## Discovery Summary (Current Codebase)
- Dashboard screen is `app/page.tsx` and already loads month-scoped aggregates via `getDashboardData(selectedMonth)` in `lib/queries.ts`.
- Existing cashflow semantics are already defined and used:
  - Include only active accounts where `include_in_cashflow = true`.
  - Exclude transfers (`is_transfer`) and split parents (`is_split_parent`).
  - Posted transactions only.
- No charting/Sankey library is currently installed in `package.json`.
- Existing dashboard cards are componentized in `components/dashboard/*` and tested by Playwright in `e2e/dashboard.spec.ts`.
- Existing backlog docs favor explicit scope, deliverables, acceptance criteria, and risks.

## Proposed UX
- Card title: `Cashflow Flow Map`.
- Subtitle: selected month label (same source as existing month selector).
- Diagram behavior:
  - Nodes and links colored by semantic type (`income`, `outflow`, `balance`).
  - Hover state shows amount and percentage contribution.
  - Compact legend under chart.
- Empty/partial states:
  - If no qualifying transactions, show a clear empty state.
  - If only inflows or only outflows exist, still render with balancing node.
- Mobile behavior:
  - Horizontal scroll container for the SVG on narrow widths.
  - Labels truncate with tooltip/title for full text.

## Data Design
Create a deterministic Sankey payload derived from month transactions.

### Data Inputs
- `transactions` (month, posted) from `transactions` table.
- `accounts` for `include_in_cashflow`.
- `categories` (`id`, `name`) for readable stream labels.

### Data Rules
- Base filter (must match existing dashboard math):
  - `status = posted`
  - account is included in cashflow
  - `is_transfer = false`
  - `is_split_parent = false`
- Income streams:
  - Positive amounts from `cashflow_group = Income` plus positive `Business` transactions.
  - Group key priority: category name -> counterparty name -> `Uncategorized Income`.
  - Top N streams shown individually; remainder collapsed into `Other Income`.
- Outflows:
  - Negative amounts grouped by cashflow bucket:
    - `Fixed`, `Variable Essentials`, `Discretionary`, `Debt`, `Savings/Investing`
    - `Business` negative amounts grouped as `Business Outflow`.
  - Use absolute value for visual link magnitude.
- Balancing:
  - If inflow > outflow: add outflow node `Net Increase`.
  - If outflow > inflow: add inflow node `Prior Cash/Credit`.

### Output Contract
Add a typed object returned with dashboard data:
- `nodes: Array<{ id; label; kind; value; color }>`
- `links: Array<{ source; target; value; kind }>`
- `totals: { inflow; outflow; net }`
- `meta: { topIncomeCount; month }`

## Technical Design

### 1) Add Sankey data builder
- New file: `lib/cashflowSankey.ts`
- Responsibilities:
  - Normalize and group streams.
  - Build balanced node/link graph.
  - Sort nodes/links deterministically for stable rendering and tests.
- Add pure unit-testable helpers (grouping, balancing, top-N collapsing).

### 2) Extend dashboard aggregate query
- Update `lib/queries.ts`:
  - Fetch `categories` in parallel with existing dashboard queries.
  - Build Sankey payload from already fetched transactions/accounts.
  - Return `cashflowSankey` with existing `getDashboardData` response.

### 3) Add Sankey card component
- New file: `components/dashboard/CashflowSankeyCard.tsx`
- Use `d3-sankey` for layout calculation and render via SVG in React.
- Keep rendering logic side-effect free with memoization (`useMemo`) to avoid layout recalculation churn.

### 4) Integrate card on dashboard
- Update `app/page.tsx`:
  - Extend `DashboardData` type with Sankey payload.
  - Render Sankey card in secondary grid (likely replacing or sharing row with trend/overspent cards).
  - Ensure month selector updates Sankey along with existing cards.

### 5) Dependencies
- Add runtime deps:
  - `d3-sankey`
  - `d3-scale` (if needed for color scale utility)
- Add TS types if required:
  - `@types/d3-sankey` (only if package version lacks built-in types)

## Implementation Tasks

### T01 - Types and Data Builder
Deliverables:
- `lib/cashflowSankey.ts` with strong types and pure build function.
- Internal constants for bucket ordering and color tokens.

Acceptance Criteria:
- Function returns balanced graph for surplus, deficit, and neutral months.
- Transfers/split parents are excluded.
- Output is deterministic for identical input.

### T02 - Query Integration
Deliverables:
- `lib/queries.ts` returns `cashflowSankey` from `getDashboardData`.
- Dashboard type updated where consumed.

Acceptance Criteria:
- No change/regression to existing net cashflow numbers.
- Sankey totals reconcile with dashboard totals (`net = inflow - outflow`).

### T03 - UI Component
Deliverables:
- `components/dashboard/CashflowSankeyCard.tsx`.
- Clear loading/empty states and responsive wrapper.

Acceptance Criteria:
- Diagram renders for months with data.
- Node/link hover shows formatted currency and percent.
- Card remains usable at mobile width.

### T04 - Dashboard Placement and Polish
Deliverables:
- `app/page.tsx` placement update.
- Style alignment with existing card system (`card`, slate theme classes).

Acceptance Criteria:
- No layout breakage desktop/mobile.
- Month changes update diagram without stale state.

### T05 - Test Coverage
Deliverables:
- Unit tests: `lib/cashflowSankey.test.ts`
- Component test: `components/dashboard/CashflowSankeyCard.test.tsx` (render + empty state + key labels)
- E2E additions in `e2e/dashboard.spec.ts` (card presence + month change refresh)

Acceptance Criteria:
- `npm run test:unit` passes with new tests.
- Dashboard E2E includes Sankey visibility assertions.

## Test Matrix
- Surplus month (inflow > outflow): includes `Net Increase`.
- Deficit month (outflow > inflow): includes `Prior Cash/Credit`.
- Mixed business flows (positive and negative business in same month).
- Uncategorized income fallback naming.
- All transfers/pending/split-parent rows excluded.
- Mobile viewport snapshot or assertion for scroll container presence.

## Risks and Mitigations
- Risk: Sankey can imply direct source-to-expense causality not present in raw data.
  - Mitigation: label middle node as pooled cash and add helper text "flows are allocation view for the month."
- Risk: Dependency weight and rendering complexity.
  - Mitigation: use only `d3-sankey` and render with plain SVG, no large chart framework.
- Risk: Label crowding with many income streams.
  - Mitigation: top-N + `Other Income` collapse, truncation + tooltip.

## Open Product Decisions
1. Should pass-through transactions be included in Sankey (current dashboard net includes them)?
2. Should right-side outflows remain grouped by `cashflow_group` in v1, or be category-level immediately?
3. Preferred placement:
   - Replace `Cashflow Trend`, or
   - Add as an additional card row beneath existing secondary cards?

## Rollout Plan
1. Ship behind a small feature flag constant in UI for easy rollback.
2. Validate against one known historical month with manually checked totals.
3. Remove flag after verification pass and keep tests as regression guard.
