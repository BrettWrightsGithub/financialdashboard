-- ============================================================
-- MIGRATION: Intake Artifact Unique Constraint For Amazon Upsert
-- ============================================================
--
-- PURPOSE:
--   Ensures (source_type, marketplace, provider_order_id) can be used safely
--   as an ON CONFLICT target. Also deduplicates existing amazon rows before
--   adding the constraint.
--
-- ============================================================

-- Remove duplicate amazon artifacts if they exist, keeping most recent row.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY source_type, marketplace, provider_order_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM intake_artifacts
  WHERE source_type = 'amazon_extension'
    AND marketplace IS NOT NULL
    AND provider_order_id IS NOT NULL
)
DELETE FROM intake_artifacts ia
USING ranked r
WHERE ia.id = r.id
  AND r.rn > 1;

DO $$ BEGIN
  ALTER TABLE intake_artifacts
    ADD CONSTRAINT intake_artifacts_source_marketplace_order_unique
    UNIQUE (source_type, marketplace, provider_order_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
