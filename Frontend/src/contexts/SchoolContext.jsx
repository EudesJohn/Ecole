import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../hooks/useAuth';

const SchoolContext = createContext();

export const useSchool = () => {
  const context = useContext(SchoolContext);
  if (!context) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
};

export const SchoolProvider = ({ children }) => {
  const { schoolInfo } = useAuth(); // Get school info from AuthContext
  const [schools, setSchools] = useState([]); // For super-admin to see all schools
  const [loading, setLoading] = useState(true);

  // Fetch all schools (only for super-admin)
  const fetchAllSchools = async () => {
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .order('nom');

      if (!error && data) {
        setSchools(data);
      }
    } catch (err) {
      console.error('Error fetching schools:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update school info (for admin to update their own school)
  const updateSchool = async (updates) => {
    try {
      const { schoolInfo: currentSchool } = useAuth();
      if (!currentSchool?.id) throw new Error('No school associated with user');

      const { data, error } = await supabase
        .from('schools')
        .update(updates)
        .eq('id', currentSchool.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error updating school:', err);
      throw err;
    }
  };

  // Initialize
  useEffect(() => {
    // If we have school info from auth, we're good
    // Fetch all schools only if user is super-admin (we'd need to check role)
    // For now, we'll fetch all schools in case we need it for super-admin view
    fetchAllSchools();
  }, [schoolInfo]);

  return (
    <SchoolContext.Provider value={{
      school: schoolInfo, // Current user's school
      schools, // All schools (for super-admin)
      loading,
      updateSchool
    }}>
      {children}
    </SchoolContext.Provider>
  );
};