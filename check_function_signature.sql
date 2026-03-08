-- Check the exact function signature
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as parameters,
    pg_get_function_result(oid) as return_type
FROM pg_proc 
WHERE proname = 'post_journal_entry_with_backdate_check';
