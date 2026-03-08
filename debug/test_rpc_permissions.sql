-- Test RPC permissions and function accessibility

-- Step 1: Check function permissions
SELECT 
    proname as function_name,
    prorettype::regtype as return_type,
    prosecdef as security_definer,
    prolang::reglanguage as language
FROM pg_proc 
WHERE proname IN ('post_journal_entry_with_backdate_check', 'test_function')
ORDER BY proname;

-- Step 2: Check if functions are executable by authenticated role
SELECT 
    r.rolname as role_name,
    has_function_privilege(r.rolname, 'post_journal_entry_with_backdate_check(text, uuid, text, jsonb, uuid, date, integer)', 'EXECUTE') as can_execute_main,
    has_function_privilege(r.rolname, 'test_function()', 'EXECUTE') as can_execute_test
FROM pg_roles r 
WHERE r.rolname IN ('authenticated', 'anon', 'service_role');

-- Step 3: Test the simple function directly
SELECT test_function();

-- Step 4: Test the main function with minimal parameters
SELECT post_journal_entry_with_backdate_check('test', null, 'test', '[]', null, CURRENT_DATE, 3);

-- Step 5: Check if there are any RLS policies blocking access
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('pg_proc') 
OR policyname LIKE '%function%';

-- Step 6: Verify the function is in the correct schema
SELECT 
    proname as function_name,
    nspname as schema_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE proname IN ('post_journal_entry_with_backdate_check', 'test_function');
