# Amazon Extension Refunds and Returns Follow-Up

## Status
Deferred from Amazon extension V1 (decision date: 2026-02-08).

## Why Deferred
- V1 is scoped to fast, reliable order itemization and split review/apply.
- Refund and return behavior introduces multi-event matching complexity:
  - partial refunds
  - delayed refund timing
  - gift-card and credit interactions
  - split-shipment and multi-charge edge cases

## Required Follow-Up Work
1. Add refund/return event extraction contract from order detail pages.
2. Add linkage model between original order item(s) and refund transaction(s).
3. Extend matcher for signed amount inversion and delayed windows (up to 90 days).
4. Add review UX for:
   - partial item refund assignment
   - full order refund confirmation
   - unmatched refund handling
5. Add auditability:
   - refund source event id
   - linked original applied batch id
   - reversible apply/undo path

## Proposed Future Acceptance Criteria
1. Full refunds can be linked/applied without duplicate splits.
2. Partial refunds can be assigned to one or more original line items.
3. Unmatched refunds remain visible in intake review queue with explicit reason.
