-- Migration: Audit Log, Sync State, and Rule Application Batches
-- Implements workflows 11, 12, 13

-- ============================================================
-- WORKFLOW 11: Category Audit Log for Explainability
-- ============================================================

-- Enum for change sources
DO $$ BEGIN
    CREATE TYPE category_change_source AS ENUM (
        'plaid', 'rule', 'manual', 'payee_memory', 'bulk_edit', 'reimbursement_link', 'system'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Category audit log table
CREATE TABLE IF NOT EXISTS category_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    previous_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    new_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    change_source category_change_source NOT NULL,
    rule_id UUID REFERENCES categorization_rules(id) ON DELETE SET NULL,
    confidence_score NUMERIC(4,3), -- 0.000 to 1.000
    changed_by TEXT NOT NULL DEFAULT 'system', -- 'system' or user identifier
    batch_id UUID, -- For linking to rule_application_batches
    notes TEXT,
    is_reverted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_log_transaction ON category_audit_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON category_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_source ON category_audit_log(change_source);
CREATE INDEX IF NOT EXISTS idx_audit_log_batch ON category_audit_log(batch_id) WHERE batch_id IS NOT NULL;

-- Function to log category changes
CREATE OR REPLACE FUNCTION fn_log_category_change(
    p_transaction_id UUID,
    p_previous_category_id UUID,
    p_new_category_id UUID,
    p_change_source category_change_source,
    p_rule_id UUID DEFAULT NULL,
    p_confidence_score NUMERIC DEFAULT NULL,
    p_changed_by TEXT DEFAULT 'system',
    p_batch_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO category_audit_log (
        transaction_id,
        previous_category_id,
        new_category_id,
        change_source,
        rule_id,
        confidence_score,
        changed_by,
        batch_id,
        notes
    ) VALUES (
        p_transaction_id,
        p_previous_category_id,
        p_new_category_id,
        p_change_source,
        p_rule_id,
        p_confidence_score,
        p_changed_by,
        p_batch_id,
        p_notes
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- WORKFLOW 12: Sync State and Pending Transaction Handling
-- ============================================================

-- Sync state table for cursor-based sync
CREATE TABLE IF NOT EXISTS sync_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES provider_connections(id) ON DELETE CASCADE,
    cursor TEXT, -- Plaid's sync cursor
    last_sync_at TIMESTAMPTZ,
    last_sync_status TEXT DEFAULT 'success', -- 'success', 'error', 'in_progress'
    last_error TEXT,
    transactions_added INTEGER DEFAULT 0,
    transactions_modified INTEGER DEFAULT 0,
    transactions_removed INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id),
    UNIQUE(connection_id)
);

-- Index for sync state queries
CREATE INDEX IF NOT EXISTS idx_sync_state_connection ON sync_state(connection_id);

-- Function to handle pending -> posted transaction handover
CREATE OR REPLACE FUNCTION fn_handle_pending_handover()
RETURNS TRIGGER AS $$
DECLARE
    v_pending_tx RECORD;
BEGIN
    -- Only process if this is a posted transaction with a pending_transaction_id
    IF NEW.status = 'posted' AND NEW.pending_transaction_id IS NOT NULL THEN
        -- Find matching pending transaction
        SELECT * INTO v_pending_tx
        FROM transactions
        WHERE provider_transaction_id = NEW.pending_transaction_id
          AND status = 'pending'
          AND account_id = NEW.account_id
          AND id != NEW.id
        LIMIT 1;
        
        IF v_pending_tx IS NOT NULL THEN
            -- Copy user categorization from pending to posted
            IF v_pending_tx.life_category_id IS NOT NULL THEN
                NEW.life_category_id := v_pending_tx.life_category_id;
                NEW.cashflow_group := v_pending_tx.cashflow_group;
                NEW.flow_type := v_pending_tx.flow_type;
                NEW.category_locked := v_pending_tx.category_locked;
                NEW.category_source := COALESCE(v_pending_tx.category_source, 'pending_handover');
                
                -- Log the category preservation
                PERFORM fn_log_category_change(
                    NEW.id,
                    NULL,
                    NEW.life_category_id,
                    'system'::category_change_source,
                    NULL,
                    NULL,
                    'pending_handover',
                    NULL,
                    'Category preserved from pending transaction ' || v_pending_tx.id::TEXT
                );
            END IF;
            
            -- Copy other user-set fields
            NEW.counterparty_name := COALESCE(NEW.counterparty_name, v_pending_tx.counterparty_name);
            NEW.counterparty_id := COALESCE(NEW.counterparty_id, v_pending_tx.counterparty_id);
            NEW.is_transfer := COALESCE(v_pending_tx.is_transfer, NEW.is_transfer);
            NEW.is_pass_through := COALESCE(v_pending_tx.is_pass_through, NEW.is_pass_through);
            NEW.is_business := COALESCE(v_pending_tx.is_business, NEW.is_business);
            
            -- Archive the pending transaction (soft delete by changing status)
            UPDATE transactions
            SET status = 'archived',
                updated_at = NOW()
            WHERE id = v_pending_tx.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for pending handover (only on INSERT)
DROP TRIGGER IF EXISTS trg_handle_pending_handover ON transactions;
CREATE TRIGGER trg_handle_pending_handover
    BEFORE INSERT ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION fn_handle_pending_handover();

-- ============================================================
-- WORKFLOW 13: Rule Application Batches for Undo Support
-- ============================================================

-- Rule application batches table
CREATE TABLE IF NOT EXISTS rule_application_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES categorization_rules(id) ON DELETE SET NULL,
    operation_type TEXT NOT NULL DEFAULT 'rule_apply', -- 'rule_apply', 'waterfall', 'bulk_edit'
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    transaction_count INTEGER DEFAULT 0,
    date_range_start DATE,
    date_range_end DATE,
    is_undone BOOLEAN DEFAULT FALSE,
    undone_at TIMESTAMPTZ,
    description TEXT,
    created_by TEXT DEFAULT 'system'
);

-- Index for batch queries
CREATE INDEX IF NOT EXISTS idx_batches_rule ON rule_application_batches(rule_id);
CREATE INDEX IF NOT EXISTS idx_batches_applied_at ON rule_application_batches(applied_at);

-- Add batch_id FK to category_audit_log if not exists
DO $$ BEGIN
    ALTER TABLE category_audit_log
    ADD CONSTRAINT fk_audit_log_batch
    FOREIGN KEY (batch_id) REFERENCES rule_application_batches(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Function to undo a batch operation
CREATE OR REPLACE FUNCTION fn_undo_batch(p_batch_id UUID)
RETURNS TABLE (
    success BOOLEAN,
    transactions_reverted INTEGER,
    error TEXT
) AS $$
DECLARE
    v_batch RECORD;
    v_audit_entry RECORD;
    v_count INTEGER := 0;
BEGIN
    -- Check if batch exists and is not already undone
    SELECT * INTO v_batch
    FROM rule_application_batches
    WHERE id = p_batch_id;
    
    IF v_batch IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 'Batch not found'::TEXT;
        RETURN;
    END IF;
    
    IF v_batch.is_undone THEN
        RETURN QUERY SELECT FALSE, 0, 'Batch already undone'::TEXT;
        RETURN;
    END IF;
    
    -- Revert each change in the batch
    FOR v_audit_entry IN
        SELECT * FROM category_audit_log
        WHERE batch_id = p_batch_id
        AND is_reverted = FALSE
        ORDER BY created_at DESC
    LOOP
        -- Restore previous category
        UPDATE transactions
        SET life_category_id = v_audit_entry.previous_category_id,
            category_source = 'undo',
            updated_at = NOW()
        WHERE id = v_audit_entry.transaction_id
        AND category_locked = FALSE; -- Don't revert locked transactions
        
        -- Mark audit entry as reverted
        UPDATE category_audit_log
        SET is_reverted = TRUE
        WHERE id = v_audit_entry.id;
        
        v_count := v_count + 1;
    END LOOP;
    
    -- Mark batch as undone
    UPDATE rule_application_batches
    SET is_undone = TRUE,
        undone_at = NOW()
    WHERE id = p_batch_id;
    
    RETURN QUERY SELECT TRUE, v_count, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to apply rule retroactively with batch tracking
CREATE OR REPLACE FUNCTION fn_apply_rule_retroactive(
    p_rule_id UUID,
    p_transaction_ids UUID[],
    p_created_by TEXT DEFAULT 'system'
)
RETURNS TABLE (
    batch_id UUID,
    applied_count INTEGER,
    skipped_locked INTEGER
) AS $$
DECLARE
    v_batch_id UUID;
    v_rule RECORD;
    v_tx RECORD;
    v_applied INTEGER := 0;
    v_skipped INTEGER := 0;
    v_old_category_id UUID;
BEGIN
    -- Get the rule
    SELECT * INTO v_rule FROM categorization_rules WHERE id = p_rule_id AND is_active = TRUE;
    IF v_rule IS NULL THEN
        RAISE EXCEPTION 'Rule not found or inactive';
    END IF;
    
    -- Create batch record
    INSERT INTO rule_application_batches (rule_id, operation_type, transaction_count, created_by, description)
    VALUES (p_rule_id, 'rule_apply', 0, p_created_by, 'Retroactive application of rule: ' || v_rule.name)
    RETURNING id INTO v_batch_id;
    
    -- Apply to each transaction
    FOR v_tx IN
        SELECT * FROM transactions
        WHERE id = ANY(p_transaction_ids)
    LOOP
        -- Skip locked transactions
        IF v_tx.category_locked THEN
            v_skipped := v_skipped + 1;
            CONTINUE;
        END IF;
        
        -- Skip if already has target category
        IF v_tx.life_category_id = v_rule.assign_category_id THEN
            CONTINUE;
        END IF;
        
        -- Store old category
        v_old_category_id := v_tx.life_category_id;
        
        -- Apply the rule
        UPDATE transactions
        SET life_category_id = v_rule.assign_category_id,
            is_transfer = COALESCE(v_rule.assign_is_transfer, is_transfer),
            is_pass_through = COALESCE(v_rule.assign_is_pass_through, is_pass_through),
            category_source = 'rule',
            applied_rule_id = p_rule_id,
            category_batch_id = v_batch_id,
            updated_at = NOW()
        WHERE id = v_tx.id;
        
        -- Log the change
        PERFORM fn_log_category_change(
            v_tx.id,
            v_old_category_id,
            v_rule.assign_category_id,
            'rule'::category_change_source,
            p_rule_id,
            1.0,
            p_created_by,
            v_batch_id,
            'Retroactive rule application'
        );
        
        v_applied := v_applied + 1;
    END LOOP;
    
    -- Update batch count
    UPDATE rule_application_batches
    SET transaction_count = v_applied
    WHERE id = v_batch_id;
    
    RETURN QUERY SELECT v_batch_id, v_applied, v_skipped;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON category_audit_log TO authenticated;
GRANT ALL ON sync_state TO authenticated;
GRANT ALL ON rule_application_batches TO authenticated;
GRANT EXECUTE ON FUNCTION fn_log_category_change TO authenticated;
GRANT EXECUTE ON FUNCTION fn_handle_pending_handover TO authenticated;
GRANT EXECUTE ON FUNCTION fn_undo_batch TO authenticated;
GRANT EXECUTE ON FUNCTION fn_apply_rule_retroactive TO authenticated;
