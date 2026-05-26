import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';

export const useAdminData = () => {
  const { school } = useSchool();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    classes: [],
    matieres: [],
    students: [],
    teachers: [],
    absences: [],
    cahiers: [],
    grades: [],
    schoolConfig: { current_trimestre: '1', current_year: '2025-2026' }
  });

  const fetchData = useCallback(async () => {
    if (!school?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all([
        supabase.from('classes').select('*').eq('school_id', school.id).order('nom'),
        supabase.from('matieres').select('*, classes(nom)').eq('school_id', school.id).order('nom'),
        supabase.from('students').select('*, classes(nom)').eq('school_id', school.id).order('nom'),
        supabase.from('profiles').select('*').eq('role', 'teacher').eq('school_id', school.id).order('nom'),
        supabase.from('absences').select('*, students(nom, prenom, classes(nom)), matieres(nom)').eq('school_id', school.id).order('date', { ascending: false }),
        supabase.from('cahier_texte').select('*, profiles(nom, prenom), matieres(nom), classes(nom)').eq('school_id', school.id).order('date', { ascending: false }),
        supabase.from('school_config').select('*').eq('school_id', school.id),
        supabase.from('grades').select('*').eq('school_id', school.id)
      ]);

      // Check results for errors
      const failed = results.find(r => r.error);
      if (failed) throw failed.error;

      const [
        { data: classesData },
        { data: matieresData },
        { data: studentsData },
        { data: teachersData },
        { data: absencesData },
        { data: cahierData },
        { data: configData },
        { data: gradesData }
      ] = results;

      const configObj = (configData || []).reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});

      setData(prev => ({
        classes: classesData || [],
        matieres: (matieresData || []).map(m => ({ ...m, classe: m.classes?.nom })),
        students: (studentsData || []).map(s => ({ ...s, classe: s.classes?.nom })),
        teachers: teachersData || [],
        absences: absencesData || [],
        cahiers: cahierData || [],
        grades: gradesData || [],
        schoolConfig: { ...prev.schoolConfig, ...configObj }
      }));
    } catch (err) {
      console.error('Error fetching admin data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [school?.id]);

  useEffect(() => {
    fetchData();

    // Setup Real-time
    const channel = supabase.channel('admin_db_all_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matieres' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'absences' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cahier_texte' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  return { ...data, loading, error, refresh: fetchData };
};
