-- Make class_name nullable in befaq_subjects table
ALTER TABLE public.befaq_subjects ALTER COLUMN class_name DROP NOT NULL;

-- Force schema cache reload
NOTIFY pgrst, 'reload config';
