-- Allow Super Admins to view ALL voice templates
CREATE POLICY "Super Admins can view all voice templates" ON voice_templates
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM institutions i
            JOIN profiles p ON p.institution_id = i.id
            WHERE p.id = auth.uid() AND i.is_super_admin = true
        )
    );

-- Allow Super Admins to update ALL voice templates (for approval/rejection)
CREATE POLICY "Super Admins can update all voice templates" ON voice_templates
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM institutions i
            JOIN profiles p ON p.institution_id = i.id
            WHERE p.id = auth.uid() AND i.is_super_admin = true
        )
    );
