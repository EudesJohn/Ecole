import { createContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [schoolInfo, setSchoolInfo] = useState(null); // New: school information

  const fetchProfile = async (userId, sessionUser, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, schools(id, nom, abreviation, ville, pays, logo_url)') // Join with schools table (left join)
        .eq('id', userId)
        .single();

      if (!error && data) {
        setRole(data.role);
        setUserProfile(data);

        // Set school info from joined data
        if (data.schools) {
          setSchoolInfo({
            id: data.schools.id,
            nom: data.schools.nom,
            abreviation: data.schools.abreviation,
            ville: data.schools.ville,
            pays: data.schools.pays,
            logo_url: data.schools.logo_url
          });
        }

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
        setStudentData(null);
        setUserProfile(null);
        setSchoolInfo(null); // Clear school info on logout
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

    // Extract abbreviation from matricule (format: 0001ABREVYY or 0001 ABREV YY)
    const abbrevMatch = cleanMatricule.match(/^0{0,4}\d{0,4}([a-z]{2,5})(\d{2})$/);
    if (!abbrevMatch) {
      throw new Error('Format de matricule invalide. Utilisez le format: 0001 ABREV 26');
    }

    const schoolAbbreviation = abbrevMatch[1].toUpperCase();
    const yearSuffix = abbrevMatch[2];

    // First, find the school by abbreviation
    const { data: schoolData, error: schoolError } = await supabase
      .from('schools')
      .select('id, nom, abreviation')
      .eq('abreviation', schoolAbbreviation)
      .eq('status', 'active')
      .single();

    if (schoolError || !schoolData) {
      throw new Error(`Aucune école trouvée avec l'abréviation "${schoolAbbreviation}". Vérifiez votre matricule.`);
    }

    // Construct email using school abbreviation (consistent with our system)
    const email = `${cleanMatricule}@${schoolAbbreviation.toLowerCase()}.bj`;

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
      setSchoolInfo(null); // Clear school info

      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error during logout:', err);
    }
  };

  return (
    <AuthContext.Provider value={{
      user, role, login, loginParent, logout, loading,
      studentData, setStudentData, userProfile,
      schoolInfo // Expose school info
    }}>
      {children}
    </AuthContext.Provider>
  );
};