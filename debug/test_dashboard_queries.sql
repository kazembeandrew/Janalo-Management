-- TEST DASHBOARD QUERIES - Check if pages can load data now
-- Execute this in Supabase SQL Editor to test what the dashboard needs

-- ============================================================================
-- 1. TEST USER AUTHENTICATION (Already fixed)
-- ============================================================================

SELECT
    'USER_AUTH_OK' as test_result,
    id,
    email,
    full_name,
    role,
    get_auth_role() as effective_role
FROM public.users
WHERE id = 'ad9c0387-d5c2-418d-88c7-42e8d8dd7c98';

-- ============================================================================
-- 2. TEST DASHBOARD STATS FUNCTION
-- ============================================================================

-- Test get_dashboard_stats function (used by dashboard)
SELECT
    'DASHBOARD_STATS_TEST' as test_type,
    CASE
        WHEN get_dashboard_stats() IS NOT NULL THEN 'FUNCTION_WORKS'
        ELSE 'FUNCTION_BROKEN'
    END as status,
    jsonb_object_keys(get_dashboard_stats()) as available_keys;

-- If it works, show the actual data
SELECT get_dashboard_stats() as dashboard_data;

-- ============================================================================
-- 3. TEST NOTIFICATION COUNTS
-- ============================================================================

SELECT
    'NOTIFICATION_TEST' as test_type,
    get_notification_counts_detailed('ad9c0387-d5c2-418d-88c7-42e8d8dd7c98') as notification_counts;

-- ============================================================================
-- 4. TEST LIQUIDITY CALCULATION
-- ============================================================================

SELECT
    'LIQUIDITY_TEST' as test_type,
    calculate_liquidity_position() as liquidity_data;

-- ============================================================================
-- 5. TEST OFFICER PERFORMANCE FUNCTION
-- ============================================================================

-- Test get_officer_performance function
SELECT
    'OFFICER_PERFORMANCE_TEST' as test_type,
    CASE
        WHEN get_officer_performance() IS NOT NULL THEN 'FUNCTION_WORKS'
        ELSE 'FUNCTION_BROKEN'
    END as status;

-- Show the data if it works
SELECT * FROM get_officer_performance() LIMIT 5;

-- ============================================================================
-- 6. TEST MONTHLY REVENUE FUNCTION
-- ============================================================================

-- Test get_monthly_revenue function
SELECT
    'MONTHLY_REVENUE_TEST' as test_type,
    CASE
        WHEN get_monthly_revenue() IS NOT NULL THEN 'FUNCTION_WORKS'
        ELSE 'FUNCTION_BROKEN'
    END as status;

-- Show the data if it works
SELECT * FROM get_monthly_revenue() LIMIT 5;

-- ============================================================================
-- 7. TEST BASIC DASHBOARD DATA QUERIES
-- ============================================================================

-- Test loans query (active loans for dashboard)
SELECT
    'ACTIVE_LOANS_QUERY' as test_type,
    COUNT(*) as active_loans_count,
    COALESCE(SUM(principal_outstanding), 0) as total_outstanding_principal,
    COALESCE(SUM(interest_outstanding), 0) as total_outstanding_interest
FROM public.loans
WHERE status = 'active';

-- Test recent loans
SELECT
    'RECENT_LOANS' as test_type,
    id,
    reference_no,
    principal_amount,
    status,
    created_at
FROM public.loans
ORDER BY created_at DESC
LIMIT 5;

-- Test expenses query
SELECT
    'EXPENSES_QUERY' as test_type,
    COUNT(*) as approved_expenses_count,
    COALESCE(SUM(amount), 0) as total_approved_expenses
FROM public.expenses
WHERE status = 'approved';

-- Test accounts query
SELECT
    'ACCOUNTS_QUERY' as test_type,
    COUNT(*) as total_accounts,
    COUNT(*) FILTER (WHERE is_system_account = true) as system_accounts,
    COALESCE(SUM(balance), 0) as total_balance
FROM public.internal_accounts;

-- Test budgets query
SELECT
    'BUDGETS_QUERY' as test_type,
    COUNT(*) as budget_items,
    COALESCE(SUM(amount), 0) as total_budget_amount
FROM public.budgets
WHERE month = '2026-03'; -- Current month

-- ============================================================================
-- 8. CHECK FOR MISSING DATA THAT DASHBOARD EXPECTS
-- ============================================================================

SELECT
    'DASHBOARD_DATA_CHECK' as check_type,
    (SELECT COUNT(*) FROM public.loans) as loans_count,
    (SELECT COUNT(*) FROM public.users WHERE is_active = true) as active_users_count,
    (SELECT COUNT(*) FROM public.internal_accounts) as accounts_count,
    (SELECT COUNT(*) FROM public.liquidity_config) as liquidity_config_count,
    (SELECT COUNT(*) FROM public.notifications) as notifications_count,
    CASE
        WHEN (SELECT COUNT(*) FROM public.loans) > 0
             AND (SELECT COUNT(*) FROM public.internal_accounts) > 0
             AND (SELECT COUNT(*) FROM public.liquidity_config) > 0
        THEN 'DATA_AVAILABLE'
        ELSE 'MISSING_CRITICAL_DATA'
    END as dashboard_readiness;

-- ============================================================================
-- 9. TEST RLS POLICIES FOR DASHBOARD ACCESS
-- ============================================================================

-- Test if user can access loans (simulating RLS check)
SELECT
    'RLS_TEST_LOANS' as test_type,
    COUNT(*) as accessible_loans,
    role as user_role,
    get_auth_role() as effective_role
FROM public.loans, public.users
WHERE users.id = 'ad9c0387-d5c2-418d-88c7-42e8d8dd7c98'
    AND (
        get_auth_role() IN ('admin', 'ceo', 'accountant') OR
        loans.officer_id = 'ad9c0387-d5c2-418d-88c7-42e8d8dd7c98'
    );

-- ============================================================================
-- EXPECTED RESULTS FOR WORKING DASHBOARD
-- ============================================================================

/*
For the dashboard to work, you should see:
- USER_AUTH_OK: User details with role
- DASHBOARD_STATS_TEST: FUNCTION_WORKS
- NOTIFICATION_TEST: Valid notification counts JSON
- LIQUIDITY_TEST: Valid liquidity data JSON
- OFFICER_PERFORMANCE_TEST: FUNCTION_WORKS (if applicable)
- MONTHLY_REVENUE_TEST: FUNCTION_WORKS
- ACTIVE_LOANS_QUERY: Some loan counts
- DASHBOARD_DATA_CHECK: DATA_AVAILABLE

If any of these show issues, that's why pages aren't loading.
*/
