-- ============================================================
-- MIGRATION: Add is_split_parent Column
-- ============================================================
-- 
-- FILE: 20260102_add_is_split_parent.sql
-- STATUS: ✅ DEPLOYED (Verified 2026-01-03)
-- 
-- PURPOSE:
--   Adds the is_split_parent flag to transactions table.
--   Split parents should be excluded from:
--   1. Cashflow calculations (children are counted instead)
--   2. Future sync processing (already handled, children represent the real data)
--   3. Categorization waterfall (no need to categorize - children have categories)
--
-- CREATES:
--   - transactions.is_split_parent column (boolean, default false)
--   - Index: idx_transactions_is_split_parent
--
-- SHOULD I RUN THIS AGAIN?
--   NO - Already deployed. Column and index verified 2026-01-03.
--
-- ============================================================
-- This flag marks transactions that have been split into children

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS is_split_parent BOOLEAN DEFAULT FALSE;

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_transactions_is_split_parent 
ON transactions(is_split_parent) 
WHERE is_split_parent = TRUE;

-- Update existing split parents (transactions that have children)
UPDATE transactions t
SET is_split_parent = TRUE
WHERE EXISTS (
  SELECT 1 FROM transactions c 
  WHERE c.parent_transaction_id = t.id
);

COMMENT ON COLUMN transactions.is_split_parent IS 'TRUE if this transaction has been split into children. Excluded from cashflow and sync.';
