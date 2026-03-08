-- Create a debug version of the function with better error handling
DROP FUNCTION IF EXISTS post_journal_entry_with_backdate_check_debug(TEXT, JSONB, DATE, INTEGER, UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION post_journal_entry_with_backdate_check_debug(
    p_description TEXT,
    p_lines JSONB,
    p_entry_date DATE DEFAULT CURRENT_DATE,
    p_max_backdate_days INTEGER DEFAULT 3,
    p_reference_id UUID DEFAULT NULL,
    p_reference_type TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number INTEGER;
    v_line JSONB;
    v_line_id UUID;
    v_account_id UUID;
BEGIN
    RAISE NOTICE 'Starting journal entry creation';
    RAISE NOTICE 'Parameters: description=%, lines=%, entry_date=%', p_description, p_lines, p_entry_date;
    
    -- Generate entry ID
    v_entry_id := gen_random_uuid();
    RAISE NOTICE 'Generated entry_id: %', v_entry_id;
    
    -- Get next entry number
    SELECT COALESCE(MAX(entry_number::TEXT), '0')::INTEGER + 1 INTO v_entry_number FROM journal_entries;
    RAISE NOTICE 'Calculated entry_number: %', v_entry_number;
    
    -- Insert journal entry
    RAISE NOTICE 'Inserting journal entry';
    INSERT INTO journal_entries (
        id,
        entry_number,
        entry_date,
        description,
        status,
        created_by,
        created_at
    ) VALUES (
        v_entry_id,
        v_entry_number::TEXT,
        p_entry_date,
        p_description,
        'posted',
        p_user_id,
        NOW()
    );
    RAISE NOTICE 'Journal entry inserted successfully';
    
    -- Insert journal lines
    RAISE NOTICE 'Processing % journal lines', jsonb_array_length(p_lines);
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_line_id := gen_random_uuid();
        v_account_id := (v_line->>'account_id')::UUID;
        
        RAISE NOTICE 'Inserting line: account_id=%, debit=%, credit=%', v_account_id, v_line->>'debit', v_line->>'credit';
        
        INSERT INTO journal_lines (
            id,
            journal_entry_id,
            account_id,
            debit,
            credit,
            description,
            created_at
        ) VALUES (
            v_line_id,
            v_entry_id,
            v_account_id,
            (v_line->>'debit')::DECIMAL(15,2),
            (v_line->>'credit')::DECIMAL(15,2),
            v_line->>'description',
            NOW()
        );
    END LOOP;
    RAISE NOTICE 'All journal lines inserted successfully';
    
    RETURN v_entry_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in function: %', SQLERRM;
        RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION post_journal_entry_with_backdate_check_debug(TEXT, JSONB, DATE, INTEGER, UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION post_journal_entry_with_backdate_check_debug(TEXT, JSONB, DATE, INTEGER, UUID, TEXT, UUID) TO service_role;
