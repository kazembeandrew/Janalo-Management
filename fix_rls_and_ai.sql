-- Fix RLS and AI Issues
-- This script creates the missing get_auth_role function and checks AI service

-- Create get_auth_role function if it doesn't exist
CREATE OR REPLACE FUNCTION get_auth_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.users WHERE id = auth.uid()),
    'user'
  );
$$;

-- Enable RLS on users table if not already enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop and recreate user policies to ensure they work correctly
DROP POLICY IF EXISTS "Users can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;

-- Create proper user policies
CREATE POLICY "Users can view all users" ON public.users
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.users
FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Admin/CEO can update users but not delete
CREATE POLICY "Admins can update users" ON public.users
FOR UPDATE TO authenticated USING (get_auth_role() IN ('admin', 'ceo'));

-- Admin/CEO can insert new users (service role should handle this via direct SQL)
CREATE POLICY "Admins can insert users" ON public.users
FOR INSERT TO authenticated WITH CHECK (get_auth_role() IN ('admin', 'ceo'));

-- Grant necessary permissions
GRANT ALL ON public.users TO authenticated;

-- Test the function
SELECT get_auth_role() as current_user_role;
