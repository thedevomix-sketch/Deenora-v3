-- 1. Ensure the user is super_admin
UPDATE public.profiles
SET role = 'super_admin'
WHERE id IN (SELECT id FROM auth.users WHERE email = 'thedevomix@gmail.com');

UPDATE public.institutions
SET is_super_admin = true, institution_type = 'system'
WHERE id IN (SELECT id FROM auth.users WHERE email = 'thedevomix@gmail.com');

-- 2. Create a demo institution if none exists (excluding super admin)
INSERT INTO public.institutions (id, name, phone, institution_type, is_active, is_super_admin, balance, sms_balance)
SELECT 
  gen_random_uuid(), 
  'Demo Madrasah', 
  '01700000001', 
  'madrasah', 
  true, 
  false, 
  0, 
  100
WHERE NOT EXISTS (
  SELECT 1 FROM public.institutions WHERE is_super_admin = false
);

-- 3. Ensure RLS policies are correct (Redundant but safe)
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can do everything on institutions" ON public.institutions;
CREATE POLICY "Super admins can do everything on institutions" ON public.institutions
  FOR ALL USING (public.is_super_admin());
