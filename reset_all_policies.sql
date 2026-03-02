-- DELETE ALL RLS POLICIES AND START AGAIN
-- Execute this in Supabase SQL Editor
-- WARNING: This will remove all row-level security policies!
-- Make sure you have backups and know how to recreate them.

-- ============================================================================
-- STEP 1: LIST ALL CURRENT POLICIES (Run this first to see what exists)
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
ORDER BY tablename, policyname;

-- ============================================================================
-- STEP 2: DROP ALL POLICIES (DANGER ZONE - Run only after backup)
-- ============================================================================

-- Drop all policies for each table
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                      policy_record.policyname,
                      policy_record.schemaname,
                      policy_record.tablename);
        RAISE NOTICE 'Dropped policy: %.% on table %',
                    policy_record.schemaname,
                    policy_record.policyname,
                    policy_record.tablename;
    END LOOP;
END $$;

-- ============================================================================
-- STEP 3: OPTIONALLY DISABLE RLS ON ALL TABLES (Even more dangerous)
-- ============================================================================

-- WARNING: Only run this if you want to completely disable RLS
-- This makes all tables publicly accessible!

-- DO $$
-- DECLARE
--     table_record RECORD;
-- BEGIN
--     FOR table_record IN
--         SELECT tablename
--         FROM pg_tables
--         WHERE schemaname = 'public'
--     LOOP
--         EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY',
--                       table_record.tablename);
--         RAISE NOTICE 'Disabled RLS on table: %', table_record.tablename;
--     END LOOP;
-- END $$;

-- ============================================================================
-- STEP 4: VERIFY POLICIES ARE GONE
-- ============================================================================

SELECT
    schemaname,
    tablename,
    policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- STEP 5: CHECK RLS STATUS ON TABLES
-- ============================================================================

SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- RECREATION GUIDANCE (After running above, recreate policies)
-- ============================================================================

/*
After dropping all policies, you need to recreate them. Here's the typical pattern:

1. ENABLE RLS on tables (if you disabled it):
   ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;

2. Create basic policies for authenticated users:

   -- Allow users to see their own data
   CREATE POLICY "Users can view own data" ON public.users
   FOR SELECT USING (auth.uid() = id);

   -- Allow users to update their own data
   CREATE POLICY "Users can update own data" ON public.users
   FOR UPDATE USING (auth.uid() = id);

   -- Allow admins/executives full access
   CREATE POLICY "Admins have full access" ON public.loans
   FOR ALL USING (
     get_auth_role() IN ('admin', 'ceo')
   );

3. Common policy patterns:
   - get_auth_role() for role-based access
   - auth.uid() for user-specific data
   - EXISTS() for related data access

4. Test thoroughly after recreation!

Look at your migration files in supabase/migrations/ for the original policies.
*/
