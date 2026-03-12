import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get the current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (!session) setProfile(null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Auto-sync profile when user is logged in
  useEffect(() => {
    if (!session?.user) { setProfile(null); return; }
    const u = session.user;
    (async () => {
      try {
        // Look up profile by email
        const { data: existing } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', u.email)
          .maybeSingle();

        if (existing) {
          setProfile(existing);
        } else {
          // Auto-create profile for first-time login
          const { data: created } = await supabase
            .from('profiles')
            .insert({
              full_name: u.user_metadata?.full_name || u.email,
              email: u.email,
              role: 'admin',
              active: true,
            })
            .select()
            .single();
          setProfile(created);
        }
      } catch {
        // profiles table may not exist yet
      }
    })();
  }, [session]);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signInWithEmail = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email, password, fullName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Sign-out error:', error.message);
  };

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
