-- ============================================================================
-- SEED ADMIN USER
-- ============================================================================
-- Create the initial admin user: Andrew with password "Password"

DO $$
DECLARE
  user_id uuid;
BEGIN
  -- Check if user already exists
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = 'andrew@janalo.com';

  IF user_id IS NULL THEN
    -- Create the user in auth.users
    INSERT INTO auth.users (
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data
    ) VALUES (
      'andrew@janalo.com',
      crypt('Password', gen_salt('bf', 10)),
      now(), -- Email confirmed immediately for seeding
      now(),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"full_name": "Andrew"}'::jsonb
    )
    RETURNING id INTO user_id;

    -- Create the user profile in public.users
    INSERT INTO public.users (
      id,
      full_name,
      role,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      user_id,
      'Andrew',
      'admin'::user_role,
      true,
      now(),
      now()
    );

    RAISE NOTICE 'Admin user "Andrew" created successfully with ID: %', user_id;
  ELSE
    RAISE NOTICE 'Admin user "Andrew" already exists with ID: %', user_id;
  END IF;
END $$;
