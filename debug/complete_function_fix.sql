-- Complete fix for missing functions and dependencies
-- This creates all required functions in the correct order

-- 1. First, create check_backdate_permission function if it doesn't exist
CREATE OR REPLACE FUNCTION check_backdate_permission(
    p_transaction_date DATE,
    p_max_backdate_days INTEGER DEFAULT 3,
    p_requires_approval_after INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_days_diff INTEGER;
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Calculate days backdated
    v_days_diff := v_today - p_transaction_date;
    
    -- Future dates not allowed
    IF p_transaction_date > v_today THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'Future dates are not allowed',
            'days_diff', v_days_diff
        );
    END IF;
    
    -- Check if within allowed window
    IF v_days_diff <= p_max_backdate_days THEN
        RETURN jsonb_build_object(
            'allowed', true,
            'requires_approval', false,
            'days_diff', v_days_diff,
            'max_days', p_max_backdate_days
        );
    END IF;
    
    -- Requires approval if beyond window
    IF v_days_diff > p_requires_approval_after THEN
        RETURN jsonb_build_object(
            'allowed', true,
            'requires_approval', true,
            'days_diff', v_days_diff,
            'approval_threshold', p_requires_approval_after,
            'reason', format('Backdating beyond %s days requires executive approval', p_requires_approval_after)
        );
    END IF;
    
    -- Not allowed beyond max
    RETURN jsonb_build_object(
        'allowed', false,
        'reason', format('Backdating beyond %s days is not permitted', p_max_backdate_days),
        'days_diff', v_days_diff,
        'max_days', p_max_backdate_days
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Grant permissions for check_backdate_permission
GRANT EXECUTE ON FUNCTION check_backdate_permission(DATE, INTEGER, INTEGER) TO authenticated;

-- 3. Now create the main function with proper type handling
CREATE OR REPLACE FUNCTION post_journal_entry_with_backdate_check(
    p_reference_type TEXT,
    p_reference_id UUID,
    p_description TEXT,
    p_lines JSONB,
    p_user_id UUID,
    p_entry_date DATE DEFAULT CURRENT_DATE,
    p_max_backdate_days INTEGER DEFAULT 3
)
RETURNS JSONB AS $$
DECLARE
    v_backdate_check JSONB;
    v_approval_required BOOLEAN;
    v_journal_entry_id UUID;
    v_total_debit DECIMAL(15,2);
    v_total_credit DECIMAL(15,2);
    v_line RECORD;
    v_allowed BOOLEAN;
    v_reason TEXT;
BEGIN
    -- Check backdate permission
    v_backdate_check := check_backdate_permission(p_entry_date, p_max_backdate_days, 0);
    
    -- Extract values safely
    v_allowed := (v_backdate_check->>'allowed')::boolean;
    v_reason := v_backdate_check->>'reason';
    
    IF NOT v_allowed THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', v_reason,
            'requires_approval', false
        );
    END IF;
    
    v_approval_required := COALESCE((v_backdate_check->>'requires_approval')::boolean, false);
    
    -- If approval required, create request and return
    IF v_approval_required THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Backdate approval required',
            'requires_approval', true,
            'check_result', v_backdate_check
        );
    END IF;
    
    -- Validate closed period (check if table exists first)
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'closed_periods' AND table_schema = 'public') THEN
            IF EXISTS (SELECT 1 FROM closed_periods WHERE month = to_char(p_entry_date, 'YYYY-MM')) THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', format('Period %s is closed', to_char(p_entry_date, 'YYYY-MM'))
                );
            END IF;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            -- Table doesn't exist, continue without closed period check
            NULL;
    END;
    
    -- Calculate totals
    SELECT 
        COALESCE(SUM((l->>'debit')::decimal), 0),
        COALESCE(SUM((l->>'credit')::decimal), 0)
    INTO v_total_debit, v_total_credit
    FROM jsonb_array_elements(p_lines) l;
    
    -- Validate balance
    IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Journal not balanced: Debits %s, Credits %s', v_total_debit, v_total_credit)
        );
    END IF;
    
    -- Create journal entry with status = 'posted'
    INSERT INTO journal_entries (reference_type, reference_id, description, created_by, date, status)
    VALUES (p_reference_type, p_reference_id, p_description, p_user_id, p_entry_date, 'posted')
    RETURNING id INTO v_journal_entry_id;
    
    -- Create journal lines
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit)
        VALUES (
            v_journal_entry_id,
            (v_line->>'account_id')::UUID,
            COALESCE((v_line->>'debit')::decimal, 0),
            COALESCE((v_line->>'credit')::decimal, 0)
        );
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'journal_entry_id', v_journal_entry_id,
        'debits', v_total_debit,
        'credits', v_total_credit
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant permissions for the main function
GRANT EXECUTE ON FUNCTION post_journal_entry_with_backdate_check(TEXT, UUID, TEXT, JSONB, UUID, DATE, INTEGER) TO authenticated;

-- 5. Test query (uncomment to test)
-- SELECT post_journal_entry_with_backdate_check('test', null, 'test', '[]', auth.uid());
