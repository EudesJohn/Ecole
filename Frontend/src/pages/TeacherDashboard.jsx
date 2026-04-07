import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/UI/Sidebar';
import { Button } from '../components/UI/Button';
import SkeletonLoader from '../components/UI/SkeletonLoader';
import { motion, AnimatePresence } from 'framer-motion';
import { downloadBulletin, generateQRDataUrl } from '../utils/bulletinTasks';
import GradeCalculator from '../utils/GradeCalculator';
import { supabase } from '../supabase';
import {
  BookOpen, Edit3, FileText, Users, Clock, Calendar, CheckCircle, XCircle,
  Plus, Save, AlertCircle, Check, Download, Award, Trash2
} from 'lucide-react';

const TeacherDashboard = () => {
  const { user, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'moy', direction: 'desc' });
  const [editCahierId, setEditCahierId] = useState(null);
  const [matiereStats, setMatiereStats] = useState([]);
  const [matiereSort, setMatiereSort] = useState({ key: 'avg', direction: 'desc' });
  const [schoolConfig, setSchoolConfig] = useState({ current_trimestre: '1', current_year: '2025-2026' });

  // Data
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [matieres, setMatieres] = useState([]);
  const [selectedMatiere, setSelectedMatiere] = useState('');

  // Notes: { [studentId]: { interro1, interro2, devoir, composition } }
  const [grades, setGrades] = useState({});

  // Cahier
  const [cahierForm, setCahierForm] = useState({ date: '', h_debut: '', h_fin: '', chapitre: '', resume: '' });
  const [cahierEntries, setCahierEntries] = useState([]);

  // Appel: { [studentId]: 'present' | 'absent' }
  const [attendance, setAttendance] = useState({});
  const [appelDate, setAppelDate] = useState(new Date().toISOString().split('T')[0]);

  // Bulletin
  const [generatingPdf, setGeneratingPdf] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch classes, subjects and school config
      const [{ data: classesData }, { data: matieresData }, { data: configData }] = await Promise.all([
        supabase.from('classes').select('*').order('nom'),
        supabase.from('matieres').select('*, classes(nom)').order('nom'),
        supabase.from('school_config').select('*')
      ]);

      if (configData) {
        const configObj = configData.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
        setSchoolConfig(prev => ({ ...prev, ...configObj }));
      }

      // Map matieres to include the class name string
      const allMatieres = (matieresData || []).map(m => ({ ...m, classe: m.classes?.nom }));

      // Filter by teacher's assigned classes/matieres if available
      let filteredClasses = classesData || [];
      let filteredMatieres = allMatieres;

      if (userProfile && userProfile.role === 'teacher') {
        if (Array.isArray(userProfile.classe_assignee) && userProfile.classe_assignee.length > 0) {
          filteredClasses = (classesData || []).filter(c => userProfile.classe_assignee.includes(c.nom));
        }
        if (Array.isArray(userProfile.matiere) && userProfile.matiere.length > 0) {
          filteredMatieres = allMatieres.filter(m => userProfile.matiere.includes(m.nom));
        }
      }

      setClasses(filteredClasses);
      setMatieres(filteredMatieres);

      // Auto-select first class and subject if available
      if (filteredClasses.length > 0 && !selectedClass) {
        setSelectedClass(filteredClasses[0].nom); // We'll let a separate effect load students when selectedClass changes
      }
      if (filteredMatieres.length > 0 && !selectedMatiere) {
        setSelectedMatiere(filteredMatieres[0].nom);
      }
    } catch (err) {
      console.error('Error loading teacher data:', err);
      showNotif('Erreur de chargement', 'error');
    }
    setLoading(false);
  }, [userProfile, selectedClass, selectedMatiere]);

  useEffect(() => {
    loadData();

    // REAL-TIME SUBSCRIPTIONS
    const channel = supabase
      .channel('teacher_db_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'grades' },
        (payload) => {
          // If the change is for a student in our current list, update local state
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const g = payload.new;
            setGrades(prev => ({
              ...prev,
              [g.student_id]: {
                interro1: g.interro1,
                interro2: g.interro2,
                interro3: g.interro3,
                devoir: g.devoir,
                composition: g.composition,
                id: g.id
              }
            }));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'absences' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const a = payload.new;
            if (a.date === appelDate) {
              setAttendance(prev => ({ ...prev, [a.student_id]: a.status }));
            }
          } else if (payload.eventType === 'DELETE') {
            setAttendance(prev => {
              const next = { ...prev };
              delete next[payload.old.student_id];
              return next;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cahier_texte' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            if (selectedClass) loadCahierEntries(selectedClass);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedClass, appelDate, loadData]);

  const loadStudentsByClass = useCallback(async (classeName) => {
    setSelectedClass(classeName);
    if (!classeName) { setStudents([]); return; }
    try {
      const cls = classes.find(c => c.nom === classeName);
      if (!cls) return;

      const { data: sts, error } = await supabase
        .from('students')
        .select('*')
        .eq('classe_id', cls.id)
        .order('nom');

      if (error) throw error;
      setStudents(sts || []);

      // Reset local state and default everyone to 'present'
      setGrades({});
      const initialAttendance = {};
      (sts || []).forEach(s => {
        initialAttendance[s.id] = 'present';
      });
      setAttendance(initialAttendance);
    } catch (err) {
      console.error('Error loading students:', err);
    }
  }, [classes]);

  const loadCahierEntries = useCallback(async (classeName) => {
    if (!classeName) { setCahierEntries([]); return; }
    try {
      const cls = classes.find(c => c.nom === classeName);
      if (!cls) return;

      const { data, error } = await supabase
        .from('cahier_texte')
        .select('*, matieres(nom)')
        .eq('classe_id', cls.id)
        .eq('school_year', schoolConfig.current_year)
        .order('date', { ascending: false })
        .limit(20);

      if (error) throw error;
      setCahierEntries(data.map(d => ({ ...d, matiere: d.matieres?.nom })) || []);
    } catch (err) {
      console.error('Error loading cahier:', err);
    }
  }, [classes]);

  useEffect(() => {
    if (selectedClass) {
      loadStudentsByClass(selectedClass);
      loadCahierEntries(selectedClass);
    }
  }, [selectedClass, loadStudentsByClass, loadCahierEntries]);

  // Fetch existing grades when class and subject are selected
  useEffect(() => {
    if (selectedClass && ['notes', 'moyennes'].includes(activeTab)) {
      const fetchData = async () => {
        const cls = classes.find(c => c.nom === selectedClass);
        if (!cls) return;

        // If 'notes', fetch only selected matiere. If 'moyennes', fetch all teacher's matieres for this class.
        const teacherMatieresForClass = matieres.filter(m => m.classe_id === cls.id);
        const matSelectionnee = teacherMatieresForClass.find(m => m.nom === selectedMatiere);
        
        let query = supabase.from('grades').select('*');
        
        if (activeTab === 'notes' && matSelectionnee) {
            query = query
              .eq('matiere_id', matSelectionnee.id)
              .eq('trimestre', parseInt(schoolConfig.current_trimestre))
              .eq('school_year', schoolConfig.current_year);
        } else {
            query = query
              .in('matiere_id', teacherMatieresForClass.map(m => m.id))
              .eq('trimestre', parseInt(schoolConfig.current_trimestre))
              .eq('school_year', schoolConfig.current_year);
        }

        const { data, error } = await query;

        if (!error && data) {
          const gradesMap = {};
          // Map counts IDs by matiere if we have multiples
          const statsByMatiere = {};

          data.forEach(g => {
            // Main gradesMap remains for the selected visual context
            if (activeTab === 'notes' || (activeTab === 'moyennes' && matSelectionnee && g.matiere_id === matSelectionnee.id)) {
              gradesMap[g.student_id] = {
                interro1: g.interro1,
                interro2: g.interro2,
                interro3: g.interro3,
                devoir: g.devoir,
                composition: g.composition,
                comp1: g.comp1,
                comp2: g.comp2,
                comp3: g.comp3,
                comp4: g.comp4,
                comp5: g.comp5,
                comp6: g.comp6,
                dw: g.dw,
                d1: g.d1,
                d2: g.d2,
                id: g.id
              };
            }

            // Global stats per matiere
            if (!statsByMatiere[g.matiere_id]) statsByMatiere[g.matiere_id] = [];
            const cls = classes.find(c => c.id === g.classes?.id); // Should be checked if possible
            const isPrimary = (cls?.cycle === 'primaire' || cls?.cycle === 'maternelle');

            const studentAvg = isPrimary 
              ? GradeCalculator.calculateSubjectAverage(g.interro1, g.interro2, g.interro3, g.devoir, g.composition)
              : GradeCalculator.calculateSubjectAverage(g.interro1, g.interro2, g.interro3, g.dw, g.d1, g.d2);

            statsByMatiere[g.matiere_id].push(studentAvg);
          });

          setGrades(gradesMap);

          // Build matiere overview
          const summary = teacherMatieresForClass.map(m => {
            const classAverages = statsByMatiere[m.id] || [];
            const classAvg = classAverages.length > 0 
              ? classAverages.reduce((a, b) => a + b, 0) / classAverages.length
              : 0;
            return {
              id: m.id,
              nom: m.nom,
              avg: Math.round(classAvg * 100) / 100,
              effectif: classAverages.length,
              coeff: m.coefficient || 1
            };
          });
          setMatiereStats(summary);
        }
      };
      fetchData();
    }
  }, [selectedClass, selectedMatiere, activeTab, classes, matieres]);

  // Fetch existing attendance when class and date are selected
  useEffect(() => {
    if (selectedClass && appelDate && activeTab === 'appel') {
      const fetchAttendance = async () => {
        const cls = classes.find(c => c.nom === selectedClass);
        if (!cls) return;

        const { data, error } = await supabase
          .from('absences')
          .select('*')
          .eq('classe_id', cls.id)
          .eq('matiere_id', matieres.find(m => m.nom === selectedMatiere && m.classe_id === cls.id)?.id)
          .eq('date', appelDate);

        if (!error && data) {
          const attMap = {};
          data.forEach(a => { attMap[a.student_id] = a.status; });
          setAttendance(attMap);
        }
      };
      fetchAttendance();
    }
  }, [selectedClass, selectedMatiere, appelDate, activeTab, classes, matieres]);

  const showNotif = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSaveGrades = async () => {
    if (!selectedClass || !selectedMatiere) { showNotif('Sélectionnez une classe et une matière', 'error'); return; }
    setSaving(true);
    try {
      const cls = classes.find(c => c.nom === selectedClass);
      const mat = matieres.find(m => m.nom === selectedMatiere && m.classe_id === cls?.id);
      if (!cls || !mat) throw new Error('Classe ou matière introuvable');

      const upserts = Object.keys(grades).map(studentId => {
        const sGrades = grades[studentId];
        return {
          student_id: studentId,
          matiere_id: mat.id,
          interro1: (sGrades.interro1 !== '' && sGrades.interro1 !== undefined) ? parseFloat(sGrades.interro1) : null,
          interro2: (sGrades.interro2 !== '' && sGrades.interro2 !== undefined) ? parseFloat(sGrades.interro2) : null,
          interro3: (sGrades.interro3 !== '' && sGrades.interro3 !== undefined) ? parseFloat(sGrades.interro3) : null,
          devoir: (sGrades.devoir !== '' && sGrades.devoir !== undefined) ? parseFloat(sGrades.devoir) : null,
          composition: (sGrades.composition !== '' && sGrades.composition !== undefined) ? parseFloat(sGrades.composition) : null,
          comp1: (sGrades.comp1 !== '' && sGrades.comp1 !== undefined) ? parseFloat(sGrades.comp1) : null,
          comp2: (sGrades.comp2 !== '' && sGrades.comp2 !== undefined) ? parseFloat(sGrades.comp2) : null,
          comp3: (sGrades.comp3 !== '' && sGrades.comp3 !== undefined) ? parseFloat(sGrades.comp3) : null,
          comp4: (sGrades.comp4 !== '' && sGrades.comp4 !== undefined) ? parseFloat(sGrades.comp4) : null,
          comp5: (sGrades.comp5 !== '' && sGrades.comp5 !== undefined) ? parseFloat(sGrades.comp5) : null,
          comp6: (sGrades.comp6 !== '' && sGrades.comp6 !== undefined) ? parseFloat(sGrades.comp6) : null,
          dw: (sGrades.dw !== '' && sGrades.dw !== undefined) ? parseFloat(sGrades.dw) : null,
          d1: (sGrades.d1 !== '' && sGrades.d1 !== undefined) ? parseFloat(sGrades.d1) : null,
          d2: (sGrades.d2 !== '' && sGrades.d2 !== undefined) ? parseFloat(sGrades.d2) : null,
          trimestre: parseInt(schoolConfig.current_trimestre),
          school_year: schoolConfig.current_year
        };
      });

      // Supabase supports upsert by natural key or ID
      // Here we filter and upsert. For simplicity, we delete existing and re-insert or use upsert if we have IDs.
      const { error } = await supabase.from('grades').upsert(upserts, { onConflict: 'student_id,matiere_id,trimestre,school_year' });

      if (error) throw error;
      showNotif(`Notes enregistrées avec succès ✅`);
    } catch (err) {
      console.error('Error saving grades:', err);
      showNotif(err.message, 'error');
    }
    setSaving(false);
  };

  const handleSaveCahier = async () => {
    if (!selectedClass || !cahierForm.chapitre) { showNotif('Remplissez la classe et le chapitre', 'error'); return; }
    if (!selectedMatiere) { showNotif('Veuillez sélectionner une matière', 'error'); return; }
    if (!cahierForm.h_debut || !cahierForm.h_fin) { showNotif('Veuillez remplir l\'heure de début et l\'heure de fin', 'error'); return; }
    setSaving(true);
    try {
      const cls = classes.find(c => c.nom === selectedClass);
      const mat = matieres.find(m => m.nom === selectedMatiere && m.classe_id === cls?.id);
      
      if (!mat) throw new Error("Matière introuvable pour cette classe.");

      const payload = {
        teacher_id: user?.id,
        classe_id: cls?.id,
        matiere_id: mat?.id,
        date: cahierForm.date || new Date().toISOString().split('T')[0],
        heure: `${cahierForm.h_debut} - ${cahierForm.h_fin}`,
        chapitre: cahierForm.chapitre,
        resume: cahierForm.resume,
        school_year: schoolConfig.current_year
      };

      if (editCahierId) {
        const { error } = await supabase.from('cahier_texte').update(payload).eq('id', editCahierId);
        if (error) throw error;
        showNotif('Cahier de texte mis à jour ✅');
      } else {
        const { error } = await supabase.from('cahier_texte').insert([payload]);
        if (error) throw error;
        showNotif('Cahier de texte enregistré ✅');
      }

      setCahierForm({ date: '', h_debut: '', h_fin: '', chapitre: '', resume: '' });
      setEditCahierId(null);
      loadCahierEntries(selectedClass);
    } catch (err) {
      console.error('Cahier Save Error:', err);
      showNotif(err.message, 'error');
    }
    setSaving(false);
  };

  const handleEditCahier = (entry) => {
    const created = new Date(entry.created_at);
    const now = new Date();
    const diff = (now - created) / (1000 * 60 * 60);
    if (diff > 24) { showNotif("Délai de 24h dépassé. Modification impossible.", "error"); return; }

    // Utilisation d'une regex pour ne capturer que les heures complètes (HH:mm)
    const hours = (entry.heure || '').match(/\b\d{1,2}:\d{2}\b/g) || [];
    const h_debut = hours[0] || entry.heure || '';
    const h_fin = hours[1] || '';

    setCahierForm({ date: entry.date, h_debut: h_debut, h_fin: h_fin, chapitre: entry.chapitre, resume: entry.resume });
    setEditCahierId(entry.id);
  };

  const handleDeleteCahier = async (id, createdAt) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diff = (now - created) / (1000 * 60 * 60);
    if (diff > 24) { showNotif("Délai de 24h dépassé. Suppression impossible.", "error"); return; }

    if (!window.confirm("Voulez-vous vraiment supprimer cette entrée ?")) return;

    try {
      const { error } = await supabase.from('cahier_texte').delete().eq('id', id);
      if (error) throw error;
      showNotif('Entrée supprimée ✅');
      loadCahierEntries(selectedClass);
    } catch (err) {
      showNotif(err.message, 'error');
    }
  };

  const handleSaveAppel = async () => {
    if (!selectedClass) { showNotif('Sélectionnez une classe', 'error'); return; }
    if (!selectedMatiere) { showNotif('Sélectionnez une matière pour l\'appel', 'error'); return; }
    setSaving(true);
    try {
      const cls = classes.find(c => c.nom === selectedClass);
      const { data: matData } = await supabase.from('matieres').select('id').eq('nom', selectedMatiere).eq('classe_id', cls?.id).single();
      
      if (!matData) throw new Error("Impossible de trouver cette matière pour cette classe.");
      
      const upserts = Object.keys(attendance).map(studentId => ({
        student_id: studentId,
        classe_id: cls.id,
        matiere_id: matData?.id,
        teacher_id: user?.id,
        date: appelDate,
        heure: cahierForm.h_debut || "08:00",
        status: attendance[studentId],
        school_year: schoolConfig.current_year
      }));

      const { error } = await supabase.from('absences').upsert(upserts, { onConflict: 'student_id,date,matiere_id,school_year' });
      if (error) throw error;

      showNotif('Appel enregistré avec succès ✅');
    } catch (err) {
      showNotif(err.message, 'error');
    }
    setSaving(false);
  };

  const handleGenerateBulletin = async (student) => {
    setGeneratingPdf(student.id);
    try {
      const cls = classes.find(c => c.nom === selectedClass);
      if (!cls) throw new Error('Classe introuvable');

      // 1. Securely fetch Class Stats without Data Leak
      const { data: classStatsData, error: rpcError } = await supabase.rpc('get_class_stats_for_bulletin', {
        p_student_id: student.id,
        p_trimestre: parseInt(schoolConfig.current_trimestre)
      });

      if (rpcError) throw rpcError;

      let classStats = { effectif: 0, plusForte: null, plusFaible: null, studentAverage: 0, rang: null };
      if (classStatsData) {
        classStats = {
          effectif: classStatsData.effectif || 0,
          plusForte: classStatsData.plus_forte || null,
          plusFaible: classStatsData.plus_faible || null,
          studentAverage: classStatsData.studentAverage || 0,
          rang: classStatsData.rang || null
        };
      }

      // 2. Fetch specific grades for target student
      const { data: studentGrades, error: gradesError } = await supabase
        .from('grades')
        .select('*, matieres(nom, coefficient)')
        .eq('student_id', student.id)
        .eq('trimestre', parseInt(schoolConfig.current_trimestre));

      if (gradesError) throw gradesError;

      // 3. Prepare data for the target student
      const targetGrades = (studentGrades || []).map(g => ({
        matiere: g.matieres?.nom,
        coefficient: g.matieres?.coefficient,
        interro1: g.interro1,
        interro2: g.interro2,
        interro3: g.interro3,
        devoir: g.devoir,
        composition: g.composition
      }));

      if (targetGrades.length === 0) {
        throw new Error("Cet élève n'a aucune note.");
      }


      const qrUrl = await generateQRDataUrl(`https://saintlambert.bj/verify/${student.matricule}`);

      await downloadBulletin({
        student: { 
          ...student, 
          dateNaissance: student.date_naissance, 
          classe: selectedClass 
        },
        gradesBySubject: targetGrades,
        matieres,
        classStats: {
          ...classStats,
          plusForte: classStats.plusForte,
          plusFaible: classStats.plusFaible
        },
        qrCodeDataUrl: qrUrl,
        trimestre: `${schoolConfig.current_trimestre}${schoolConfig.current_trimestre === '1' ? 'er' : 'ème'}`
      });
      showNotif('Bulletin généré avec succès ! ✅');
    } catch (err) {
      console.error('PDF Error:', err);
      showNotif(err.message || 'Erreur lors de la génération du PDF', 'error');
    }
    setGeneratingPdf(null);
  };

  const updateGrade = (studentId, field, value) => {
    setGrades(prev => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }));
  };

  const renderOverview = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="glass-card p-6 bg-gradient-to-br from-primary-50 to-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-600">
              <Users size={24} />
            </div>
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Total Élèves</p>
              <h3 className="text-2xl font-display font-bold text-gray-900">{students.length}</h3>
            </div>
          </div>
        </div>
        <div className="glass-card p-6 bg-gradient-to-br from-emerald-50 to-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <BookOpen size={24} />
            </div>
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Matières</p>
              <h3 className="text-2xl font-display font-bold text-gray-900">{matieres.length}</h3>
            </div>
          </div>
        </div>
        {/* Ajouter d'autres stats si nécessaire */}
      </div>
    );
  };

  const renderGrades = () => {
    if (!selectedClass || !selectedMatiere) {
      return (
        <div className="glass-card p-12 text-center text-gray-400">
          <AlertCircle size={48} className="mx-auto mb-4 opacity-20" />
          <p>Veuillez sélectionner une classe et une matière pour saisir les notes.</p>
        </div>
      );
    }

    const cls = classes.find(c => c.nom === selectedClass);
    const isPrimary = cls?.cycle === 'primaire' || cls?.cycle === 'maternelle';

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-display font-bold text-gray-900 flex items-center gap-2">
            <Edit3 size={20} className="text-primary-500" /> Saisie des notes : {selectedMatiere} ({selectedClass})
          </h3>
          <Button variant="primary" icon={Save} onClick={handleSaveGrades} loading={saving}>Enregistrer tout</Button>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 italic">
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-400 uppercase">Élève</th>
                  <th className="px-2 py-3 text-center text-[10px] font-bold text-gray-400 uppercase">I 1</th>
                  <th className="px-2 py-3 text-center text-[10px] font-bold text-gray-400 uppercase">I 2</th>
                  <th className="px-2 py-3 text-center text-[10px] font-bold text-gray-400 uppercase">I 3</th>
                  {!isPrimary ? (
                    <>
                      <th className="px-2 py-3 text-center text-[10px] font-bold text-primary-500 uppercase">DW</th>
                      <th className="px-2 py-3 text-center text-[10px] font-bold text-gold-600 uppercase">D 1</th>
                      <th className="px-2 py-3 text-center text-[10px] font-bold text-gold-600 uppercase">D 2</th>
                    </>
                  ) : (
                    <>
                      <th className="px-2 py-3 text-center text-[10px] font-bold text-primary-500 uppercase">Devoir</th>
                      <th className="px-2 py-3 text-center text-[10px] font-bold text-gold-600 uppercase">Compo</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-500 uppercase">Moyenne</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {students.map(s => {
                  const sg = grades[s.id] || {};
                  const moy = isPrimary 
                    ? GradeCalculator.calculateSubjectAverage(sg.interro1, sg.interro2, sg.interro3, sg.devoir, sg.composition)
                    : GradeCalculator.calculateSubjectAverage(sg.interro1, sg.interro2, sg.interro3, sg.dw, sg.d1, sg.d2);

                  return (
                    <tr key={s.id} className="hover:bg-gray-50/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-gray-800">{s.prenom} {s.nom}</p>
                        <p className="text-[10px] text-gray-400 uppercase">{s.matricule}</p>
                      </td>
                      {['interro1', 'interro2', 'interro3'].map(f => (
                        <td key={f} className="px-1 py-2 text-center">
                          <input type="number" step="0.25" min="0" max="20"
                            value={sg[f] ?? ''}
                            onChange={(e) => updateGrade(s.id, f, e.target.value)}
                            className="w-12 h-9 text-center text-sm rounded-lg border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20" />
                        </td>
                      ))}
                      {!isPrimary ? (
                        <>
                          <td className="px-1 py-2 text-center">
                            <input type="number" step="0.25" min="0" max="20"
                              value={sg.dw ?? ''}
                              onChange={(e) => updateGrade(s.id, 'dw', e.target.value)}
                              className="w-12 h-9 text-center text-sm rounded-lg border border-primary-200 focus:border-primary-500 bg-primary-50/30" />
                          </td>
                          <td className="px-1 py-2 text-center">
                            <input type="number" step="0.25" min="0" max="20"
                              value={sg.d1 ?? ''}
                              onChange={(e) => updateGrade(s.id, 'd1', e.target.value)}
                              className="w-12 h-9 text-center text-sm rounded-lg border border-gold-200 focus:border-gold-500 bg-gold-50/30 font-bold" />
                          </td>
                          <td className="px-1 py-2 text-center">
                            <input type="number" step="0.25" min="0" max="20"
                              value={sg.d2 ?? ''}
                              onChange={(e) => updateGrade(s.id, 'd2', e.target.value)}
                              className="w-12 h-9 text-center text-sm rounded-lg border border-gold-200 focus:border-gold-500 bg-gold-50/30 font-bold" />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-1 py-2 text-center">
                            <input type="number" step="0.25" min="0" max="20"
                              value={sg.devoir ?? ''}
                              onChange={(e) => updateGrade(s.id, 'devoir', e.target.value)}
                              className="w-12 h-9 text-center text-sm rounded-lg border border-primary-200" />
                          </td>
                          <td className="px-1 py-2 text-center">
                            <input type="number" step="0.25" min="0" max="20"
                              value={sg.composition ?? ''}
                              onChange={(e) => updateGrade(s.id, 'composition', e.target.value)}
                              className="w-12 h-9 text-center text-sm rounded-lg border border-gold-200 font-bold" />
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-bold ${moy < 10 ? 'text-red-500' : 'text-primary-600'}`}>
                          {moy.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role="teacher" activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 p-6 md:p-8 pt-20 md:pt-8"><SkeletonLoader type="card" count={3} /></div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role="teacher" activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 min-w-0 overflow-auto pt-16 md:pt-0">
        {/* Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className={`fixed top-4 right-4 z-[80] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white ${notification.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'
                }`}>
              {notification.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
              <span className="text-sm font-medium">{notification.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="p-6 md:p-8 pb-4">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-gray-900">Espace Professeur</h1>
          <p className="text-gray-400 text-sm mt-1">Gérez vos cours, notes et bulletins</p>
        </div>

        {/* Class/Matière selector */}
        <div className="px-6 md:px-8 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <select value={selectedClass}
              onChange={(e) => { loadStudentsByClass(e.target.value); loadCahierEntries(e.target.value); }}
              className="input-slb max-w-xs">
              <option value="">Sélectionner une classe</option>
              {classes.map(c => <option key={c.id} value={c.nom}>{c.nom}</option>)}
            </select>
            {['notes', 'cahier'].includes(activeTab) && (
              <select value={selectedMatiere} onChange={(e) => setSelectedMatiere(e.target.value)} className="input-slb max-w-xs">
                <option value="">Sélectionner une matière</option>
                {matieres
                  .filter(m => !selectedClass || m.classe === selectedClass)
                  .map(m => <option key={m.id} value={m.nom}>{m.nom} (Coeff. {m.coefficient || 1})</option>)
                }
              </select>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 md:px-8 pb-8">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

              {/* APERCU & CLASSES */}
              {activeTab === 'overview' && renderOverview()}

              {/* SAISIE NOTES */}
              {activeTab === 'notes' && renderGrades()}

              {/* CAHIER DE TEXTE */}
              {activeTab === 'cahier' && (
                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="glass-card p-6">
                    <h3 className="text-lg font-display font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Plus size={20} className="text-primary-500" /> Nouveau contenu
                    </h3>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
                          <input type="date" value={cahierForm.date} onChange={(e) => setCahierForm({ ...cahierForm, date: e.target.value })} className="input-slb text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Début</label>
                            <input type="time" value={cahierForm.h_debut} onChange={(e) => setCahierForm({ ...cahierForm, h_debut: e.target.value })} className="input-slb text-sm" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Fin</label>
                            <input type="time" value={cahierForm.h_fin} onChange={(e) => setCahierForm({ ...cahierForm, h_fin: e.target.value })} className="input-slb text-sm" />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Chapitre</label>
                        <input type="text" value={cahierForm.chapitre} onChange={(e) => setCahierForm({ ...cahierForm, chapitre: e.target.value })}
                          className="input-slb" placeholder="Ex: Les équations du premier degré" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Résumé</label>
                        <textarea value={cahierForm.resume} onChange={(e) => setCahierForm({ ...cahierForm, resume: e.target.value })}
                          className="input-slb min-h-[100px] resize-none" placeholder="Résumé des points abordés..." />
                      </div>
                      <Button variant="primary" icon={Save} onClick={handleSaveCahier} loading={saving} className="w-full">
                        {editCahierId ? 'Mettre à jour' : 'Enregistrer'}
                      </Button>
                    </div>
                  </div>
                  <div className="glass-card p-6">
                    <h3 className="text-lg font-display font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Clock size={20} className="text-gold-500" /> Historique
                    </h3>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {cahierEntries.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <Clock size={32} className="mb-2 opacity-20" />
                            <p className="text-sm italic">Aucun chapitre enregistré pour cette classe.</p>
                          </div>
                        ) : (
                          cahierEntries.map((entry) => {
                            const created = new Date(entry.created_at);
                            const now = new Date();
                            const canEdit = ((now - created) / (1000 * 60 * 60)) <= 24;

                            return (
                              <div key={entry.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                    <Calendar size={12} /> {entry.date} à {entry.heure}
                                    {entry.matiere && <span className="bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full text-[10px]">{entry.matiere}</span>}
                                  </div>
                                  <p className="text-sm font-semibold text-gray-800">{entry.chapitre}</p>
                                  {entry.resume && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{entry.resume}</p>}
                                </div>
                                {canEdit && (
                                  <div className="flex gap-2 ml-2">
                                    <button onClick={() => handleEditCahier(entry)} className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors">
                                      <Edit3 size={16} />
                                    </button>
                                    <button onClick={() => handleDeleteCahier(entry.id, entry.created_at)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                    </div>
                  </div>
                </div>
              )}

              {/* MOYENNES & RÉCAPITULATIF */}
              {activeTab === 'moyennes' && (
                <div className="space-y-6">
                  {/* Vue d'ensemble par MATIERE */}
                  <div className="glass-card">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                      <h3 className="font-display font-bold text-gray-900 flex items-center gap-2">
                         <BookOpen size={18} className="text-primary-500" /> Performance par Matière
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                                onClick={() => setMatiereSort({ key: 'nom', direction: matiereSort.key === 'nom' && matiereSort.direction === 'asc' ? 'desc' : 'asc' })}>
                              Matière {matiereSort.key === 'nom' && (matiereSort.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                                onClick={() => setMatiereSort({ key: 'avg', direction: matiereSort.key === 'avg' && matiereSort.direction === 'asc' ? 'desc' : 'asc' })}>
                              Moyenne Classe {matiereSort.key === 'avg' && (matiereSort.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase">Saisies</th>
                            <th className="px-4 py-3 text-right"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {[...matiereStats].sort((a,b) => {
                            if (matiereSort.key === 'nom') {
                              return matiereSort.direction === 'asc' ? a.nom.localeCompare(b.nom) : b.nom.localeCompare(a.nom);
                            }
                            return matiereSort.direction === 'asc' ? a.avg - b.avg : b.avg - a.avg;
                          }).map(ms => (
                            <tr key={ms.id} className={`hover:bg-primary-50/30 transition-colors ${selectedMatiere === ms.nom ? 'bg-primary-50/50' : ''}`}>
                              <td className="px-4 py-3 text-sm font-medium text-gray-800">{ms.nom}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`font-bold ${ms.avg < 10 ? 'text-red-500' : 'text-primary-600'}`}>{ms.avg.toFixed(2)}</span>
                              </td>
                              <td className="px-4 py-3 text-center text-xs text-gray-500">{ms.effectif} élèves</td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => setSelectedMatiere(ms.nom)}
                                  className="text-[10px] uppercase font-bold text-primary-600 hover:underline"
                                >
                                  Voir détails
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="glass-card overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                      <h3 className="font-display font-bold text-gray-900 flex items-center gap-2">
                         <Award size={18} className="text-gold-500" /> Détails élèves : {selectedMatiere}
                      </h3>
                      <div className="text-xs text-gray-500 italic">
                        Formule : ((I1+I2+I3)/n + D + 2*C) / 4
                      </div>
                    </div>
                    <div className="overflow-x-auto">

                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th 
                            className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => setSortConfig({ key: 'nom', direction: sortConfig.key === 'nom' && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                          >
                            Élève {sortConfig.key === 'nom' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-2 py-3 text-center text-[10px] font-semibold text-gray-400 uppercase">Notes</th>
                          <th 
                            className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => setSortConfig({ key: 'moy', direction: sortConfig.key === 'moy' && sortConfig.direction === 'desc' ? 'asc' : 'desc' })}
                          >
                            Moyenne {sortConfig.key === 'moy' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </th>
                          <th 
                            className="px-4 py-3 text-center text-[11px] font-semibold text-gold-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => setSortConfig({ key: 'points', direction: sortConfig.key === 'points' && sortConfig.direction === 'desc' ? 'asc' : 'desc' })}
                          >
                            Points coef. {sortConfig.key === 'points' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {(() => {
                          const studentsWithMoy = students.map(s => {
                            const sg = grades[s.id] || {};
                            const cls = classes.find(c => c.nom === selectedClass);
                            const isPrimary = cls?.cycle === 'primaire' || cls?.cycle === 'maternelle';
                            const matSelectionnee = matieres.find(m => m.nom === selectedMatiere && m.classe_id === cls?.id);
                            const coeff = matSelectionnee?.coefficient || 1;
                            
                            const moy = isPrimary 
                              ? GradeCalculator.calculateSubjectAverage(sg.interro1, sg.interro2, sg.interro3, sg.devoir, sg.composition)
                              : GradeCalculator.calculateSubjectAverage(sg.interro1, sg.interro2, sg.interro3, sg.dw, sg.d1, sg.d2);
                              
                            return { ...s, moy, points: moy * coeff, coeff };
                          });

                          const sorted = [...studentsWithMoy].sort((a, b) => {
                            if (sortConfig.key === 'nom') {
                              return sortConfig.direction === 'asc' 
                                ? a.nom.localeCompare(b.nom) 
                                : b.nom.localeCompare(a.nom);
                            }
                            return sortConfig.direction === 'asc' ? a[sortConfig.key] - b[sortConfig.key] : b[sortConfig.key] - a[sortConfig.key];
                          });

                          return sorted.map((s) => (
                            <tr key={s.id} className="hover:bg-gray-50/30 transition-colors">
                              <td className="px-4 py-3">
                                <p className="text-sm font-medium text-gray-800">{s.prenom} {s.nom}</p>
                                <p className="text-[10px] text-gray-400 uppercase">{s.matricule}</p>
                              </td>
                              <td className="px-2 py-3 text-center">
                                <div className="flex justify-center gap-1">
                                  {/* Affichage des notes individuelles */}
                                  <span className="text-[10px] text-gray-400">{grades[s.id]?.interro1 || '-'} | {grades[s.id]?.interro2 || '-'} | {grades[s.id]?.interro3 || '-'} | {grades[s.id]?.devoir || '-'} | {grades[s.id]?.composition || '-'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-primary-600">
                                {s.moy.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-gold-600">
                                {s.points.toFixed(2)}
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

              {/* APPEL */}
              {activeTab === 'appel' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <input type="date" value={appelDate} onChange={(e) => setAppelDate(e.target.value)} className="input-slb max-w-[200px]" />
                    <input type="time" value={cahierForm.heure || "08:00"} onChange={(e) => setCahierForm({...cahierForm, heure: e.target.value})} className="input-slb max-w-[120px]" />
                    {selectedClass && (
                      <div className="text-sm text-gray-500">
                        <span className="text-emerald-600 font-semibold">{students.filter(s => attendance[s.id] === 'present').length}</span> présents / {students.length}
                      </div>
                    )}
                  </div>
                  {!selectedClass ? (
                    <div className="glass-card p-8 text-center text-gray-400">
                      <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>S&eacute;lectionnez une classe pour faire l&apos;appel</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {students.map((s, i) => (
                          <motion.div key={s.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.03 }}
                            onClick={() => setAttendance(prev => ({ ...prev, [s.id]: prev[s.id] === 'present' ? 'absent' : 'present' }))}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${attendance[s.id] === 'present' ? 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100' : 'border-red-300 bg-red-50 hover:bg-red-100'
                               }`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-800 text-sm">{s.prenom} {s.nom}</p>
                                <p className="text-xs text-gray-400 font-mono">{s.matricule}</p>
                              </div>
                              {attendance[s.id] === 'present' ? <CheckCircle className="w-6 h-6 text-emerald-500" /> : <XCircle className="w-6 h-6 text-red-500" />}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                      {students.length > 0 && (
                        <div className="flex justify-end">
                          <Button variant="primary" icon={Check} onClick={handleSaveAppel} loading={saving} size="lg">Valider l&apos;appel</Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* BULLETINS (per student) */}
              {activeTab === 'bulletins' && (
                <div className="glass-card p-6">
                  <h3 className="text-lg font-display font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText size={20} className="text-primary-500" /> Générer un bulletin
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">Sélectionnez une classe puis cliquez sur le bulletin à télécharger.</p>
                  <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
                    {students.length === 0 ? (
                      <p className="text-center py-6 text-gray-400 text-sm">
                        {selectedClass ? 'Aucun élève dans cette classe' : 'Sélectionnez une classe ci-dessus'}
                      </p>
                    ) : students.map(s => (
                      <div key={s.id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 text-xs font-bold">{(s.prenom || 'E')[0]}</div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{s.prenom} {s.nom}</p>
                            <p className="text-xs text-gray-400">{s.matricule}</p>
                          </div>
                        </div>
                        <Button variant="gold" size="sm" icon={Download}
                          loading={generatingPdf === s.id}
                          onClick={() => handleGenerateBulletin(s)}>
                          Bulletin
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
