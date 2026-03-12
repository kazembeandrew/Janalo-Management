-- Create post_journal_entry_with_backdate_check function
DROP FUNCTION IF EXISTS post_journal_entry_with_backdate_check(TEXT, UUID, TEXT, JSONB, UUID, DATE, INTEGER);

CREATE OR REPLACE FUNCTION post_journal_entry_with_backdate_check(
    p_reference_type TEXT,
    p_reference_id UUID,
    p_description TEXT,
    p_lines JSONB,
    p_user_id UUID,
    p_entry_date DATE DEFAULT CURRENT_DATE,
    p_max_backdate_days INTEGER DEFAULT 3
)
RETURNS UUID AS $
DECLARE
    v_entry_id UUID;
    v_entry_number INTEGER;
    v_line JSONB;
    v_line_id UUID;
BEGIN
    v_entry_id := gen_random_uuid();
    SELECT COALESCE(MAX(entry_number), 0) + 1 INTO v_entry_number FROM journal_entries;
    
    INSERT INTO journal_entries (
        id, entry_number, entry_date, description,
        reference_type, reference_id, status, created_by, created_at
    ) VALUES (
        v_entry_id, v_entry_number, p_entry_date, p_description,
        p_reference_type, p_reference_id, 'posted', p_user_id, NOW()
    );
    
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_line_id := gen_random_uuid();
        INSERT INTO journal_lines (
            id, entry_id, account_id, debit_amount, credit_amount, description, created_at
        ) VALUES (
            v_line_id, v_entry_id,
            (v_line->>'account_id')::UUID,
            (v_line->>'debit_amount')::DECIMAL(15,2),
            (v_line->>'credit_amount')::DECIMAL(15,2),
            v_line->>'description',
            NOW()
        );
    END LOOP;
    
    RETURN v_entry_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION post_journal_entry_with_backdate_check(TEXT, UUID, TEXT, JSONB, UUID, DATE, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION post_journal_entry_with_backdate_check(TEXT, UUID, TEXT, JSONB, UUID, DATE, INTEGER) TO service_role;
