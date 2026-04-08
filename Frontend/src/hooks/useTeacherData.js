import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

export const useTeacherData = (userProfile) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    classes: [],
    matieres: [],
    students: [],
    schoolConfig: { current_trimestre: '1', current_year: '2025-2026' }
  });

  const loadBaseData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: classesData }, { data: matieresData }, { data: configData }] = await Promise.all([
        supabase.from('classes').select('*').order('nom'),
        supabase.from('matieres').select('*, classes(nom)').order('nom'),
        supabase.from('school_config').select('*')
      ]);

      const configObj = (configData || []).reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
      const allMatieres = (matieresData || []).map(m => ({ ...m, classe: m.classes?.nom }));

      let filteredClasses = classesData || [];
      let filteredMatieres = allMatieres;

      if (userProfile && userProfile.role === 'teacher') {
        if (Array.isArray(userProfile.classe_assignee) && userProfile.classe_assignee.length > 0) {
          filteredClasses = (classesData || []).filter(c => userProfile.classe_assignee.includes(c.nom));
        }
        if (Array.isArray(userProfile.matiere) && userProfile.matiere.length > 0) {
          // Double filter: name matches AND class matches teacher's assigned classes
          filteredMatieres = allMatieres.filter(m => 
            userProfile.matiere.includes(m.nom) && 
            userProfile.classe_assignee.includes(m.classe)
          );
        }
      }

      setData({
        classes: filteredClasses,
        matieres: filteredMatieres,
        students: [], // Loaded per class
        schoolConfig: { current_trimestre: configObj.current_trimestre || '1', current_year: configObj.current_year || '2025-2026' }
      });
    } catch (err) {
      console.error('Error loading teacher base data:', err);
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => {
    if (userProfile) loadBaseData();
  }, [userProfile, loadBaseData]);

  return { ...data, loading, refresh: loadBaseData };
};
