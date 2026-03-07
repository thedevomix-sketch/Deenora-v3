-- Add 'draft' status to voice_templates check constraints

ALTER TABLE voice_templates DROP CONSTRAINT IF EXISTS voice_templates_admin_status_check;
ALTER TABLE voice_templates ADD CONSTRAINT voice_templates_admin_status_check CHECK (admin_status IN ('draft', 'pending', 'approved', 'rejected'));

ALTER TABLE voice_templates DROP CONSTRAINT IF EXISTS voice_templates_provider_status_check;
ALTER TABLE voice_templates ADD CONSTRAINT voice_templates_provider_status_check CHECK (provider_status IN ('draft', 'pending', 'approved', 'rejected'));
