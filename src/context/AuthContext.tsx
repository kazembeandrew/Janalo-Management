import React, { createContext, useContext, useEffect, useState } from 'react';
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      const userProfile = data as UserProfile;

      if (userProfile && !userProfile.is_active) {
          await supabase.auth.signOut();
          setProfile(null);
          setUser(null);
          setSession(null);
          alert("Your account has been deactivated.");
      } else {
          setProfile(userProfile);
      }

    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

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
    <AuthContext.Provider value={{ 
        session, 
        user, 
        profile, 
        role: profile?.role ?? null, 
        effectiveRoles: getEffectiveRoles(),
        isLoading, 
        signOut 
    }}>
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