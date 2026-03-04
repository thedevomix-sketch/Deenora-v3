-- Add missing columns to befaq_exams table
ALTER TABLE public.befaq_exams ADD COLUMN IF NOT EXISTS exam_name TEXT;
ALTER TABLE public.befaq_exams ADD COLUMN IF NOT EXISTS marhala_id UUID REFERENCES public.classes(id);
ALTER TABLE public.befaq_exams ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Fix befaq_subjects table
ALTER TABLE public.befaq_subjects ADD COLUMN IF NOT EXISTS exam_id UUID REFERENCES public.befaq_exams(id) ON DELETE CASCADE;
ALTER TABLE public.befaq_subjects ADD COLUMN IF NOT EXISTS total_marks INTEGER DEFAULT 100;
ALTER TABLE public.befaq_subjects ADD COLUMN IF NOT EXISTS passing_marks INTEGER DEFAULT 33;

-- Fix befaq_results table
ALTER TABLE public.befaq_results ADD COLUMN IF NOT EXISTS marks_obtained NUMERIC DEFAULT 0;

-- Force schema cache reload
NOTIFY pgrst, 'reload config';
