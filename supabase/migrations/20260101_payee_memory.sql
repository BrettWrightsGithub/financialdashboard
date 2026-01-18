-- ============================================================
-- MIGRATION: Payee Memory Table and Functions
-- ============================================================
-- 
-- FILE: 20260101_payee_memory.sql
-- STATUS: ✅ DEPLOYED (Applied to Supabase production)
-- DEPLOYED: 2026-01-01 (manually via Supabase SQL Editor)
-- 
-- PURPOSE:
--   Creates the payee memory system that learns from user categorizations.
--   When a user manually categorizes a transaction, the payee→category
--   mapping is saved and applied to future transactions from the same payee.
--
-- CREATES:
--   Tables:
--   - payee_category_mappings (stores learned payee→category mappings)
--   
--   Functions:
--   - fn_normalize_payee_name(text) -> text
--   - fn_save_payee_mapping(text, uuid) -> uuid
--   - fn_get_payee_mapping(text) -> table
--   - fn_apply_user_override(uuid, uuid, boolean) -> jsonb
--   
--   Columns (if not exist):
--   - transactions.category_locked
--   - transactions.category_source
--
-- SHOULD I RUN THIS AGAIN?
--   NO - Already deployed. Safe to re-run (uses IF NOT EXISTS and CREATE OR REPLACE)
--   but unnecessary.
--
-- ============================================================
-- Per docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md (FR-06)

-- Create payee_category_mappings table
CREATE TABLE IF NOT EXISTS payee_category_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payee_name TEXT NOT NULL,
  payee_name_normalized TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id),
  confidence NUMERIC DEFAULT 1.0,
  usage_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_payee_normalized UNIQUE (payee_name_normalized)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_payee_mappings_normalized ON payee_category_mappings(payee_name_normalized);

-- Add category_locked column to transactions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'category_locked'
  ) THEN
    ALTER TABLE transactions ADD COLUMN category_locked BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Ensure category_source column exists with correct type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'category_source'
  ) THEN
    ALTER TABLE transactions ADD COLUMN category_source TEXT;
  END IF;
END $$;

-- Function to normalize payee names for matching
CREATE OR REPLACE FUNCTION fn_normalize_payee_name(raw_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized TEXT;
BEGIN
  -- Lowercase and trim
  normalized := LOWER(TRIM(COALESCE(raw_name, '')));
  
  -- Remove common suffixes and prefixes
  normalized := REGEXP_REPLACE(normalized, '\s+(inc|llc|ltd|corp|co|company)\.?$', '', 'i');
  normalized := REGEXP_REPLACE(normalized, '^(the|a|an)\s+', '', 'i');
  
  -- Remove special characters except spaces
  normalized := REGEXP_REPLACE(normalized, '[^a-z0-9\s]', '', 'g');
  
  -- Collapse multiple spaces
  normalized := REGEXP_REPLACE(normalized, '\s+', ' ', 'g');
  
  -- Trim again
  normalized := TRIM(normalized);
  
  RETURN normalized;
END;
$$;

-- Function to save/update payee mapping (called when user manually categorizes)
CREATE OR REPLACE FUNCTION fn_save_payee_mapping(
  p_payee_name TEXT,
  p_category_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_normalized TEXT;
  v_mapping_id UUID;
BEGIN
  v_normalized := fn_normalize_payee_name(p_payee_name);
  
  -- Skip if normalized name is empty
  IF v_normalized = '' THEN
    RETURN NULL;
  END IF;
  
  -- Upsert the mapping
  INSERT INTO payee_category_mappings (payee_name, payee_name_normalized, category_id)
  VALUES (p_payee_name, v_normalized, p_category_id)
  ON CONFLICT (payee_name_normalized) 
  DO UPDATE SET
    category_id = EXCLUDED.category_id,
    usage_count = payee_category_mappings.usage_count + 1,
    last_used_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_mapping_id;
  
  RETURN v_mapping_id;
END;
$$;

-- Function to get payee mapping
CREATE OR REPLACE FUNCTION fn_get_payee_mapping(p_payee_name TEXT)
RETURNS TABLE (category_id UUID, confidence NUMERIC)
LANGUAGE plpgsql
AS $$
DECLARE
  v_normalized TEXT;
BEGIN
  v_normalized := fn_normalize_payee_name(p_payee_name);
  
  RETURN QUERY
  SELECT pm.category_id, pm.confidence
  FROM payee_category_mappings pm
  WHERE pm.payee_name_normalized = v_normalized
  LIMIT 1;
END;
$$;

-- Function to apply user override (sets category, locks it, saves to payee memory)
CREATE OR REPLACE FUNCTION fn_apply_user_override(
  p_transaction_id UUID,
  p_new_category_id UUID,
  p_learn_payee BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_category_id UUID;
  v_payee_name TEXT;
  v_mapping_id UUID;
BEGIN
  -- Get current category and payee name
  SELECT life_category_id, COALESCE(description_clean, description_raw)
  INTO v_old_category_id, v_payee_name
  FROM transactions
  WHERE id = p_transaction_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction not found');
  END IF;
  
  -- Update the transaction
  UPDATE transactions
  SET
    life_category_id = p_new_category_id,
    category_source = 'manual',
    category_locked = TRUE,
    updated_at = NOW()
  WHERE id = p_transaction_id;
  
  -- Insert into category_overrides for audit trail
  INSERT INTO category_overrides (
    description_pattern,
    category_id,
    source,
    created_from_transaction_id
  ) VALUES (
    v_payee_name,
    p_new_category_id,
    'manual',
    p_transaction_id
  );
  
  -- Save to payee memory if requested
  IF p_learn_payee AND v_payee_name IS NOT NULL THEN
    v_mapping_id := fn_save_payee_mapping(v_payee_name, p_new_category_id);
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'old_category_id', v_old_category_id,
    'new_category_id', p_new_category_id,
    'payee_learned', v_mapping_id IS NOT NULL
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION fn_normalize_payee_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_normalize_payee_name(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION fn_save_payee_mapping(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_save_payee_mapping(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION fn_get_payee_mapping(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_get_payee_mapping(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION fn_apply_user_override(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_apply_user_override(UUID, UUID, BOOLEAN) TO service_role;

GRANT SELECT, INSERT, UPDATE ON payee_category_mappings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON payee_category_mappings TO service_role;

COMMENT ON TABLE payee_category_mappings IS 'Stores learned payee→category mappings from user manual categorizations';
COMMENT ON FUNCTION fn_apply_user_override IS 'Applies user category override, locks the transaction, and optionally learns the payee mapping';
