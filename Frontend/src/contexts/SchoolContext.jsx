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
  const { schoolInfo, role } = useAuth(); // Get school info and role from AuthContext
  const [schools, setSchools] = useState([]); // For super-admin to see all schools
  const [activeSchool, setActiveSchool] = useState(null);
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
        // Default active school to the first school in the list for super_admin
        if (role === 'super_admin' && data.length > 0 && !activeSchool) {
          setActiveSchool(data[0]);
        }
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
      const targetSchoolId = activeSchool?.id || schoolInfo?.id;
      if (!targetSchoolId) throw new Error('No school associated with user');

      const { data, error } = await supabase
        .from('schools')
        .update(updates)
        .eq('id', targetSchoolId)
        .select()
        .single();

      if (error) throw error;

      if (activeSchool?.id === targetSchoolId) {
        setActiveSchool(data);
      }
      return data;
    } catch (err) {
      console.error('Error updating school:', err);
      throw err;
    }
  };

  // Initialize
  useEffect(() => {
    if (role === 'super_admin') {
      fetchAllSchools();
    } else {
      if (schoolInfo) {
        setActiveSchool(schoolInfo);
      } else {
        setActiveSchool(null);
      }
      setLoading(false);
    }
  }, [schoolInfo, role]);

  return (
    <SchoolContext.Provider value={{
      school: activeSchool, // Current active school
      setSchool: setActiveSchool, // Switch active school
      schools, // All schools (for super-admin)
      loading,
      updateSchool
    }}>
      {children}
    </SchoolContext.Provider>
  );
};