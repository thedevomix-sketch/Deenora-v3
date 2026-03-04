-- 1. Enable RLS on befaq_subjects
ALTER TABLE public.befaq_subjects ENABLE ROW LEVEL SECURITY;

-- 2. Create Policy for befaq_subjects
DROP POLICY IF EXISTS "Tenant isolation for befaq_subjects" ON public.befaq_subjects;

CREATE POLICY "Tenant isolation for befaq_subjects" ON public.befaq_subjects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.befaq_exams e 
      WHERE e.id = befaq_subjects.exam_id 
      AND (e.institution_id = public.get_my_institution_id() OR public.is_super_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.befaq_exams e 
      WHERE e.id = befaq_subjects.exam_id 
      AND (e.institution_id = public.get_my_institution_id() OR public.is_super_admin())
    )
  );

-- 3. Ensure befaq_results policy is correct (re-apply to be safe)
DROP POLICY IF EXISTS "Tenant isolation for befaq_results" ON public.befaq_results;

CREATE POLICY "Tenant isolation for befaq_results" ON public.befaq_results
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.befaq_exams e 
      WHERE e.id = befaq_results.exam_id 
      AND (e.institution_id = public.get_my_institution_id() OR public.is_super_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.befaq_exams e 
      WHERE e.id = befaq_results.exam_id 
      AND (e.institution_id = public.get_my_institution_id() OR public.is_super_admin())
    )
  );

-- 4. Reload config
NOTIFY pgrst, 'reload config';
