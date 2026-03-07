-- Allow Super Admins to view ALL voice templates
DROP POLICY IF EXISTS "Super Admins can view all voice templates" ON voice_templates;
CREATE POLICY "Super Admins can view all voice templates" ON voice_templates
    FOR SELECT USING (
        public.is_super_admin()
    );

-- Allow Super Admins to update ALL voice templates (for approval/rejection)
DROP POLICY IF EXISTS "Super Admins can update all voice templates" ON voice_templates;
CREATE POLICY "Super Admins can update all voice templates" ON voice_templates
    FOR UPDATE USING (
        public.is_super_admin()
    );
