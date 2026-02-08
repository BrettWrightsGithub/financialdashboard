# Windsurf Feature Execution Plan (Workflows 19-27)

## Objective
Deliver the `.windsurf` workflow set in a dependency-safe order with clear checkpoints, acceptance criteria, and rollout gates.

## Target Repository
`/Volumes/ORICO/Projects/financialdashboard/financialdashboard`

## Non-Goals
- Do not implement against `/Volumes/ORICO/Projects/financialdashboard` (outer repo).
- Do not duplicate existing APIs/components when extension or refactor is sufficient.
- Do not merge without passing all quality gates defined below.

## Program Gates
- Gate 0: Repo and branch alignment complete.
- Gate 1: Trust foundation complete (testing + transfer correctness).
- Gate 2: Assistant and backfill complete.
- Gate 3: Unified transactions UX complete.
- Gate 4: Workflow polish complete (top-5, split tree, sidebar, mobile).
- Gate 5: Release hardening complete (docs + CI green + smoke test).

## Delivery Rules
- Use branch prefix `codex/`.
- Ship in small PRs mapped to task IDs.
- Every task must include tests or explicit test rationale.
- Keep backward compatibility for existing routes unless a migration path is provided.

## Task Board

### T00 - Preflight and Workspace Guardrails
Status: Pending  
Depends on: None

Deliverables:
- Confirm active repo root is `/Volumes/ORICO/Projects/financialdashboard/financialdashboard`.
- Create branch `codex/windsurf-phase1-foundation`.
- Record baseline: `npm run lint`, `npm test`, current failing tests.
- Add a short implementation log section in PR description template.

Acceptance Criteria:
- Commands run from correct root.
- Baseline results documented.
- No edits in outer repo.

### T01 - Testing Framework Baseline (Workflow 19)
Status: Pending  
Depends on: T00

Deliverables:
- Update `vitest.config.ts` for coverage and setup alignment.
- Add `tests/setup.ts` (or keep existing `test-setup.ts` and standardize naming consistently).
- Add `playwright.config.ts` using `baseURL` from config/environment.
- Add scripts in `package.json`:
  - `test`
  - `test:unit`
  - `test:integration`
  - `test:e2e`
  - `test:coverage`
- Add/adjust CI workflow under `.github/workflows/`.

Acceptance Criteria:
- `npm run test:unit` passes.
- `npx playwright test --list` succeeds.
- CI workflow lints and runs tests without syntax errors.

### T02 - Transfer Pair Schema Migration (Workflow 20)
Status: Pending  
Depends on: T00

Deliverables:
- Add migration for:
  - `transfer_pair_id`
  - `transfer_match_confidence`
  - `transfer_match_source`
- Add relevant indexes for pair lookup and amount/date matching.
- Validate migration against local dev database.

Acceptance Criteria:
- Migration applies cleanly up/down in local environment.
- New columns visible in generated types or typed query layer.

### T03 - Transfer Detection Service Upgrade (Workflow 20)
Status: Pending  
Depends on: T02

Deliverables:
- Refactor `lib/categorization/transferDetection.ts` from simple heuristic to modular pipeline:
  - time-window matching
  - provider pattern matching
  - fuzzy matching
  - confidence scoring
- Keep existing exported helpers stable where possible or provide migration updates.

Acceptance Criteria:
- Unit tests cover match confidence, provider patterns, and tolerance edge cases.
- Existing dependent code compiles after refactor.

### T04 - Transfer APIs and Manual Linking (Workflow 20)
Status: Pending  
Depends on: T03

Deliverables:
- Add `/app/api/transfers/detect/route.ts`.
- Add `/app/api/transfers/link/route.ts` (POST and DELETE).
- Integrate with existing per-transaction transfer toggle route.

Acceptance Criteria:
- API contract supports dry-run detect and optional autoflag.
- Manual link/unlink is bidirectional and idempotent.
- Integration tests validate at least one positive and one rollback case.

### T05 - Transfer Chain Visualization UI (Workflow 20)
Status: Pending  
Depends on: T04

Deliverables:
- Add transfer chain component/modal in transactions UI.
- Show confidence/source badges.
- Add "break link" action with confirmation.

Acceptance Criteria:
- Linked transfer renders counterpart details.
- Break link updates UI and backend state.
- E2E covers open chain, verify details, break link.

### T06 - Assistant Rule Parsing API (Workflow 21)
Status: Pending  
Depends on: T01

Deliverables:
- Add `/app/api/assistant/parse-rule/route.ts`.
- Add provider abstraction (OpenAI and optional Anthropic fallback).
- Add input validation and guarded JSON parsing.
- Add env docs for `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `LLM_PROVIDER`.

Acceptance Criteria:
- Parser returns normalized rule payload or clarification response.
- Unit tests cover merchant, amount, direction, and priority extraction.
- Missing API key returns explicit, safe error payload.

### T07 - Assistant UI and Rule Preview (Workflow 21)
Status: Pending  
Depends on: T06

Deliverables:
- Add `components/assistant/ChatAssistant.tsx`.
- Add `components/assistant/RulePreviewCard.tsx`.
- Integrate assistant into transactions page with selected transaction context.
- Ensure keyboard and mobile interaction parity.

Acceptance Criteria:
- User can send prompt, review rule preview, confirm save, cancel.
- Confirmed rules hit existing `/api/categorization/rules`.
- UI is responsive and does not block table interactions.

### T08 - Backfill Preview/Apply/Undo Flow (Workflow 22)
Status: Pending  
Depends on: T07

Deliverables:
- Reconcile existing rules APIs with desired backfill flow:
  - preview
  - apply
  - undo
- Add `components/rules/BackfillModal.tsx`.
- Add success message with undo link and batch reference.

Acceptance Criteria:
- Backfill preview shows count, amount, and sample changes.
- Apply creates batch and reports result.
- Undo endpoint restores previous state for the batch.
- Integration tests cover locked transaction exclusion.

### T09 - Unified Transactions Page (Workflow 23)
Status: Pending  
Depends on: T05, T08

Deliverables:
- Build components:
  - `components/transactions/GlobalFilters.tsx`
  - `components/transactions/ReviewQueue.tsx`
  - `components/transactions/TransactionLedger.tsx`
- Update `/app/transactions/page.tsx` to unified layout.
- Add shared filter state across review queue and ledger.
- Add bulk actions bar.

Acceptance Criteria:
- Review queue and ledger render on one page.
- Filters affect both sections consistently.
- Bulk actions apply to selected rows only.
- Existing `/review-queue` behavior preserved or redirected with notice.

### T10 - Priority Scoring and Top 5 Suggestions (Workflow 25)
Status: Pending  
Depends on: T09

Deliverables:
- Add `lib/categorization/priorityScoring.ts`.
- Add `/app/api/suggestions/top5/route.ts`.
- Add `components/dashboard/DailyBriefingCard.tsx`.
- Integrate sorting in review queue by priority score.

Acceptance Criteria:
- Scoring formula implemented as specified.
- Dashboard card loads suggestions and supports quick approve.
- Review queue ordering reflects `priorityScore`.
- Unit tests validate score normalization.

### T11 - Split Transaction Tree Visualization (Workflow 26)
Status: Pending  
Depends on: T09

Deliverables:
- Add `components/transactions/SplitTransactionTree.tsx`.
- Add split grouping logic in ledger.
- Add parent edit warning modal.
- Add split child delete behavior with parent normalization.

Acceptance Criteria:
- Parent row collapses/expands child rows.
- Discrepancy warning appears when totals mismatch.
- Child delete updates parent split state correctly.
- Unit tests cover grouping and discrepancy conditions.

### T12 - Sidebar Navigation Shell (Workflow 24)
Status: Pending  
Depends on: T09

Deliverables:
- Add `components/layout/Sidebar.tsx`.
- Add `components/layout/MobileNav.tsx`.
- Replace old top nav in `app/layout.tsx`.
- Add persisted expand/collapse state and keyboard shortcut.
- Remove or deprecate `components/Navigation.tsx`.

Acceptance Criteria:
- Desktop sidebar and mobile nav both work.
- Active route highlighting is correct.
- Persisted expanded state survives refresh.
- No regressions in header spacing and content width.

### T13 - Mobile Responsiveness Completion (Workflow 27)
Status: Pending  
Depends on: T12

Deliverables:
- Add `components/transactions/TransactionCard.tsx`.
- Add `components/mobile/CategoryBottomSheet.tsx`.
- Add `components/mobile/AssistantDrawer.tsx`.
- Add safe-area utility classes in `app/globals.css`.
- Ensure viewport metadata supports `viewport-fit=cover`.

Acceptance Criteria:
- Mobile shows card mode and desktop shows table mode.
- Touch targets meet 44px minimum.
- Bottom sheet opens, selects category, and closes via gesture/tap.
- Assistant drawer is usable on mobile without overlap bugs.

### T14 - Documentation and Rollout Hardening
Status: Pending  
Depends on: T10, T11, T13

Deliverables:
- Add/update:
  - `docs/assistant/natural_language_rules.md`
  - `docs/assistant/backfill_with_review.md`
  - `docs/categorization/transfer_detection.md`
  - `docs/testing/testing_strategy.md`
- Add rollout notes:
  - migration order
  - environment variables
  - known limitations

Acceptance Criteria:
- Docs match shipped routes/components.
- New environment requirements clearly listed.
- Support/debug notes include failure modes and recovery steps.

### T15 - Final Verification and Release Gate
Status: Pending  
Depends on: T14

Deliverables:
- Run full validation:
  - `npm run lint`
  - `npm run test:unit`
  - `npm run test:integration`
  - `npm run test:e2e`
  - `npm run build`
- Capture screenshots for:
  - unified transactions
  - transfer chain
  - assistant flow
  - mobile card view
- Produce final release checklist in PR summary.

Acceptance Criteria:
- All commands pass.
- No TypeScript errors.
- No unresolved conflicts.
- Manual smoke test passes on desktop and mobile viewports.

## Suggested PR Sequence
1. PR-1: T00-T02
2. PR-2: T03-T05
3. PR-3: T06-T08
4. PR-4: T09-T11
5. PR-5: T12-T13
6. PR-6: T14-T15

## Risks and Mitigations
- Risk: Duplicate implementations between existing and workflow-proposed routes.  
  Mitigation: Reconcile and refactor first; avoid parallel duplicate APIs.
- Risk: Regression in current review queue workflows.  
  Mitigation: Keep compatibility adapters until unified page is stable.
- Risk: Flaky E2E due to hardcoded base URL.  
  Mitigation: Use `playwright.config.ts` `baseURL`; remove hardcoded host/port in tests.

## Quick Start for Assigned Agent
1. `cd /Volumes/ORICO/Projects/financialdashboard/financialdashboard`
2. `git checkout -b codex/windsurf-phase1-foundation`
3. Execute tasks in ID order and stop at each gate for review.
4. Do not start UI polish tasks before Gate 2 is complete.
