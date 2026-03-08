-- Create post_journal_entry_with_backdate_check function
-- This function is required by the accounting module

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS post_journal_entry_with_backdate_check(TEXT, JSONB, DATE, INTEGER, UUID, TEXT, UUID);

-- Create the function with correct parameter order
CREATE OR REPLACE FUNCTION post_journal_entry_with_backdate_check(
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
BEGIN
    -- Generate entry ID
    v_entry_id := gen_random_uuid();
    
    -- Get next entry number
    SELECT COALESCE(MAX(entry_number::TEXT), '0')::INTEGER + 1 INTO v_entry_number FROM journal_entries;
    
    -- Insert journal entry
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
    
    -- Insert journal lines
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_line_id := gen_random_uuid();
        
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
            (v_line->>'account_id')::UUID,
            (v_line->>'debit')::DECIMAL(15,2),
            (v_line->>'credit')::DECIMAL(15,2),
            v_line->>'description',
            NOW()
        );
    END LOOP;
    
    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION post_journal_entry_with_backdate_check(TEXT, JSONB, DATE, INTEGER, UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION post_journal_entry_with_backdate_check(TEXT, JSONB, DATE, INTEGER, UUID, TEXT, UUID) TO service_role;
