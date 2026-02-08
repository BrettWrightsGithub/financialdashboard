-- ============================================================
-- MIGRATION: Make fn_apply_rule_retroactive compatible with both
--            rule_application_batches and category_batches schemas
-- ============================================================

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
    v_batch_id UUID := gen_random_uuid();
    v_rule RECORD;
    v_tx RECORD;
    v_applied INTEGER := 0;
    v_skipped INTEGER := 0;
    v_old_category_id UUID;
    v_has_rule_batches BOOLEAN := to_regclass('public.rule_application_batches') IS NOT NULL;
    v_has_category_batches BOOLEAN := to_regclass('public.category_batches') IS NOT NULL;
BEGIN
    -- Get the active rule
    SELECT * INTO v_rule
    FROM categorization_rules
    WHERE id = p_rule_id
      AND is_active = TRUE;

    IF v_rule IS NULL THEN
        RAISE EXCEPTION 'Rule not found or inactive';
    END IF;

    IF NOT v_has_rule_batches AND NOT v_has_category_batches THEN
        RAISE EXCEPTION 'No batch table found (expected rule_application_batches and/or category_batches)';
    END IF;

    -- Create category batch row when present (supports transactions.category_batch_id FK)
    IF v_has_category_batches THEN
        BEGIN
            EXECUTE 'INSERT INTO category_batches (id, operation_type, description) VALUES ($1, $2, $3)'
            USING v_batch_id, 'rule_apply', 'Retroactive application of rule: ' || v_rule.name;
        EXCEPTION
            WHEN undefined_column THEN
                EXECUTE 'INSERT INTO category_batches (id, operation_type) VALUES ($1, $2)'
                USING v_batch_id, 'rule_apply';
        END;
    END IF;

    -- Create legacy batch row when present (used by undo and admin batch views)
    IF v_has_rule_batches THEN
        BEGIN
            EXECUTE '
                INSERT INTO rule_application_batches
                (id, rule_id, operation_type, transaction_count, created_by, description)
                VALUES ($1, $2, $3, $4, $5, $6)
            '
            USING
                v_batch_id,
                p_rule_id,
                'rule_apply',
                0,
                p_created_by,
                'Retroactive application of rule: ' || v_rule.name;
        EXCEPTION
            WHEN undefined_column THEN
                EXECUTE '
                    INSERT INTO rule_application_batches
                    (id, rule_id, operation_type, description)
                    VALUES ($1, $2, $3, $4)
                '
                USING
                    v_batch_id,
                    p_rule_id,
                    'rule_apply',
                    'Retroactive application of rule: ' || v_rule.name;
        END;
    END IF;

    -- Apply rule updates
    FOR v_tx IN
        SELECT * FROM transactions
        WHERE id = ANY(p_transaction_ids)
    LOOP
        IF v_tx.category_locked THEN
            v_skipped := v_skipped + 1;
            CONTINUE;
        END IF;

        IF v_tx.life_category_id = v_rule.assign_category_id THEN
            CONTINUE;
        END IF;

        v_old_category_id := v_tx.life_category_id;

        UPDATE transactions
        SET life_category_id = v_rule.assign_category_id,
            is_transfer = COALESCE(v_rule.assign_is_transfer, is_transfer),
            is_pass_through = COALESCE(v_rule.assign_is_pass_through, is_pass_through),
            category_source = 'rule',
            applied_rule_id = p_rule_id,
            category_batch_id = v_batch_id,
            updated_at = NOW()
        WHERE id = v_tx.id;

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

    -- Update batch counts in any available table(s)
    IF v_has_rule_batches THEN
        EXECUTE '
            UPDATE rule_application_batches
            SET transaction_count = $1
            WHERE id = $2
        '
        USING v_applied, v_batch_id;
    END IF;

    IF v_has_category_batches THEN
        BEGIN
            EXECUTE '
                UPDATE category_batches
                SET transaction_count = $1
                WHERE id = $2
            '
            USING v_applied, v_batch_id;
        EXCEPTION
            WHEN undefined_column THEN
                NULL;
        END;
    END IF;

    RETURN QUERY SELECT v_batch_id, v_applied, v_skipped;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION fn_apply_rule_retroactive(UUID, UUID[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_apply_rule_retroactive(UUID, UUID[], TEXT) TO service_role;
