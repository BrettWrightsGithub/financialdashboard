-- ============================================================
-- MIGRATION: Intake Rematch Run Tracking
-- ============================================================
--
-- PURPOSE:
--   Tracks rematch jobs for intake sources so UI can show recency/status,
--   and operators can audit re-linking behavior over time.
--
-- ============================================================

CREATE TABLE IF NOT EXISTS intake_rematch_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type intake_source_type NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  matched_count INTEGER NOT NULL DEFAULT 0,
  suggested_count INTEGER NOT NULL DEFAULT 0,
  unmatched_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  reconciled_manual_count INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_rematch_runs_source_created
  ON intake_rematch_runs(source_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intake_rematch_runs_status
  ON intake_rematch_runs(status, created_at DESC);

COMMENT ON TABLE intake_rematch_runs IS 'Audit log of intake rematch runs by source type.';
