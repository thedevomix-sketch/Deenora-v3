-- Drop the function if it exists to avoid parameter name conflicts
DROP FUNCTION IF EXISTS public.create_user_by_admin(text, text, jsonb);

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to create a user with password directly in auth.users
-- This bypasses API rate limits for Super Admins
CREATE OR REPLACE FUNCTION public.create_user_by_admin(
  p_email text,
  p_password text,
  p_user_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_new_id uuid;
  v_encrypted_pw text;
  v_instance_id uuid;
BEGIN
  -- 1. Check if caller is super_admin
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only Super Admins can create users directly.';
  END IF;

  -- 2. Check if user already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'User with this email already exists.';
  END IF;

  -- 3. Get instance_id
  SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
  IF v_instance_id IS NULL THEN
     v_instance_id := '00000000-0000-0000-0000-000000000000';
  END IF;

  v_new_id := gen_random_uuid();
  v_encrypted_pw := crypt(p_password, gen_salt('bf'));

  -- 4. Insert into auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    raw_app_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    is_super_admin
  ) VALUES (
    v_instance_id,
    v_new_id,
    'authenticated',
    'authenticated',
    p_email,
    v_encrypted_pw,
    now(), -- Auto confirm email
    p_user_data,
    '{"provider":"email","providers":["email"]}'::jsonb,
    now(),
    now(),
    '',
    '',
    false
  );

  -- 5. Create identity
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_new_id,
    v_new_id,
    format('{"sub":"%s","email":"%s"}', v_new_id, p_email)::jsonb,
    'email',
    v_new_id::text,
    now(),
    now(),
    now()
  );

  RETURN v_new_id;
END;
$$;
