/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    // Initial check for session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id, session.user.email, session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id, session.user.email, session.user);
      } else {
        setUser(null);
        setRole(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId, userEmail, sessionUser) => {
    setLoading(true);
    try {
      // 1. Initial role from metadata (Fastest, works "d'un coup")
      let initialRole = sessionUser?.user_metadata?.role || null;

      // 2. Fetch from database (Authoritative but might be slow)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setRole(data.role);
        setUserProfile(data);
        if (data.role === 'parent') {
          const { data: stData } = await supabase.from('students').select('*, classes(nom, niveau)').eq('parent_id', userId).single();
          if (stData) {
            setStudentData({ ...stData, classe: stData.classes?.nom || 'Non assignée' });
          }
        }
      } else {
        // Fallback to metadata if DB profile is missing but we know the role from Auth
        if (initialRole) {
          setRole(initialRole);
        } else {
          setRole('parent');
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      // Ensure we don't stay in a loading loop or null role if user is authenticated
      if (!role) setRole('guest'); 
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data.user;
  };

  const loginParent = async (matricule, pin) => {
    if (!matricule || !pin) {
      throw new Error('Veuillez remplir les informations.');
    }

    const email = `${matricule.replace(/\s+/g, '').toLowerCase()}@slb.bj`;

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: pin,
    });

    if (authError) {
      throw new Error('Identifiants incorrects. Vérifiez le matricule et le PIN.');
    }

    return authData.user;
  };

  const logout = async () => {
    try {
      // Clear state IMMEDIATELY to prevent redirect loops in Login.jsx
      setUser(null);
      setRole(null);
      setStudentData(null);
      setUserProfile(null);
      
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error during logout:', err);
    }
  };

  return (
    <AuthContext.Provider value={{
      user, role, login, loginParent, logout, loading,
      studentData, setStudentData, userProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};
