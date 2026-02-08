-- ============================================================
-- MIGRATION: Unified Media Intake CSV Foundation
-- ============================================================
--
-- FILE: 20260208_unified_media_intake_csv_foundation.sql
-- PURPOSE:
--   Adds CSV import batch/row tables to support preview/apply workflows
--   for shared intake artifacts where source_type = 'csv'.
--
-- ============================================================

DO $$ BEGIN
  CREATE TYPE csv_import_batch_status AS ENUM (
    'previewed',
    'needs_review',
    'ready_to_apply',
    'applied',
    'error'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE csv_import_row_parse_status AS ENUM (
    'valid',
    'invalid',
    'skipped'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE csv_import_row_dedupe_status AS ENUM (
    'new',
    'duplicate',
    'merge',
    'skip',
    'imported'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS csv_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES intake_artifacts(id) ON DELETE CASCADE,
  mapping_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status csv_import_batch_status NOT NULL DEFAULT 'previewed',
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  invalid_rows INTEGER NOT NULL DEFAULT 0,
  duplicate_rows INTEGER NOT NULL DEFAULT 0,
  applied_rows INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(artifact_id)
);

CREATE INDEX IF NOT EXISTS idx_csv_import_batches_status_created
  ON csv_import_batches(status, created_at DESC);

CREATE TABLE IF NOT EXISTS csv_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES csv_import_batches(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  raw_row_json JSONB NOT NULL,
  normalized_date DATE,
  normalized_description TEXT,
  normalized_amount NUMERIC(12,2),
  source_row_hash TEXT,
  parse_status csv_import_row_parse_status NOT NULL DEFAULT 'valid',
  parse_error TEXT,
  dedupe_status csv_import_row_dedupe_status NOT NULL DEFAULT 'new',
  dedupe_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  imported_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(batch_id, row_index)
);

CREATE INDEX IF NOT EXISTS idx_csv_import_rows_batch
  ON csv_import_rows(batch_id, row_index);

CREATE INDEX IF NOT EXISTS idx_csv_import_rows_parse_status
  ON csv_import_rows(parse_status);

CREATE INDEX IF NOT EXISTS idx_csv_import_rows_dedupe_status
  ON csv_import_rows(dedupe_status);

CREATE INDEX IF NOT EXISTS idx_csv_import_rows_source_row_hash
  ON csv_import_rows(source_row_hash);

COMMENT ON TABLE csv_import_batches IS 'CSV import job metadata, mapping decisions, and apply status.';
COMMENT ON TABLE csv_import_rows IS 'Row-level normalized CSV results, parse errors, dedupe outcomes, and import links.';

