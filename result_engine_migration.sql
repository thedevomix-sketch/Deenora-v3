-- 1. Create new tables
CREATE TABLE IF NOT EXISTS public.befaq_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  exam_year TEXT NOT NULL,
  class_name TEXT NOT NULL,
  markaz_name TEXT,
  publish_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.befaq_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  full_marks INTEGER DEFAULT 100,
  pass_marks INTEGER DEFAULT 33
);

CREATE TABLE IF NOT EXISTS public.befaq_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES public.befaq_exams(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.befaq_subjects(id) ON DELETE CASCADE,
  written_marks NUMERIC DEFAULT 0,
  oral_marks NUMERIC DEFAULT 0,
  total_marks NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qawmi_result_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  grading_type TEXT NOT NULL, -- division|grade|marks
  subjects_structure JSONB,
  pass_rules JSONB,
  calculation_rules JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.befaq_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.befaq_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qawmi_result_configs ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Tenant isolation for befaq_exams" ON public.befaq_exams
  FOR ALL USING (institution_id = public.get_my_institution_id() OR public.is_super_admin());

CREATE POLICY "Tenant isolation for befaq_results" ON public.befaq_results
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.befaq_exams e WHERE e.id = befaq_results.exam_id AND (e.institution_id = public.get_my_institution_id() OR public.is_super_admin()))
  );

CREATE POLICY "Tenant isolation for qawmi_result_configs" ON public.qawmi_result_configs
  FOR ALL USING (institution_id = public.get_my_institution_id() OR public.is_super_admin());

-- 4. Update existing institutions to have result_engine = 'school'
UPDATE public.institutions
SET config_json = jsonb_set(config_json, '{result_engine}', '"school"')
WHERE NOT (config_json ? 'result_engine');
