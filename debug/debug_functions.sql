-- Debug and verify function creation step by step

-- Step 1: Check if function exists
SELECT 
    proname as function_name,
    pronargs as argument_count,
    prorettype::regtype as return_type
FROM pg_proc 
WHERE proname = 'post_journal_entry_with_backdate_check';

-- Step 2: Check if check_backdate_permission exists
SELECT 
    proname as function_name,
    pronargs as argument_count,
    prorettype::regtype as return_type
FROM pg_proc 
WHERE proname = 'check_backdate_permission';

-- Step 3: Try creating a simple test function first
CREATE OR REPLACE FUNCTION test_function()
RETURNS TEXT AS $$
BEGIN
    RETURN 'Function works';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Grant permission to test function
GRANT EXECUTE ON FUNCTION test_function() TO authenticated;

-- Step 5: Test the simple function
-- SELECT test_function();

-- Step 6: If test works, create the main function with minimal logic
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
BEGIN
    -- Simple return for testing
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Function created successfully',
        'parameters', jsonb_build_object(
            'reference_type', p_reference_type,
            'user_id', p_user_id,
            'entry_date', p_entry_date
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Grant permissions
GRANT EXECUTE ON FUNCTION post_journal_entry_with_backdate_check(TEXT, UUID, TEXT, JSONB, UUID, DATE, INTEGER) TO authenticated;

-- Step 8: Test the main function
-- SELECT post_journal_entry_with_backdate_check('test', null, 'test', '[]', auth.uid());

-- Step 9: Check all functions again
SELECT 
    proname as function_name,
    pronargs as argument_count,
    prorettype::regtype as return_type
FROM pg_proc 
WHERE proname IN ('test_function', 'post_journal_entry_with_backdate_check', 'check_backdate_permission')
ORDER BY proname;
