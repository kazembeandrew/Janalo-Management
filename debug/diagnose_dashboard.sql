-- DASHBOARD DIAGNOSTIC - Check what's broken
-- Execute this in Supabase SQL Editor

-- ============================================================================
-- 1. BASIC CONNECTIVITY TEST
-- ============================================================================

SELECT
    'DATABASE_CONNECTION_OK' as status,
    NOW() as current_time,
    current_user as current_user,
    version() as postgres_version;

-- ============================================================================
-- 2. CHECK REQUIRED TABLES EXIST
-- ============================================================================

SELECT
    schemaname,
    tablename,
    tableowner,
    tablespace,
    hasindexes,
    hasrules,
    hastriggers,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'users', 'loans', 'borrowers', 'internal_accounts',
    'journal_entries', 'journal_lines', 'notifications',
    'liquidity_config', 'expenses', 'tasks'
)
ORDER BY tablename;

-- ============================================================================
-- 3. CHECK REQUIRED FUNCTIONS EXIST
-- ============================================================================

SELECT
    proname as function_name,
    pg_get_function_identity_arguments(oid) as arguments,
    obj_description(oid, 'pg_proc') as description
FROM pg_proc
WHERE proname IN (
    'get_auth_role',
    'get_notification_counts_detailed',
    'calculate_liquidity_position',
    'update_account_balance_from_journal'
)
AND pg_function_is_visible(oid)
ORDER BY proname;

-- ============================================================================
-- 4. TEST BASIC DASHBOARD QUERIES
-- ============================================================================

-- Test user authentication
SELECT
    'USER_AUTH_TEST' as test_type,
    COUNT(*) as user_count,
    COUNT(*) FILTER (WHERE role IN ('admin', 'ceo', 'loan_officer', 'hr', 'accountant')) as valid_roles
FROM public.users;

-- Test loan statistics
SELECT
    'LOAN_STATS_TEST' as test_type,
    COUNT(*) as total_loans,
    COUNT(*) FILTER (WHERE status = 'active') as active_loans,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_loans,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_loans
FROM public.loans;

-- Test liquidity calculation
SELECT
    'LIQUIDITY_TEST' as test_type,
    CASE
        WHEN calculate_liquidity_position() IS NOT NULL THEN 'FUNCTION_WORKS'
        ELSE 'FUNCTION_BROKEN'
    END as liquidity_function_status,
    (calculate_liquidity_position()->>'total_liquidity')::DECIMAL as total_liquidity,
    (calculate_liquidity_position()->>'liquidity_percentage')::DECIMAL as liquidity_percentage;

-- Test notification counts
SELECT
    'NOTIFICATION_TEST' as test_type,
    CASE
        WHEN get_notification_counts_detailed(NULL) IS NOT NULL THEN 'FUNCTION_WORKS'
        ELSE 'FUNCTION_BROKEN'
    END as notification_function_status,
    (get_notification_counts_detailed(NULL)->>'total_unread')::INTEGER as total_unread;

-- ============================================================================
-- 5. CHECK RLS POLICIES (Most likely culprit)
-- ============================================================================

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
WHERE schemaname = 'public'
AND tablename IN ('users', 'loans', 'notifications', 'internal_accounts')
ORDER BY tablename, policyname;

-- ============================================================================
-- 6. TEST RLS BY RUNNING AS AUTHENTICATED USER
-- ============================================================================

-- Temporarily disable RLS to test if that's the issue
-- (This will show if data exists but RLS is blocking access)

-- Test loans access
SELECT
    'RLS_TEST_LOANS' as test_type,
    COUNT(*) as total_loans_in_table,
    COUNT(*) FILTER (WHERE status = 'active') as active_loans_in_table
FROM public.loans;

-- Test users access
SELECT
    'RLS_TEST_USERS' as test_type,
    COUNT(*) as total_users_in_table,
    COUNT(*) FILTER (WHERE is_active = true) as active_users_in_table
FROM public.users;

-- Test notifications access
SELECT
    'RLS_TEST_NOTIFICATIONS' as test_type,
    COUNT(*) as total_notifications_in_table
FROM public.notifications;

-- ============================================================================
-- 7. CHECK FOR MISSING DATA
-- ============================================================================

-- Check if we have essential data
SELECT
    'DATA_INTEGRITY_CHECK' as check_type,
    (SELECT COUNT(*) FROM public.users) as users_count,
    (SELECT COUNT(*) FROM public.internal_accounts WHERE is_system_account = true) as system_accounts_count,
    (SELECT COUNT(*) FROM public.liquidity_config) as liquidity_config_count,
    (SELECT COUNT(*) FROM public.loans) as loans_count,
    CASE
        WHEN (SELECT COUNT(*) FROM public.users) > 0
             AND (SELECT COUNT(*) FROM public.internal_accounts WHERE is_system_account = true) > 0
             AND (SELECT COUNT(*) FROM public.liquidity_config) > 0
        THEN 'DATA_OK'
        ELSE 'MISSING_ESSENTIAL_DATA'
    END as data_status;

-- ============================================================================
-- 8. CHECK RECENT ERRORS (if any audit logs exist)
-- ============================================================================

SELECT
    'RECENT_ERRORS' as log_type,
    action,
    entity_type,
    details,
    created_at
FROM public.audit_logs
WHERE action LIKE '%error%' OR action LIKE '%fail%'
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- QUICK FIXES BASED ON DIAGNOSIS
-- ============================================================================

/*
Based on the diagnostic results, here are likely fixes:

1. If RLS policies are missing - Run complete_schema.sql policies section
2. If functions are missing - Run complete_schema.sql functions section
3. If data is missing - Run complete_schema.sql initial data section
4. If tables are missing - Run the complete schema again

Most likely issue: RLS policies were dropped but not recreated properly.
*/
