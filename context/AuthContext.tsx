import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { UserProfile, UserRole } from '@/types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  effectiveRoles: UserRole[];
  isLoading: boolean;
  signOut: () => Promise<void>;
  shouldRedirectToLogin: boolean;
  profileFetchError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shouldRedirectToLogin, setShouldRedirectToLogin] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    (supabase as any).auth.getSession().then(({ data: { session } }: any) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    }).catch((error) => {
      console.error('Error getting initial session:', error);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = (supabase as any).auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle(); // Use maybeSingle instead of single to handle missing profiles gracefully

      if (error) {
        console.error('Error fetching user profile:', error);
        // If profile doesn't exist, sign out and redirect to login
        await (supabase as any).auth.signOut();
        setProfile(null);
        setUser(null);
        setSession(null);
        setIsLoading(false);
        return;
      }

      if (!data) {
        // User exists in auth but not in public.users table - needs profile creation
        console.warn('User profile not found for auth user:', userId);
        await (supabase as any).auth.signOut();
        setProfile(null);
        setUser(null);
        setSession(null);
        setIsLoading(false);
        return;
      }

      const userProfile = data as UserProfile;

      if (userProfile && !userProfile.is_active) {
        await (supabase as any).auth.signOut();
        setProfile(null);
        setUser(null);
        setSession(null);
        // Show deactivation message on next render
        localStorage.setItem('account_deactivated', 'true');
        setShouldRedirectToLogin(true);
      } else {
        setProfile(userProfile);
      }

      setIsLoading(false);

    } catch (error) {
      console.error('Error in fetchProfile:', error);
      // Don't sign out user on profile fetch error, just set loading to false
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    await (supabase as any).auth.signOut();
    setProfile(null);
  };

  // Expose fetch error to components
  const profileFetchError = fetchError;

  // Calculate effective roles based on primary role and active delegation
  const getEffectiveRoles = (): UserRole[] => {
    if (!profile) return [];
    const roles: UserRole[] = [profile.role];

    if (profile.delegated_role) {
      const now = new Date();
      const start = profile.delegation_start ? new Date(profile.delegation_start) : null;
      const end = profile.delegation_end ? new Date(profile.delegation_end) : null;

      const isStarted = !start || now >= start;
      const isNotEnded = !end || now <= end;

      if (isStarted && isNotEnded) {
        roles.push(profile.delegated_role);
      }
    }

    return Array.from(new Set(roles)); // Unique roles
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        role: profile?.role ?? null,
        effectiveRoles: getEffectiveRoles(),
        isLoading,
        signOut,
        shouldRedirectToLogin,
        profileFetchError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Wrapper component to handle redirect using React Router
export const AuthRedirectHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { shouldRedirectToLogin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (shouldRedirectToLogin) {
      navigate('/login', { replace: true });
    }
  }, [shouldRedirectToLogin, navigate]);

  return <>{children}</>;
};
