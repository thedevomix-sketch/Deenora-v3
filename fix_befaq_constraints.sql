-- Make class_name nullable in befaq_exams table as we use marhala_id now
ALTER TABLE public.befaq_exams ALTER COLUMN class_name DROP NOT NULL;

-- Force schema cache reload
NOTIFY pgrst, 'reload config';
