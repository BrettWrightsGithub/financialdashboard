-- ============================================================
-- MIGRATION: Fix Foreign Key for Category Batches
-- ============================================================
-- 
-- FILE: 20260106_fix_batch_fk.sql
-- PURPOSE:
--   The transactions table has a foreign key 'transactions_category_batch_id_fkey'
--   that points to the old 'category_batches' table.
--   
--   The new stored procedures (from 20260103) use 'rule_application_batches'.
--   
--   This migration repoints the foreign key to the correct table.
--
-- ============================================================

DO $$ BEGIN

    -- 1. Drop the old constraint
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'transactions_category_batch_id_fkey'
        AND table_name = 'transactions'
    ) THEN
        ALTER TABLE transactions DROP CONSTRAINT transactions_category_batch_id_fkey;
    END IF;

    -- 2. Add the new constraint pointing to rule_application_batches
    ALTER TABLE transactions
    ADD CONSTRAINT transactions_category_batch_id_fkey
    FOREIGN KEY (category_batch_id)
    REFERENCES rule_application_batches(id)
    ON DELETE SET NULL;

END $$;
