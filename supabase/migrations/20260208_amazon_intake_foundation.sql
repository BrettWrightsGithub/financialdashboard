-- ============================================================
-- MIGRATION: Intake Foundation + Amazon Source Tables
-- ============================================================
--
-- FILE: 20260208_amazon_intake_foundation.sql
-- PURPOSE:
--   Adds shared intake tables used by the Amazon extension source,
--   including scoped source token storage for ingest auth.
--
-- NOTES:
--   - V1 source implemented in this migration: amazon_extension
--   - Shared tables are intentionally reusable by future upload/csv sources
--
-- ============================================================

DO $$ BEGIN
  CREATE TYPE intake_source_type AS ENUM ('upload', 'csv', 'amazon_extension');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE intake_artifact_status AS ENUM (
    'received',
    'parsed',
    'matched',
    'needs_review',
    'ready_to_apply',
    'applied',
    'error'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE intake_match_status AS ENUM (
    'unmatched',
    'suggested',
    'confirmed',
    'rejected',
    'applied'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS intake_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type intake_source_type NOT NULL,
  marketplace TEXT,
  provider_order_id TEXT,
  storage_path TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  status intake_artifact_status NOT NULL DEFAULT 'received',
  error_message TEXT,
  raw_payload_json JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_intake_artifacts_amazon_unique
  ON intake_artifacts(source_type, marketplace, provider_order_id)
  WHERE provider_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_intake_artifacts_status_received
  ON intake_artifacts(status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_intake_artifacts_source_received
  ON intake_artifacts(source_type, received_at DESC);

CREATE TABLE IF NOT EXISTS intake_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES intake_artifacts(id) ON DELETE CASCADE,
  merchant_name TEXT,
  transaction_date DATE,
  currency TEXT,
  total_amount NUMERIC(12,2),
  tax_amount NUMERIC(12,2),
  shipping_amount NUMERIC(12,2),
  raw_extraction_json JSONB,
  extraction_confidence NUMERIC(4,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(artifact_id)
);

CREATE INDEX IF NOT EXISTS idx_intake_extractions_transaction_date
  ON intake_extractions(transaction_date DESC);

CREATE TABLE IF NOT EXISTS intake_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_id UUID NOT NULL REFERENCES intake_extractions(id) ON DELETE CASCADE,
  line_index INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2),
  line_total NUMERIC(12,2) NOT NULL,
  suggested_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  confirmed_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  raw_item_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(extraction_id, line_index)
);

CREATE INDEX IF NOT EXISTS idx_intake_line_items_extraction
  ON intake_line_items(extraction_id);

CREATE TABLE IF NOT EXISTS intake_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_id UUID NOT NULL REFERENCES intake_extractions(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  match_confidence NUMERIC(4,3),
  match_reason TEXT,
  status intake_match_status NOT NULL DEFAULT 'unmatched',
  applied_batch_id UUID REFERENCES rule_application_batches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(extraction_id)
);

CREATE INDEX IF NOT EXISTS idx_intake_matches_status
  ON intake_matches(status);

CREATE TABLE IF NOT EXISTS external_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_artifact_id UUID NOT NULL REFERENCES intake_artifacts(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL,
  provider_order_id TEXT NOT NULL,
  order_date DATE NOT NULL,
  order_total NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL,
  raw_payload_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(intake_artifact_id),
  UNIQUE(marketplace, provider_order_id)
);

CREATE INDEX IF NOT EXISTS idx_external_orders_order_date
  ON external_orders(order_date DESC);

CREATE TABLE IF NOT EXISTS external_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_order_id UUID NOT NULL REFERENCES external_orders(id) ON DELETE CASCADE,
  line_index INTEGER NOT NULL,
  item_title TEXT NOT NULL,
  quantity NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2),
  line_total NUMERIC(12,2) NOT NULL,
  raw_item_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(external_order_id, line_index)
);

CREATE INDEX IF NOT EXISTS idx_external_order_items_order
  ON external_order_items(external_order_id);

CREATE TABLE IF NOT EXISTS intake_source_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type intake_source_type NOT NULL,
  install_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['amazon:ingest'],
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(token_hash)
);

CREATE INDEX IF NOT EXISTS idx_intake_source_tokens_install
  ON intake_source_tokens(source_type, install_id);

CREATE INDEX IF NOT EXISTS idx_intake_source_tokens_active
  ON intake_source_tokens(source_type, install_id, status)
  WHERE status = 'active' AND revoked_at IS NULL;

COMMENT ON TABLE intake_artifacts IS 'Shared intake artifacts for uploads/csv/amazon_extension sources.';
COMMENT ON TABLE external_orders IS 'Source-specific Amazon order metadata keyed by marketplace and provider order id.';
COMMENT ON TABLE intake_source_tokens IS 'Scoped ingest tokens (stored hashed) for source adapters like chrome extensions.';
