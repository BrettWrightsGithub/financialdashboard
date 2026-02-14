# Unified Media Intake (Receipts + CSV) - Discovery and Implementation Plan

## Objective
Create a no-native-app intake system that lets users submit receipt photos/PDFs and CSV statements, then automatically:
1. extract transaction details,
2. match to existing bank/card transactions when possible,
3. propose itemized splits/categories,
4. apply with user confirmation and full auditability.

## Scope Decision (Updated)
- **In scope (V1):**
  - Mobile/desktop web upload (`Take photo / Upload receipt`)
  - CSV statement upload for unlinked accounts
  - Shared review/apply workflow for both channels
- **Out of scope (V1):**
  - Email-forwarded receipt ingestion
- **Reason:**
  - Reduce security/privacy and operational risk in early rollout.

## Product Recommendation (No Mobile App Required)

### Recommended V1 channels
1. **Mobile web upload/camera capture** (primary)
2. **CSV statement upload** (unlinked accounts and bulk backfill)

### Why this is the best no-app approach
- Browser file input with `accept="image/*"` + `capture` supports camera-first upload on mobile.
- CSV upload closes the data gap for unlinked accounts without new bank integrations.
- A shared review queue keeps accuracy high before any apply action.

## External Research Findings (Design Weighting)
- Web camera capture through file input is widely practical.
- Web Share Target is install/PWA-dependent and should remain optional later.
- Conclusion: primary UX should be direct web upload, not OS share or email relay.

## Existing System Fit (Current Repo)
- Current system already has:
  - transaction model supporting manual providers (`provider = manual`)
  - split parent/child model and APIs (`/api/transactions/split`)
  - categorization/override and audit infrastructure
- Current gap:
  - no unified intake inbox for receipts + CSV
  - no receipt OCR extraction pipeline
  - no transaction-receipt matching queue
  - no CSV import mapping/preview workflow

## UX Design

### New page: `app/intake/page.tsx` (`Intake Inbox`)
Sections:
1. **Quick Add**
   - `Take photo / Upload receipt`
   - `Upload CSV statement`
2. **Processing Queue**
   - statuses: `received`, `parsed`, `matched`, `needs_review`, `ready_to_apply`, `applied`, `error`
3. **Review Workspace**
   - extracted merchant/date/amount
   - candidate transaction match + confidence
   - line items + category suggestions
   - totals reconciliation check
4. **History & Undo**
   - applied batches
   - undo links for split/import batches

### Key user flows

#### Flow A: Costco paper receipt
1. User taps `Take photo` on mobile web.
2. OCR extracts merchant/date/total/line items.
3. Matcher proposes candidate card transaction(s) by amount/date/merchant.
4. User confirms match and edits line-item categories as needed.
5. App applies split to matched parent transaction through existing split service.

#### Flow B: CSV statement from unlinked account
1. User uploads CSV.
2. Mapping wizard aligns fields (date/description/amount/account).
3. Preview shows dedupe collisions and parse issues.
4. User confirms import batch.
5. Imported rows become transactions with `provider = manual_csv`.

## Technical Architecture

### A) Intake channels

#### 1) Web upload
- `POST /api/intake/upload`
- Accepts image/pdf/csv
- Stores artifact in Supabase Storage
- Creates intake job row

#### 2) CSV importer
- `POST /api/intake/csv/preview`
- `POST /api/intake/csv/apply`
- Performs row validation, normalization, and idempotent dedupe

### B) Extraction and matching pipeline

#### Extraction
- Service layer: `lib/intake/extraction/*`
- Output contract:
  - `merchant_name`
  - `transaction_date`
  - `total_amount`
  - `tax/tip/shipping` when available
  - `line_items[]` with per-item confidence

#### Matching
- Candidate lookup on existing transactions:
  - date window: ±7 days
  - amount tolerance with tax/tip/shipping drift rules
  - merchant similarity scoring
  - split/locked-state penalties
- Confidence tiers:
  - `high`: preselect candidate
  - `medium`: user required to confirm candidate
  - `low`: unmatched queue

#### Apply behavior
- If matched to existing transaction:
  - call existing split path (`/api/transactions/split`)
- If unmatched and user chooses create:
  - create manual transaction (`provider = manual_receipt`)

### C) Data model additions

1. `intake_artifacts`
- `id`, `source_type` (`upload`, `csv`, `amazon_extension`)
- `storage_path`, `mime_type`, `size_bytes`
- `received_at`, `status`, `error_message`

2. `intake_extractions`
- `id`, `artifact_id`
- `merchant_name`, `date`, `currency`, `total_amount`
- `raw_extraction_json`, `extraction_confidence`

3. `intake_line_items`
- `id`, `extraction_id`
- `description`, `quantity`, `unit_price`, `line_total`
- `suggested_category_id`, `confirmed_category_id`

4. `intake_matches`
- `id`, `extraction_id`
- `transaction_id` (nullable)
- `match_confidence`, `match_reason`, `status`
- `applied_batch_id` (nullable)

5. `csv_import_batches` / `csv_import_rows`
- mapping config, row-level parse outcomes, dedupe outcomes

## API Surface (Proposed)
- `POST /api/intake/upload`
- `POST /api/intake/csv/preview`
- `POST /api/intake/csv/apply`
- `GET /api/intake/queue`
- `POST /api/intake/match`
- `POST /api/intake/apply`
- `POST /api/intake/undo-batch`

## AI / Parser Strategy

### V1 strategy
- Use dedicated OCR/receipt extraction with strict normalization.
- Use deterministic validation before any apply action.
- Use LLM only as optional fallback for ambiguous line-item category suggestions.

### Safety rules
- Never auto-apply on low-confidence extraction/match.
- Block apply on total mismatch above threshold unless user explicitly overrides.
- Keep raw artifact + extraction records for traceability.

## CSV Import UX and Rules

### Mapping wizard requirements
- Required:
  - `date`
  - `description`
  - `amount` (or `debit` + `credit`)
- Optional:
  - account label
  - running balance
  - reference/memo

### Dedupe strategy
- Deterministic `source_row_hash` from normalized row fields
- Fuzzy collision checks against existing transactions
- User choices: `merge`, `skip`, `import new`

## Implementation Tasks

### T01 - Intake Schema + Types
Deliverables:
- Supabase migration for intake tables and indexes
- `types/database.ts` updates

Acceptance:
- idempotent artifact creation and queue fetch

### T02 - Upload + Queue APIs
Deliverables:
- `/api/intake/upload`
- `/api/intake/queue`
- job status state machine

Acceptance:
- uploaded artifacts appear in queue with durable status transitions

### T03 - Receipt Extraction Service
Deliverables:
- extraction adapter + normalization layer
- confidence/error taxonomy

Acceptance:
- merchant/date/total extraction on test corpus
- line-item extraction where structurally available

### T04 - Matching Engine + Review APIs
Deliverables:
- matcher service and thresholds
- APIs for manual link/reject/retry

Acceptance:
- high/medium/low behavior matches specification

### T05 - Apply to Transactions
Deliverables:
- apply endpoint integrating split service
- unmatched create-manual-transaction branch

Acceptance:
- matched apply creates split children and excludes parent from cashflow
- unmatched apply can create audited manual transaction

### T06 - CSV Importer
Deliverables:
- preview/apply endpoints
- mapping UI + row-level validation

Acceptance:
- user can import unlinked statement rows with preview + dedupe

### T07 - Intake Inbox UI
Deliverables:
- `app/intake/page.tsx`
- components:
  - `IntakeQuickAdd`
  - `IntakeQueueTable`
  - `IntakeReviewPanel`
  - `CsvMappingWizard`

Acceptance:
- full end-to-end web flow without native app requirements

### T08 - Amazon Extension Integration Hook
Deliverables:
- shared intake contract allowing `source_type = amazon_extension`
- source filter/tabs in intake queue

Acceptance:
- Amazon-imported payloads can be reviewed/applied in same intake workspace

### T09 - Tests + Hardening
Deliverables:
- unit tests for normalization/matching/dedupe
- integration tests for upload->extract->match->apply
- e2e for intake review and CSV preview/apply

Acceptance:
- retry-safe idempotence (no duplicate apply)
- clear user-facing errors for parse/extraction failures

## Risks and Mitigations
- OCR quality variance on long/poor receipts:
  - Mitigation: confidence gating + edit-before-apply UI
- Incorrect transaction matching:
  - Mitigation: no silent auto-apply; explicit review for medium/low confidence
- CSV format diversity:
  - Mitigation: mapping templates + strict preview validator
- Media privacy concerns:
  - Mitigation: retention policy, delete controls, audit trails

## Success Metrics
- `% receipts auto-matched to existing transactions` (up)
- `% mixed-merchant transactions split via intake` (up)
- `manual entry count per month` (down)
- `time from upload to applied` (down)
- `post-apply correction rate` (down)

## Open Decisions
1. V1 CSV templates: common-bank presets at launch, or generic mapper first?
2. Default retention period for raw receipt images/PDFs?
3. Should unmatched receipts auto-create draft manual transactions, or stay review-only?
4. Launch intake as standalone page only, or also expose “Add to Intake” shortcuts on Transactions page?

## Suggested Phasing
1. Phase 1: Web upload + extraction + match + review + apply.
2. Phase 2: CSV import preview/apply + dedupe templates.
3. Phase 3: Optional installed-PWA share target and improved category suggestion model.

## Sources (External Research)
- [MDN: HTML `capture` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture)
- [MDN: `share_target` manifest member](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target)
- [Chrome Developers: Web Share Target API](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target)
- [Can I Use: Web Share Target](https://caniuse.com/?search=web%20share%20target)
- [web.dev: PWA OS integration](https://web.dev/learn/pwa/os-integration)
