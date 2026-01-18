-- Migration: Add transfer linking fields to transactions table
-- Date: 2026-01-05
-- Purpose: Enable bidirectional linking of transfer pairs with confidence scores

-- Add transfer pairing columns
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS transfer_pair_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS transfer_confidence NUMERIC(4,3) CHECK (transfer_confidence >= 0 AND transfer_confidence <= 1);

-- Create index for efficient transfer pair lookups
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_pair ON transactions(transfer_pair_id) WHERE transfer_pair_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN transactions.transfer_pair_id IS 'Links to the counterpart transaction in a transfer pair (bidirectional)';
COMMENT ON COLUMN transactions.transfer_confidence IS 'Confidence score (0-1) for automated transfer detection';

-- Create or ensure "Internal Transfer" category exists
DO $$
DECLARE
  v_transfer_category_id UUID;
BEGIN
  -- Check if "Internal Transfer" category exists
  SELECT id INTO v_transfer_category_id
  FROM categories
  WHERE name = 'Internal Transfer' AND cashflow_group = 'Transfer';

  -- If not, create it
  IF v_transfer_category_id IS NULL THEN
    INSERT INTO categories (
      id,
      name,
      cashflow_group,
      description,
      sort_order,
      is_active
    ) VALUES (
      gen_random_uuid(),
      'Internal Transfer',
      'Transfer',
      'Transfers between accounts (neutral to cashflow)',
      999,
      true
    );

    RAISE NOTICE 'Created "Internal Transfer" category';
  ELSE
    RAISE NOTICE '"Internal Transfer" category already exists';
  END IF;
END $$;
