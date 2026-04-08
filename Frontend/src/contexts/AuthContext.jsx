import { createContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  const fetchProfile = async (userId, sessionUser, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setRole(data.role);
        setUserProfile(data);
        if (data.role === 'parent') {
          const { data: children } = await supabase
            .from('students')
            .select('*, classes(nom, niveau, cycle)')
            .eq('parent_id', userId);

          if (children && children.length > 0) {
            const stData = children[0]; // Par défaut le premier enfant
            setStudentData({
              ...stData,
              classeNom: stData.classes?.nom || 'Non assignée',
              cycle: stData.classes?.cycle || 'primaire'
            });
          }
        }
      } else {
        // Fallback metadata
        const metadataRole = sessionUser?.user_metadata?.role || 'parent';
        setRole(metadataRole);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setRole('guest');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial check for session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchProfile(session.user.id, session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        const metadataRole = session.user.user_metadata?.role || 'parent';
        setRole(metadataRole);
        fetchProfile(session.user.id, session.user, true);
      } else {
        setUser(null);
        setRole(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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

    const cleanMatricule = matricule.toString().replace(/\s+/g, '').toLowerCase();
    const email = `${cleanMatricule}@slb.bj`;

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
