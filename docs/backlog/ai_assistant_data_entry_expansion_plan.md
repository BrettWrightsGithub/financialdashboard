# AI Assistant Data Entry Expansion Plan

## Objective
Expand the existing assistant from rule-only chat into a multi-surface data-entry copilot that reduces repetitive manual input while preserving confirmation and audit safety.

## Discovery Summary

### Current state
- Assistant UI exists as `ChatAssistant` and is currently mounted on Transactions page only.
- Assistant backend currently only parses and creates categorization rules.
- Most other data-entry screens remain manual form/table workflows.

### Root cause: Rules page assistant button not showing
- `ChatAssistant` is rendered on Transactions page:
  - `/Volumes/ORICO/Projects/financialdashboard/financialdashboard/app/transactions/page.tsx:7`
  - `/Volumes/ORICO/Projects/financialdashboard/financialdashboard/app/transactions/page.tsx:97`
- Rules page does not import or render `ChatAssistant`:
  - `/Volumes/ORICO/Projects/financialdashboard/financialdashboard/app/admin/rules/page.tsx:1`
  - `/Volumes/ORICO/Projects/financialdashboard/financialdashboard/app/admin/rules/page.tsx:303`

## High-Impact Assistant Opportunities (Prioritized)

## P0 - Rules Admin Assistant Visibility (Quick Win)
- Problem:
  - The rule assistant is intended for rule creation, but it is not visible on the rules page.
- Proposed:
  - Mount `ChatAssistant` on `/admin/rules` with rules-oriented prompt hints.
  - Keep current create-rule confirmation flow unchanged.
- Why high impact:
  - Immediate usability fix with minimal risk.

## P1 - Rule Form Autofill from Natural Language
- Existing manual form is dense and repetitive:
  - `/Volumes/ORICO/Projects/financialdashboard/financialdashboard/components/admin/RuleForm.tsx:107`
- Proposed:
  - Add “Generate from prompt” within `RuleForm` so typed prompts fill form fields directly.
  - Reuse existing parse pipeline (`/api/assistant/chat` + category matching).
- Value:
  - Faster rule authoring and fewer field-entry errors.

## P1 - Review Queue Bulk Command Assistant
- Current flow requires selecting rows + manual category picker:
  - `/Volumes/ORICO/Projects/financialdashboard/financialdashboard/components/transactions/ReviewQueue.tsx:149`
  - `/Volumes/ORICO/Projects/financialdashboard/financialdashboard/components/transactions/ReviewQueue.tsx:172`
- Proposed:
  - Assistant commands like:
    - “Mark selected as Groceries and learn payee.”
    - “Set selected as transfer and pass-through false.”
  - Output = previewed bulk action payload targeting `/api/transactions/bulk-edit`.
- Value:
  - Speeds repetitive queue triage.

## P1 - Split Modal Copilot
- Split creation is fully manual row-by-row:
  - `/Volumes/ORICO/Projects/financialdashboard/financialdashboard/components/transactions/SplitModal.tsx:87`
  - `/Volumes/ORICO/Projects/financialdashboard/financialdashboard/components/transactions/SplitModal.tsx:160`
- Proposed:
  - Assistant accepts pasted receipt text or short intent and proposes split lines (amount + category + optional description).
  - Hard validation still enforced (sum must match parent).
- Value:
  - Reduces biggest friction for mixed-merchant purchases.

## P2 - Expected Inflows Smart Entry
- Expected inflow add form is manual:
  - `/Volumes/ORICO/Projects/financialdashboard/financialdashboard/components/budget/ExpectedInflowsSection.tsx:95`
  - `/Volumes/ORICO/Projects/financialdashboard/financialdashboard/components/budget/ExpectedInflowsSection.tsx:245`
- Proposed:
  - Prompt-based inflow creation:
    - “Add monthly rent from Stephani, $1200, due 1st.”
  - Assistant maps counterparty/category and pre-fills fields before save.
- Value:
  - Faster setup for recurring expected income.

## P2 - Accounts Bulk Naming Assistant
- Account naming/ownership edits are one-row-at-a-time:
  - `/Volumes/ORICO/Projects/financialdashboard/financialdashboard/app/accounts/page.tsx:65`
  - `/Volumes/ORICO/Projects/financialdashboard/financialdashboard/app/accounts/page.tsx:124`
- Proposed:
  - Assistant suggests normalized display labels + owner defaults for all accounts.
  - User applies per-row or bulk.
- Value:
  - One-time cleanup convenience and consistent account naming.

## Platform Gap to Address
- Assistant backend is rule-specific today:
  - `/Volumes/ORICO/Projects/financialdashboard/financialdashboard/app/api/assistant/chat/route.ts:62`
  - `/Volumes/ORICO/Projects/financialdashboard/financialdashboard/lib/assistant/provider.ts:16`
  - `/Volumes/ORICO/Projects/financialdashboard/financialdashboard/lib/assistant/provider.ts:314`
- Needed:
  - Add action-intent layer that can produce structured outputs for:
    - `create_rule`
    - `bulk_edit_transactions`
    - `propose_split`
    - `create_expected_inflow`
    - `suggest_account_updates`
  - Always return `preview` + `requires_confirm`.

## UX Pattern Standard (Across Surfaces)
- Input prompt
- Structured preview card
- Explainable diff (what will change)
- Explicit confirm/cancel
- Post-action audit link (where applicable)

## Safety Rules
- No auto-apply without explicit confirm.
- Keep idempotent request IDs for batch actions.
- Respect `category_locked` and existing backend guardrails.
- Show validation errors inline (not silent fail).

## Implementation Tasks

### T01 - P0 Rules Visibility Fix
Deliverables:
- Render `ChatAssistant` in Rules page.
- Add rule-specific quick prompt chips.

Acceptance:
- Assistant button visible on `/admin/rules`.
- Confirmed rules still highlight via existing deep link.

### T02 - Assistant Action Contract
Deliverables:
- New typed assistant action schema in `lib/assistant/types.ts`.
- Router layer in `/api/assistant/chat` that supports multi-action responses.

Acceptance:
- Backward-compatible with current rule creation flow.

### T03 - Review Queue Command Mode
Deliverables:
- Prompt box + preview in `ReviewQueue`.
- Execute via existing `/api/transactions/bulk-edit`.

Acceptance:
- Command execution updates selected rows only.

### T04 - Split Copilot
Deliverables:
- “Suggest splits” section in `SplitModal`.
- Parser endpoint for line-item proposals from pasted text.

Acceptance:
- Suggested splits pass validation or show actionable errors.

### T05 - Expected Inflows Copilot
Deliverables:
- Prompt-to-form helper in `ExpectedInflowsSection`.
- Mapping helpers for counterparty/category lookup.

Acceptance:
- One confirmation click can create parsed inflow entries.

### T06 - Accounts Suggestion Mode
Deliverables:
- Assistant-generated row suggestions on accounts page.
- Apply selected/bulk.

Acceptance:
- Users can preview and apply account naming suggestions safely.

### T07 - Telemetry and QA
Deliverables:
- track prompt->preview->confirm funnel
- failure/error instrumentation by action type
- tests for action parsing and confirmation gating

Acceptance:
- action-level success metrics visible in logs/dashboard.

## Success Metrics
- Time to create a new rule (down).
- Review queue items processed per minute (up).
- Median time to split a transaction (down).
- Expected inflow setup time (down).
- Post-action correction rate (down).

## Suggested Rollout Sequence
1. P0 Rules visibility fix.
2. P1 Rule form autofill + review queue commands.
3. P1 Split copilot.
4. P2 Expected inflows + accounts assistant.
