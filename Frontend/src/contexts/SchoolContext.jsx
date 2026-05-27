import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../hooks/useAuth';
import { getAccessToken } from '../utils/auth';

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
        // Do not set active school automatically for super_admin; let user choose
      }
    } catch (err) {
      console.error('Error fetching schools:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update school info (for admin to update their own school) — uses backend API (service role)
  const updateSchool = async (updates) => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Non connecté');

      const res = await fetch('/api/schools/my-school', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (activeSchool) {
        setActiveSchool(prev => ({ ...prev, ...updates }));
      }
      return data.school;
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