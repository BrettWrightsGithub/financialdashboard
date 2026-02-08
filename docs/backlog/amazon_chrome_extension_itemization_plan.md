# Amazon Itemization Chrome Extension - Discovery and Implementation Plan

## Objective
Ship a Chrome extension that captures Amazon order line items and routes them into the app’s **shared Intake Inbox** workflow so users can review, match, and apply accurate splits to bank/card transactions.

## Discovery Summary

### Competitive signal: Amazon Order History Reporter (`mgkilgclilajckgnedgjgnfdokkgnibi`)
- Scale/traction: 50,000 users, 4.3 rating, 413 ratings.
- Strengths (most repeated):
  - large-history export utility
  - strong trust signal from open-source posture
  - broad marketplace support
- Weaknesses (most repeated):
  - security/privacy concern perception
  - long-run performance complaints
  - UX confusion around export workflows

### Competitive signal: Amazon Transaction Itemizer (`lfngfhljagbfadffnfodfpgmgeddeakf`)
- Scale/traction: 620 users, 4.3 rating, 14 ratings.
- Strengths (most repeated):
  - directly solves Amazon lumped-merchant pain
  - improves budgeting speed when extraction works
- Weaknesses (most repeated):
  - US-only domain limitation
  - incomplete extraction in some cases
  - requests for better export/interoperability

### Implications for our design
1. Accuracy and trust are more important than one-click automation.
2. Review-before-apply is mandatory.
3. V1 should prioritize one high-quality marketplace before expansion.
4. Reuse a single intake/match/apply UX so users are not forced into separate flows.

## Scope Alignment With Unified Intake
- This feature is a **source adapter** into:
  - `/Volumes/ORICO/Projects/financialdashboard/financialdashboard/docs/backlog/unified_media_intake_receipts_csv_plan.md`
- Amazon should not build a parallel matching/apply stack.
- Amazon payloads should land in shared intake tables with `source_type = amazon_extension`.

## Proposed Product Flow

### User workflow (end-to-end)
1. User installs “Financial Dashboard Amazon Itemizer” extension.
2. Extension automatically provisions/refreshes a revocable scoped ingest token in background.
3. On Amazon Orders pages, extension extracts order + line-item details.
4. Extension uploads normalized payloads to intake source endpoint.
5. App ingests payload into Intake Inbox and runs shared matching.
6. User reviews candidate matches and split lines in Intake Review Workspace.
7. User confirms/edits and applies split to target transaction.

### UX principles
- Never auto-apply splits without explicit confirmation.
- Show match confidence and mismatch reasons.
- Provide visible ingestion diagnostics:
  - parsed orders
  - matched orders
  - unmatched/review-required orders
- Deep-link extension popup directly to filtered Intake Inbox view (`source=amazon_extension`).

## Technical Architecture

### A) Chrome extension (Manifest V3)
- New folder: `extensions/amazon-itemizer/`
- Components:
  - `manifest.json`
  - content script(s) for order scraping
  - background service worker for token + upload queue
  - popup UI for status/connect/sync
  - options page for marketplace toggles and diagnostics
- Initial domain permissions:
  - `amazon.com` (V1)

### B) Shared intake integration

#### Source ingest API
1. `POST /api/intake/sources/amazon/ingest`
   - validates scoped token and payload schema
   - writes/updates `intake_artifacts` + source-specific order tables
   - idempotent by `(marketplace, provider_order_id)`

#### Shared processing APIs (already planned under Intake)
2. `POST /api/intake/match`
3. `POST /api/intake/apply`
4. `GET /api/intake/queue?source=amazon_extension`

### C) Data model approach

#### Reuse shared intake tables
- `intake_artifacts` (`source_type = amazon_extension`)
- `intake_extractions`
- `intake_line_items`
- `intake_matches`

#### Add Amazon source metadata tables
1. `external_orders`
- `id`
- `intake_artifact_id`
- `marketplace`
- `provider_order_id`
- `order_date`
- `order_total`
- `currency`
- `raw_payload_json`
- unique `(marketplace, provider_order_id)`

2. `external_order_items`
- `id`
- `external_order_id`
- `item_title`
- `quantity`
- `unit_price`
- `line_total`
- `raw_item_json`

## Matching and Apply Rules
- Reuse shared intake matching engine:
  - date window ±7 days
  - amount tolerance
  - merchant similarity
  - split/locked penalties
- V1 simplifying assumption:
  - one Amazon order maps to one card/bank transaction
- Reuse shared apply behavior:
  - if matched: split existing transaction through existing split service
  - if unmatched and user chooses create: manual transaction option (same as intake)

## UX Surfaces to Build

### 1) Intake Inbox integration
- No separate “Amazon-only” review page required in V1.
- Add source filters/chips:
  - `All`
  - `Receipts Upload`
  - `CSV`
  - `Amazon Extension`

### 2) Extension popup
- connection state
- latest extraction/upload status
- counts by status (matched/unmatched/errors)
- open link to intake queue prefiltered to Amazon

## Security and Privacy Requirements
- Scoped token only for Amazon source ingest endpoint.
- Token is auto-provisioned and rotated by extension background worker using installation id.
- No Amazon credentials stored in app database.
- Transparent disclosure in extension UI:
  - what pages are read
  - what data is uploaded
  - how data is retained in app
- Retention/delete policy follows shared intake policy.

## Implementation Tasks

### T01 - Contract and Schema
Deliverables:
- Amazon payload schema contract
- source-specific migration (`external_orders`, `external_order_items`)

Acceptance:
- idempotent ingest by marketplace+order id

### T02 - Source Ingest API
Deliverables:
- `/api/intake/sources/amazon/ingest`
- validation + auth + idempotent upsert

Acceptance:
- repeated uploads do not create duplicate intake artifacts/orders

### T03 - Intake Integration
Deliverables:
- mapping from Amazon payload -> shared intake extraction/line-item entities
- queue filter support for Amazon source

Acceptance:
- Amazon artifacts appear in standard Intake Inbox review workflow

### T04 - Extension MVP
Deliverables:
- MV3 scaffold + scraper + upload queue
- popup status and sync controls
- pagination over `https://www.amazon.com/gp/your-account/order-history`
- incremental sync cursor (`last_order_date` + `last_order_id`)

Acceptance:
- successful scrape/upload from `amazon.com`
- repeated sync resumes from saved cursor without duplicating orders

### T05 - Review/Apply Path
Deliverables:
- verify split apply through shared intake apply endpoint
- order-to-applied-batch traceability

Acceptance:
- applied splits set parent/child flags correctly
- cashflow behavior remains correct

### T06 - Tests and Hardening
Deliverables:
- unit tests for normalization and ingest idempotence
- integration tests for ingest->intake queue->match->apply
- manual QA checklist for Amazon layout variants

Acceptance:
- no duplicate apply on retry
- clear handling for partial extraction failures

## Risks and Mitigations
- Amazon DOM changes:
  - Mitigation: parser versioning + robust fallback selectors + telemetry.
- Incorrect matching:
  - Mitigation: confirmation gate and confidence visibility.
- Trust/security concerns:
  - Mitigation: minimal permissions, scoped token, clear disclosure.
- Performance on large histories:
  - Mitigation: incremental date-window sync and resumable upload batches.

## Success Metrics
- `% Amazon charges split` (up)
- `manual edits per Amazon split` (down)
- `unmatched Amazon order rate` (down)
- `time from Amazon scrape to applied split` (down)
- `user confidence in split correctness` (up)

## Open Decisions
1. Do we provide CSV export of Amazon intake results in V1?
2. Should extension support backfill by date range in V1, or only recent orders first?
3. How should automatic token bootstrap be gated before full app auth exists (MVP trust model)?

## Locked Decisions (2026-02-08)
1. Marketplace: V1 is `amazon.com` only.
2. Scrape surface: `https://www.amazon.com/gp/your-account/order-history` with pagination.
3. Incremental sync: extension persists `last_order_date` and `last_order_id` cursor.
4. Matching simplification: assume one order equals one transaction.
5. Refund/return handling is deferred from V1.

## Suggested Delivery Phases
1. Phase 1: Extension ingest into shared Intake Inbox + manual review/apply.
2. Phase 2: Improve category suggestions from confirmed line-item history.
3. Phase 3: Performance and marketplace expansion hardening.

## Sources
- [Amazon Order History Reporter - Chrome Web Store](https://chromewebstore.google.com/detail/amazon-order-history-repo/mgkilgclilajckgnedgjgnfdokkgnibi)
- [Amazon Order History Reporter - Reviews](https://chromewebstore.google.com/detail/amazon-order-history-repo/mgkilgclilajckgnedgjgnfdokkgnibi/reviews)
- [Amazon Transaction Itemizer - Chrome Web Store](https://chromewebstore.google.com/detail/amazon-transaction-itemiz/lfngfhljagbfadffnfodfpgmgeddeakf?hl=en)
- [Amazon Transaction Itemizer - Reviews](https://chromewebstore.google.com/detail/amazon-transaction-itemiz/lfngfhljagbfadffnfodfpgmgeddeakf/reviews?hl=en)
