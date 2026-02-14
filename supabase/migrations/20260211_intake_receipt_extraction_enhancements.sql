-- ============================================================
-- MIGRATION: Intake Receipt Extraction Enhancements
-- ============================================================
--
-- PURPOSE:
--   - Track the uploader scope for per-user upload retention.
--   - Index receipt uploads for fast retention pruning.
--
-- ============================================================

ALTER TABLE intake_artifacts
  ADD COLUMN IF NOT EXISTS created_by TEXT;

CREATE INDEX IF NOT EXISTS idx_intake_artifacts_created_by_received
  ON intake_artifacts(created_by, source_type, received_at DESC)
  WHERE source_type = 'upload';
