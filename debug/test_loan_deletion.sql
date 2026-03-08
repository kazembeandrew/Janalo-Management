-- TEST LOAN DELETION DIRECTLY IN SUPABASE
-- Run this in Supabase SQL Editor to test loan deletion

-- 1. Check current RLS policies on loans table
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'loans'
ORDER BY policyname;

-- 2. Test if current user can delete loans (this will show what the policy evaluates to)
SELECT
    'CURRENT_USER_TEST' as test_type,
    auth.uid() as current_user_id,
    get_auth_role() as user_role,
    CASE
        WHEN get_auth_role() IN ('admin', 'ceo', 'loan_officer') THEN 'SHOULD_HAVE_DELETE_ACCESS'
        ELSE 'NO_DELETE_ACCESS'
    END as delete_access_status;

-- 3. Find a test loan to delete (get loan details)
SELECT
    l.id,
    l.status,
    l.reference_no,
    b.full_name as borrower_name,
    u.email as officer_email
FROM loans l
JOIN borrowers b ON l.borrower_id = b.id
LEFT JOIN users u ON l.officer_id = u.id
WHERE l.status IN ('pending', 'rejected') -- Safer to test with non-active loans
ORDER BY l.created_at DESC
LIMIT 5;

-- 4. Try to delete a specific loan (replace LOAN_ID_HERE with actual ID from step 3)
-- UNCOMMENT AND RUN THIS AFTER CONFIRMING THE LOAN ID:
-- DELETE FROM loans WHERE id = 'LOAN_ID_HERE';

-- 5. Check if any database triggers might be blocking deletion
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'loans'
AND event_manipulation = 'DELETE';
