-- Show the correct function signature for reference
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as parameters,
    pg_get_function_result(oid) as return_type
FROM pg_proc 
WHERE proname = 'post_journal_entry_with_backdate_check';

-- The correct parameter order is:
-- 1. p_description TEXT
-- 2. p_lines JSONB  
-- 3. p_entry_date DATE
-- 4. p_max_backdate_days INTEGER
-- 5. p_reference_id UUID
-- 6. p_reference_type TEXT
-- 7. p_user_id UUID
