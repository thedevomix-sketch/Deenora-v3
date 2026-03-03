
-- ==========================================
-- 0. EXTENSIONS
-- ==========================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- ==========================================
-- 1. CORE TABLES DEFINITION
-- ==========================================

-- Institutions Table (Renamed from madrasahs for SaaS)
CREATE TABLE IF NOT EXISTS public.institutions (
  id UUID PRIMARY KEY, 
  name TEXT NOT NULL,
  phone TEXT,
  logo_url TEXT,
  institution_type TEXT DEFAULT 'madrasah', -- madrasah, school, kindergarten, nurani
  config_json JSONB DEFAULT '{
    "modules": {
      "attendance": true,
      "fees": true,
      "results": true,
      "admit_card": true,
      "seat_plan": true,
      "accounting": true
    },
    "result_system": "grading",
    "attendance_type": "daily",
    "fee_structure": "monthly",
    "ui_mode": "madrasah"
  }'::jsonb,
  theme TEXT DEFAULT 'default',
  status TEXT DEFAULT 'active', -- active, suspended, trial
  is_active BOOLEAN DEFAULT true,
  is_super_admin BOOLEAN DEFAULT false,
  balance NUMERIC DEFAULT 0,
  sms_balance INTEGER DEFAULT 0,
  reve_api_key TEXT,
  reve_secret_key TEXT,
  reve_caller_id TEXT,
  reve_client_id TEXT,
  login_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Institution Modules Table
CREATE TABLE IF NOT EXISTS public.institution_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  module_code TEXT NOT NULL, -- attendance, fees, results, etc.
  enabled BOOLEAN DEFAULT true,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, module_code)
);

-- User Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'madrasah_admin', -- super_admin, madrasah_admin, teacher, accountant
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classes Table
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Students Table
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  roll INTEGER,
  guardian_name TEXT,
  guardian_phone TEXT NOT NULL,
  guardian_phone_2 TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, roll)
);

-- Teachers Table
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  login_code TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  permissions JSONB DEFAULT '{"can_manage_students": true, "can_manage_classes": false, "can_send_sms": false, "can_send_free_sms": false}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fee Structures Table
CREATE TABLE IF NOT EXISTS public.fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  fee_name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fees Table
CREATE TABLE IF NOT EXISTS public.fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  month TEXT NOT NULL,
  status TEXT DEFAULT 'paid',
  paid_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ledger Table
CREATE TABLE IF NOT EXISTS public.ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  transaction_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance Table
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exams Table
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  exam_name TEXT NOT NULL,
  exam_date DATE,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exam Subjects
CREATE TABLE IF NOT EXISTS public.exam_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,
  full_marks INTEGER DEFAULT 100,
  pass_marks INTEGER DEFAULT 33
);

-- Exam Marks
CREATE TABLE IF NOT EXISTS public.exam_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.exam_subjects(id) ON DELETE CASCADE,
  marks_obtained NUMERIC DEFAULT 0,
  UNIQUE(exam_id, student_id, subject_id)
);

-- SMS Templates
CREATE TABLE IF NOT EXISTS public.sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  transaction_id TEXT NOT NULL,
  sender_phone TEXT,
  description TEXT,
  status TEXT DEFAULT 'pending',
  sms_count INTEGER,
  type TEXT DEFAULT 'credit',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. AUTH SYNC AUTOMATION
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_full_name TEXT;
    v_institution_name TEXT;
BEGIN
    v_full_name := COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
    v_institution_name := COALESCE(new.raw_user_meta_data->>'madrasah_name', v_full_name || ' Institution');

    -- Check if this is the designated super admin email
    IF new.email = 'kmibrahim@gmail.com' OR new.email = 'thedevomix@gmail.com' THEN
        INSERT INTO public.institutions (id, name, is_active, is_super_admin, balance, sms_balance, institution_type)
        VALUES (new.id, 'Deenora System', true, true, 0, 0, 'system')
        ON CONFLICT (id) DO UPDATE SET is_super_admin = true;

        INSERT INTO public.profiles (id, institution_id, full_name, role, is_active)
        VALUES (new.id, NULL, v_full_name, 'super_admin', true)
        ON CONFLICT (id) DO UPDATE SET role = 'super_admin', institution_id = NULL;
    ELSE
        INSERT INTO public.institutions (id, name, is_active, is_super_admin, balance, sms_balance, institution_type)
        VALUES (new.id, v_institution_name, true, false, 0, 0, 'madrasah')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.profiles (id, institution_id, full_name, role, is_active)
        VALUES (new.id, new.id, v_full_name, 'madrasah_admin', true)
        ON CONFLICT (id) DO UPDATE SET institution_id = EXCLUDED.institution_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ==========================================
-- 3. SYSTEM TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  reve_api_key TEXT,
  reve_secret_key TEXT,
  reve_caller_id TEXT,
  reve_client_id TEXT,
  bkash_number TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.system_settings (id, bkash_number)
VALUES ('00000000-0000-0000-0000-000000000001', '01700000000')
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Policies for Institutions
CREATE POLICY "Super admins can do everything on institutions" ON public.institutions
  FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'super_admin'));

CREATE POLICY "Users can view their own institution" ON public.institutions
  FOR SELECT USING (id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid()));

-- Policies for Profiles
CREATE POLICY "Super admins can view all profiles" ON public.profiles
  FOR SELECT USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'super_admin'));

CREATE POLICY "Users can view profiles in their institution" ON public.profiles
  FOR SELECT USING (institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid()));

-- Generic Policy for Tenant Isolation
-- We can't use a generic function easily in SQL script without defining it first, 
-- so we'll write them out for major tables.

CREATE POLICY "Tenant isolation for classes" ON public.classes
  FOR ALL USING (
    institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

CREATE POLICY "Tenant isolation for students" ON public.students
  FOR ALL USING (
    institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

CREATE POLICY "Tenant isolation for teachers" ON public.teachers
  FOR ALL USING (
    institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

CREATE POLICY "Tenant isolation for fee_structures" ON public.fee_structures
  FOR ALL USING (
    institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

CREATE POLICY "Tenant isolation for fees" ON public.fees
  FOR ALL USING (
    institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

CREATE POLICY "Tenant isolation for ledger" ON public.ledger
  FOR ALL USING (
    institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

CREATE POLICY "Tenant isolation for attendance" ON public.attendance
  FOR ALL USING (
    institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

CREATE POLICY "Tenant isolation for exams" ON public.exams
  FOR ALL USING (
    institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

CREATE POLICY "Tenant isolation for sms_templates" ON public.sms_templates
  FOR ALL USING (
    institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

CREATE POLICY "Tenant isolation for transactions" ON public.transactions
  FOR ALL USING (
    institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );
