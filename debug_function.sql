-- Debug the function step by step

-- 1. First, check if the function exists and get its signature
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as parameters,
    pg_get_function_result(oid) as return_type
FROM pg_proc 
WHERE proname = 'post_journal_entry_with_backdate_check';

-- 2. Check if we have any accounts to use
SELECT id, name FROM accounts LIMIT 1;

-- 3. Try a very simple test with minimal data
DO $$
DECLARE
    v_result UUID;
    v_test_account_id UUID := (SELECT id FROM accounts LIMIT 1);
BEGIN
    -- Test with a real account if available, otherwise use NULL
    IF v_test_account_id IS NOT NULL THEN
        SELECT post_journal_entry_with_backdate_check(
            'Debug test'::TEXT,
            CURRENT_DATE::DATE,
            '[{"account_id": "' || v_test_account_id || '", "debit": "100.00", "credit": "0.00", "description": "Test"}]'::JSONB,
            3::INTEGER,
            NULL::UUID,
            NULL::TEXT,
            NULL::UUID
        ) INTO v_result;
        
        RAISE NOTICE 'Function returned: %', v_result;
    ELSE
        RAISE NOTICE 'No accounts found to test with';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error: %', SQLERRM;
END $$;

-- 4. Check what was created
SELECT 'Journal entries:' as table_name, COUNT(*) as count FROM journal_entries WHERE created_at > NOW() - INTERVAL '1 minute'
UNION ALL
SELECT 'Journal lines:' as table_name, COUNT(*) as count FROM journal_lines WHERE created_at > NOW() - INTERVAL '1 minute';
