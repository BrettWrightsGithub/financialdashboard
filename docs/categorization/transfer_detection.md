# Transfer Detection

## Migration Order
1. Apply `supabase/migrations/20260207_transfer_pairing.sql`.
2. Deploy app code that reads/writes transfer pairing fields.

## Detection Pipeline
- Time-window matching: opposite-sign amounts in a configurable date window.
- Provider pattern matching: known descriptors (Zelle, Amex, PayPal, Venmo).
- Fuzzy matching: normalized merchant text with amount/date tolerance.

## Routes
- `POST /api/transfers/detect`
  - Supports `dry_run` and `autoflag`.
  - Supports `min_confidence`, `transaction_ids`, `date_from`, `date_to`.
- `POST /api/transfers/link`
  - Manual bidirectional link.
- `DELETE /api/transfers/link`
  - Manual unlink, clears pair metadata on both sides.

## UI
- Transfer rows show confidence/source badges.
- Chain modal shows linked counterpart metadata.
- Break-link action confirms before unlink.

## Failure Modes
- Missing `SUPABASE_SERVICE_ROLE_KEY`: transfer APIs return 500.
- Invalid `transaction_id`/`counterpart_id`: link API returns 400/404.
- Autoflag with low confidence threshold can over-match; keep `min_confidence >= 0.7` for production.
