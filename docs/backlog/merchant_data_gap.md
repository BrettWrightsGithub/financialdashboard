# Merchant Data Gap (Deferred)

## Current State
- Rule matching currently relies on `description_raw` / text patterns for merchant matching.
- There is no dedicated normalized `merchant` column guaranteed for all transactions.
- Assistant-created rules therefore map merchant intent to `match_merchant_contains` against description text.

## Risks
- Description text is provider-specific and noisy, reducing matching precision.
- Merchant intent in assistant prompts may drift from stored descriptors.

## Proposed Future Work (Deferred)
1. Add `merchant_normalized` column to transactions (nullable at first).
2. Populate via sync pipeline and backfill normalization job.
3. Update rule engine to prefer exact/contains on `merchant_normalized` before description fallback.
4. Add rule form support for choosing `merchant_normalized` vs `description_raw` matching mode.
5. Add migration plan and data quality checks per provider.

## Why Deferred
- Requires schema, sync pipeline, and backfill coordination.
- Current goal is to preserve delivery momentum while documenting the gap explicitly.
