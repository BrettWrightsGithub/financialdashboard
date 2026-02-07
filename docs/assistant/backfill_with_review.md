# Backfill With Review

## Endpoints
- `POST /api/rules/preview`
- `POST /api/rules/apply-retroactive`
- `POST /api/rules/undo-batch`

## Flow
1. Preview with `rule_id` to see impact counts and sample rows.
2. Apply with a transaction ID list to create a batch and update transactions.
3. Undo with `batch_id` to restore prior state.

## Locked Transactions
- Preview returns `wouldSkipLocked`.
- Apply excludes locked transactions in underlying stored procedures.

## Recovery
- If apply fails after preview, re-run preview before retrying.
- If batch was partially applied at the DB layer, use `undo-batch` with the returned `batch_id`.
