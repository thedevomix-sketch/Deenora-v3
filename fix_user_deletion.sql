-- Function to delete institution when user is deleted
CREATE OR REPLACE FUNCTION public.handle_user_deleted()
RETURNS TRIGGER AS $$
BEGIN
    -- Only delete institution if it's not a super_admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = OLD.id AND role = 'super_admin') THEN
        DELETE FROM public.institutions WHERE id = OLD.id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function after user deletion
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted AFTER DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_user_deleted();
