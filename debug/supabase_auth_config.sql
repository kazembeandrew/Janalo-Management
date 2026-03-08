-- ============================================================================
-- SUPABASE AUTHENTICATION CONFIGURATION
-- ============================================================================
-- This file contains SQL commands to configure Supabase authentication settings
-- Execute these in the Supabase SQL Editor or Dashboard

-- ============================================================================
-- 1. ENABLE EMAIL CONFIRMATION
-- ============================================================================

-- Enable email confirmation for new user signups
UPDATE auth.config
SET enable_confirmations = true,
    enable_signup = false,  -- Disable public signup, users created by admins only
    enable_email_confirmations = true,
    enable_email_change_confirmations = true,
    enable_confirmations = true;

-- ============================================================================
-- 2. CONFIGURE AUTH SETTINGS
-- ============================================================================

-- Update auth settings to require email confirmation
UPDATE auth.config
SET
  -- Email settings
  enable_email_confirmations = true,
  enable_email_change_confirmations = true,
  enable_confirmations = true,

  -- Password settings
  min_password_length = 8,
  password_hibp_enabled = true,  -- Check against HaveIBeenPwned

  -- Signup settings (disabled for enterprise app)
  enable_signup = false,

  -- Session settings
  jwt_expiry = 3600,  -- 1 hour
  jwt_secret = gen_random_uuid()::text,

  -- SMTP settings (configure in Supabase dashboard)
  smtp_admin_email = 'admin@janalo.com',
  smtp_host = '',
  smtp_port = 587,
  smtp_user = '',
  smtp_pass = '',
  smtp_max_frequency = 1;

-- ============================================================================
-- 3. CREATE AUTH POLICIES FOR USER MANAGEMENT
-- ============================================================================

-- Policy to allow admins to create users via RPC function
CREATE OR REPLACE FUNCTION create_user_with_profile(
  user_email text,
  user_password text,
  user_full_name text,
  user_role text DEFAULT 'loan_officer'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id uuid;
  result json;
BEGIN
  -- Check if caller is admin/ceo/hr
  IF NOT (get_auth_role() IN ('admin', 'ceo', 'hr')) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  -- Create the user in auth.users
  INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (
    user_email,
    crypt(user_password, gen_salt('bf', 10)),
    now(),
    now(),
    now()
  )
  RETURNING id INTO user_id;

  -- Create the user profile
  INSERT INTO public.users (id, full_name, role, is_active, created_at, updated_at)
  VALUES (
    user_id,
    user_full_name,
    user_role::user_role,
    true,
    now(),
    now()
  );

  -- Send welcome email (would need to be configured in Supabase)
  -- This is a placeholder - actual email sending would be handled by Supabase auth

  result := json_build_object(
    'success', true,
    'user_id', user_id,
    'message', 'User created successfully'
  );

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- 4. PASSWORD RESET EMAIL TEMPLATE
-- ============================================================================

-- Create a function to handle password reset emails with custom template
CREATE OR REPLACE FUNCTION handle_password_reset()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function can be used to customize password reset emails
  -- For now, we'll use Supabase's default email templates

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 5. ENABLE AUTH HOOKS FOR USER MANAGEMENT
-- ============================================================================

-- Create trigger to automatically create profile when user signs up (though signup is disabled)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.users (id, full_name, role, is_active, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'loan_officer',
    true,
    now(),
    now()
  );

  RETURN NEW;
END;
$$;

-- Trigger for new user creation (though signup is disabled, this handles admin-created users)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 6. EMAIL TEMPLATES CONFIGURATION
-- ============================================================================

-- Note: Email templates should be configured in the Supabase Dashboard under:
-- Authentication > Email Templates

-- Recommended email templates to configure:
-- 1. Confirm signup
-- 2. Invite user
-- 3. Magic link
-- 4. Email change
-- 5. Password recovery

-- ============================================================================
-- 7. SECURITY POLICIES FOR AUTH TABLES
-- ============================================================================

-- Ensure auth tables have proper RLS (this is usually handled by Supabase)
-- But we can add additional security policies if needed

-- Policy to prevent users from accessing other users' auth data
CREATE POLICY "Users can only access their own auth data" ON auth.users
FOR ALL TO authenticated USING (auth.uid() = id);

-- ============================================================================
-- 8. AUTH AUDIT LOGGING
-- ============================================================================

-- Function to log authentication events
CREATE OR REPLACE FUNCTION log_auth_event(
  event_type text,
  user_id uuid DEFAULT NULL,
  metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.system_logs (
    event_type,
    user_id,
    metadata,
    created_at
  ) VALUES (
    event_type,
    COALESCE(user_id, auth.uid()),
    metadata,
    now()
  );
END;
$$;

-- ============================================================================
-- MANUAL STEPS REQUIRED IN SUPABASE DASHBOARD
-- ============================================================================

/*
After running this SQL, complete these steps in the Supabase Dashboard:

1. Go to Authentication > Settings
2. Enable "Enable email confirmations"
3. Set "Site URL" to your production URL
4. Configure SMTP settings for email sending
5. Set up email templates under Authentication > Email Templates

6. For password reset to work properly, ensure:
   - Site URL is set correctly
   - Email templates are configured
   - SMTP is configured for email delivery

7. For user creation to work through the admin panel:
   - The create_user_with_profile function is available
   - Admins can use it to create users programmatically
*/
