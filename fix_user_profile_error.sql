-- FIX USER PROFILE ERROR - User doesn't exist in public.users table
-- Execute this in Supabase SQL Editor

-- ============================================================================
-- 1. CHECK AUTH.USERS VS PUBLIC.USERS
-- ============================================================================

-- Check if the user exists in auth.users
SELECT
    'AUTH_USERS_CHECK' as check_type,
    id,
    email,
    created_at,
    last_sign_in_at
FROM auth.users
WHERE id = 'ad9c0387-d5c2-418d-88c7-42e8d8dd7c98';

-- Check if the user exists in public.users
SELECT
    'PUBLIC_USERS_CHECK' as check_type,
    id,
    email,
    full_name,
    role,
    is_active,
    created_at
FROM public.users
WHERE id = 'ad9c0387-d5c2-418d-88c7-42e8d8dd7c98';

-- ============================================================================
-- 2. SYNC MISSING USER FROM AUTH TO PUBLIC
-- ============================================================================

-- If user exists in auth but not in public, create them
INSERT INTO public.users (id, email, full_name, role, is_active)
SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email) as full_name,
    COALESCE(au.raw_user_meta_data->>'role', 'loan_officer') as role,
    true as is_active
FROM auth.users au
WHERE au.id = 'ad9c0387-d5c2-418d-88c7-42e8d8dd7c98'
AND NOT EXISTS (
    SELECT 1 FROM public.users pu WHERE pu.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. VERIFY THE FIX
-- ============================================================================

-- Check that user now exists
SELECT
    'AFTER_FIX_CHECK' as check_type,
    pu.id,
    pu.email,
    pu.full_name,
    pu.role,
    pu.is_active,
    au.email as auth_email
FROM public.users pu
JOIN auth.users au ON pu.id = au.id
WHERE pu.id = 'ad9c0387-d5c2-418d-88c7-42e8d8dd7c98';

-- ============================================================================
-- 4. CHECK ALL AUTH USERS HAVE PUBLIC PROFILES
-- ============================================================================

-- Find any auth users missing from public.users
SELECT
    'MISSING_USERS' as issue_type,
    au.id,
    au.email,
    au.created_at as auth_created,
    'User exists in auth but not in public.users' as issue
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ORDER BY au.created_at DESC;

-- ============================================================================
-- 5. BULK SYNC ALL MISSING USERS (Optional)
-- ============================================================================

-- Create profiles for all auth users missing from public.users
-- Uncomment and run if needed:

/*
INSERT INTO public.users (id, email, full_name, role, is_active)
SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email) as full_name,
    COALESCE(au.raw_user_meta_data->>'role', 'loan_officer') as role,
    true as is_active
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM public.users pu WHERE pu.id = au.id
)
ON CONFLICT (id) DO NOTHING;
*/

-- ============================================================================
-- 6. TEST THE DASHBOARD QUERY MANUALLY
-- ============================================================================

-- Test the exact query the app is making
SELECT *
FROM public.users
WHERE id = 'ad9c0387-d5c2-418d-88c7-42e8d8dd7c98';

-- ============================================================================
-- EXPECTED RESULT
-- ============================================================================

-- After running this, the user should exist and the dashboard should load.
-- If the dashboard still doesn't work, there may be other RLS policy issues.
