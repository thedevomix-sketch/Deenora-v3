
import { useState, useEffect } from 'react';
import { supabase } from 'lib/supabase';
import { OfflineService } from 'services/OfflineService';
import { Profile, Institution } from 'types';
import { isValidUUID } from '../utils/validation';

export const useAuth = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [madrasah, setMadrasah] = useState<Institution | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchUserProfile = async (userId: string, email?: string) => {
    if (!isValidUUID(userId)) {
      setLoading(false);
      return;
    }
    try {
      // First, get the profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (profileError) throw profileError;

      if (profileData) {
        // Force super_admin role for the designated email
        const userEmail = email?.trim().toLowerCase();
        const isSuperAdminEmail = userEmail === 'kmibrahim@gmail.com' || userEmail === 'thedevomix@gmail.com';
        const finalProfile = isSuperAdminEmail 
          ? { ...profileData, role: 'super_admin' as const } 
          : profileData;
          
        setProfile(finalProfile);
        
        // Then get the institution if institution_id exists and is valid
        if (isValidUUID(finalProfile.institution_id)) {
          const { data: institutionData, error: mError } = await supabase
            .from('institutions')
            .select('*')
            .eq('id', finalProfile.institution_id)
            .maybeSingle();

          if (mError) throw mError;
          
          setMadrasah(institutionData);
          if (institutionData) OfflineService.setCache('profile', institutionData);
        } else if (finalProfile.role === 'super_admin') {
          // Super admins might not have a institution_id
          setMadrasah(null);
        }
      } else {
        // If profile doesn't exist yet, it might be the trigger lagging or 
        // a manual auth user without SQL data.
        setAuthError("Profile not found in database. Please check if SQL triggers are running.");
      }
    } catch (err: any) {
      console.error("fetchUserProfile error:", err);
      setAuthError(err.message);
    }
  };

  const refreshMadrasah = async () => {
    if (session?.user?.id) {
      await fetchUserProfile(session.user.id, session.user.email);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('teacher_session');
    OfflineService.removeCache('profile');
    window.location.reload();
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Auth session error:", error);
          if (error.message.includes('Refresh Token') || error.message.includes('refresh_token_not_found')) {
            try {
              await supabase.auth.signOut();
            } catch (signOutErr) {
              console.error("Error during sign out:", signOutErr);
            }
            localStorage.removeItem('madrasah_auth_token');
            localStorage.removeItem('teacher_session');
            OfflineService.removeCache('profile');
            setSession(null);
            setProfile(null);
            setMadrasah(null);
          }
        }

        if (currentSession) {
          setSession(currentSession);
          await fetchUserProfile(currentSession.user.id, currentSession.user.email);
        } else {
          const teacherSession = localStorage.getItem('teacher_session');
          if (teacherSession) {
            const teacherData = JSON.parse(teacherSession);
            // Teachers usually have their madrasah data embedded or cached
            const mData = Array.isArray(teacherData.institutions) 
              ? teacherData.institutions[0] 
              : teacherData.institutions || Array.isArray(teacherData.madrasahs) ? teacherData.madrasahs[0] : teacherData.madrasahs;

            setMadrasah(mData);
            setProfile({
              id: teacherData.id,
              institution_id: teacherData.institution_id,
              full_name: teacherData.name,
              role: 'teacher',
              is_active: true,
              created_at: teacherData.created_at
            });
            setSession({ user: { id: teacherData.id } });
          }
        }
      } catch (err: any) {
        console.error("Auth initialization error:", err);
        if (err?.message?.includes('Refresh Token') || err?.message?.includes('refresh_token_not_found')) {
          localStorage.removeItem('madrasah_auth_token');
          localStorage.removeItem('teacher_session');
          OfflineService.removeCache('profile');
          setSession(null);
          setProfile(null);
          setMadrasah(null);
        }
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setSession(null); 
        setMadrasah(null); 
        setProfile(null);
        localStorage.removeItem('teacher_session');
      } else if (session) {
        setSession(session);
        fetchUserProfile(session.user.id, session.user.email);
      }
    });

    let channel: any;
    if (profile?.institution_id) {
      channel = supabase
        .channel('institution-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'institutions',
            filter: `id=eq.${profile.institution_id}`,
          },
          (payload) => {
            setMadrasah(payload.new as Institution);
          }
        )
        .subscribe();
    }

    return () => {
      subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [profile?.institution_id]);

  return { session, profile, madrasah, loading, authError, handleLogout, refreshMadrasah };
};
