-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to create a user with password directly in auth.users
-- This bypasses API rate limits for Super Admins
CREATE OR REPLACE FUNCTION public.create_user_by_admin(
  email text,
  password text,
  user_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  new_id uuid;
  encrypted_pw text;
  instance_id_val uuid;
BEGIN
  -- Check if caller is super_admin
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only Super Admins can create users directly.';
  END IF;

  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE auth.users.email = create_user_by_admin.email) THEN
    RAISE EXCEPTION 'User with this email already exists.';
  END IF;

  -- Get instance_id (usually constant per project, but good to fetch)
  SELECT id INTO instance_id_val FROM auth.instances LIMIT 1;
  IF instance_id_val IS NULL THEN
     -- Fallback if instances table is empty or not accessible (should not happen in standard Supabase)
     -- We try to get it from an existing user, or default to nil UUID
     SELECT instance_id INTO instance_id_val FROM auth.users LIMIT 1;
     IF instance_id_val IS NULL THEN
        instance_id_val := '00000000-0000-0000-0000-000000000000';
     END IF;
  END IF;

  new_id := gen_random_uuid();
  encrypted_pw := crypt(password, gen_salt('bf'));

  -- Insert into auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    is_super_admin
  ) VALUES (
    instance_id_val,
    new_id,
    'authenticated',
    'authenticated',
    email,
    encrypted_pw,
    now(), -- Auto confirm email
    user_data,
    now(),
    now(),
    '',
    '',
    false
  );

  -- Create identity (Required for login to work properly in some flows)
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    new_id,
    new_id,
    format('{"sub":"%s","email":"%s"}', new_id, email)::jsonb,
    'email',
    now(),
    now(),
    now()
  );

  RETURN new_id;
END;
$$;
