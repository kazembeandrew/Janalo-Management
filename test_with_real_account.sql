-- Test the function with a real account from the database

-- First, get a real account ID
DO $$
DECLARE
    v_account_id UUID;
    v_result UUID;
BEGIN
    -- Get the first available account
    SELECT id INTO v_account_id FROM accounts LIMIT 1;
    
    IF v_account_id IS NULL THEN
        RAISE NOTICE 'No accounts found in the database. Please create an account first.';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Using account_id: %', v_account_id;
    
    -- Test the function with the real account ID
    SELECT post_journal_entry_with_backdate_check(
        'Test journal entry with real account'::TEXT,
        '[{"account_id": "' || v_account_id || '", "debit": "100.00", "credit": "0.00", "description": "Test debit line"}]'::JSONB,
        CURRENT_DATE::DATE,
        3::INTEGER,
        NULL::UUID,
        NULL::TEXT,
        NULL::UUID
    ) INTO v_result;
    
    RAISE NOTICE 'Function returned entry_id: %', v_result;
    
    -- Check what was created
    IF v_result IS NOT NULL THEN
        RAISE NOTICE 'Journal entry created successfully!';
        
        -- Show the created entry
        RAISE NOTICE '=== Created Journal Entry ===';
        SELECT id, entry_number, entry_date, description, status, created_by, created_at 
        FROM journal_entries 
        WHERE id = v_result;
        
        -- Show the created lines
        RAISE NOTICE '=== Created Journal Lines ===';
        SELECT id, journal_entry_id, account_id, debit, credit, description, created_at 
        FROM journal_lines 
        WHERE journal_entry_id = v_result;
    ELSE
        RAISE NOTICE 'Function returned NULL - something went wrong';
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error: %', SQLERRM;
        RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
END $$;
