import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import Sidebar from '../components/UI/Sidebar';
import { Button } from '../components/UI/Button';
import SkeletonLoader from '../components/UI/SkeletonLoader';
import { AnimatePresence, motion } from 'framer-motion';
import { useBulletin } from '../hooks/useBulletin';
import { useTeacherData } from '../hooks/useTeacherData';
import { supabase } from '../supabase';
import { AlertCircle, CheckCircle, GraduationCap, Users, BookOpen } from 'lucide-react';
import { GradesTable } from '../components/Dashboard/Teacher/GradesTable';
import { CahierForm } from '../components/Dashboard/Teacher/CahierForm';

const TeacherDashboard = () => {
  const { user, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [notification, setNotification] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedMatiere, setSelectedMatiere] = useState('');
  const [evaluationType, setEvaluationType] = useState('etape');
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState({});
  const [cahierEntries, setCahierEntries] = useState([]);
  const [cahierForm, setCahierForm] = useState({ date: '', h_debut: '', h_fin: '', chapitre: '', resume: '' });
  const [editCahierId, setEditCahierId] = useState(null);

  const { classes, matieres, schoolConfig, loading } = useTeacherData(userProfile);
  const { handleGenerateBulletin, generatingPdf } = useBulletin();

  const showNotif = (msg, type = 'success') => {
    // Technical error mapping for a smoother UX
    let friendlyMsg = msg;
    if (msg.includes('duplicate key') || msg.includes('23505')) {
      friendlyMsg = "Une entrée identique existe déjà pour cette sélection (Élève/Matière/Période).";
    }
    
    setNotification({ message: friendlyMsg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const loadStudents = useCallback(async (clsName) => {
    const cls = classes.find(c => c.nom === clsName);
    if (!cls) return;
    const { data } = await supabase.from('students').select('*').eq('classe_id', cls.id).order('nom');
    setStudents(data || []);
  }, [classes]);

  const loadGrades = useCallback(async (clsName, matName) => {
    const cls = classes.find(c => c.nom === clsName);
    const mat = matieres.find(m => m.nom === matName && m.classe_id === cls?.id);
    if (!cls || !mat) return;

    const { data } = await supabase.from('grades')
      .select('*')
      .eq('matiere_id', mat.id)
      .eq('trimestre', parseInt(schoolConfig.current_trimestre))
      .eq('school_year', schoolConfig.current_year)
      .eq('evaluation_type', cls.cycle === 'secondaire' ? 'composition' : evaluationType);

    const map = {};
    (data || []).forEach(g => { map[g.student_id] = g; });
    setGrades(map);
  }, [classes, matieres, schoolConfig, evaluationType]);

  const loadCahier = useCallback(async (clsName) => {
    const cls = classes.find(c => c.nom === clsName);
    if (!cls) return;
    const { data } = await supabase.from('cahier_texte')
      .select('*, matieres(nom)')
      .eq('classe_id', cls.id)
      .order('date', { ascending: false })
      .limit(10);
    setCahierEntries((data || []).map(d => ({ ...d, matiere: d.matieres?.nom })));
  }, [classes]);

  useEffect(() => {
    if (selectedClass) {
      loadStudents(selectedClass);
      loadCahier(selectedClass);
      if (selectedMatiere) loadGrades(selectedClass, selectedMatiere);
    }
  }, [selectedClass, selectedMatiere, evaluationType, loadStudents, loadCahier, loadGrades]);

  const handleSaveGrades = async () => {
    setSaving(true);
    try {
      const cls = classes.find(c => c.nom === selectedClass);
      const mat = matieres.find(m => m.nom === selectedMatiere && m.classe_id === cls?.id);
      const upserts = Object.keys(grades).map(sid => ({
        ...grades[sid],
        student_id: sid,
        matiere_id: mat.id,
        trimestre: parseInt(schoolConfig.current_trimestre),
        school_year: schoolConfig.current_year,
        evaluation_type: cls.cycle === 'secondaire' ? 'composition' : evaluationType
      }));
      const { error } = await supabase.from('grades').upsert(upserts, { onConflict: 'student_id,matiere_id,trimestre,school_year,evaluation_type' });
      if (error) throw error;
      showNotif('Notes enregistrées !');
    } catch (err) {
      showNotif(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCahier = async () => {
    setSaving(true);
    try {
      const cls = classes.find(c => c.nom === selectedClass);
      const mat = matieres.find(m => m.nom === selectedMatiere && m.classe_id === cls?.id);
      const payload = {
        teacher_id: user?.id,
        classe_id: cls.id,
        matiere_id: mat.id,
        date: cahierForm.date || new Date().toISOString().split('T')[0],
        heure: `${cahierForm.h_debut} - ${cahierForm.h_fin}`,
        chapitre: cahierForm.chapitre,
        resume: cahierForm.resume,
        school_year: schoolConfig.current_year
      };

      const res = editCahierId 
        ? await supabase.from('cahier_texte').update(payload).eq('id', editCahierId)
        : await supabase.from('cahier_texte').insert([payload]);

      if (res.error) throw res.error;
      showNotif('Cahier mis à jour !');
      setCahierForm({ date: '', h_debut: '', h_fin: '', chapitre: '', resume: '' });
      setEditCahierId(null);
      loadCahier(selectedClass);
    } catch (err) {
      showNotif(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-screen bg-gray-50"><Sidebar role="teacher" activeTab={activeTab} /><div className="flex-1 p-8"><SkeletonLoader type="card" count={3} /></div></div>;

  return (
    <div className="flex min-h-screen bg-[#fcfdfe]">
      <Sidebar role="teacher" activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="flex-1 p-6 md:p-10 pt-20 md:pt-10 overflow-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-display font-black text-slate-900 tracking-tight">Espace Professeur</h1>
          <p className="text-slate-400 font-medium text-sm mt-1">Saisie des notes et suivi pédagogique</p>
        </header>

        <section className="mb-10 grid sm:grid-cols-2 gap-4">
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="input-slb">
            <option value="">Sélectionner une classe</option>
            {classes.map(c => <option key={c.id} value={c.nom}>{c.nom}</option>)}
          </select>
          <select value={selectedMatiere} onChange={e => setSelectedMatiere(e.target.value)} className="input-slb">
            <option value="">Sélectionner une matière</option>
            {matieres.filter(m => !selectedClass || m.classe === selectedClass).map(m => <option key={m.id} value={m.nom}>{m.nom}</option>)}
          </select>
        </section>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               <div className="glass-card p-8 flex items-center gap-6"><Users className="text-blue-600" size={32} /><div><p className="text-xs font-black text-slate-400 uppercase">Élèves</p><h3 className="text-2xl font-bold">{students.length}</h3></div></div>
               <div className="glass-card p-8 flex items-center gap-6"><BookOpen className="text-indigo-600" size={32} /><div><p className="text-xs font-black text-slate-400 uppercase">Matières</p><h3 className="text-2xl font-bold">{matieres.length}</h3></div></div>
            </div>
          )}

          {activeTab === 'notes' && (
            <GradesTable 
              students={students} grades={grades} isPrimary={classes.find(c => c.nom === selectedClass)?.cycle !== 'secondaire'}
              evaluationType={evaluationType} setEvaluationType={setEvaluationType}
              updateGrade={(sid, f, v) => setGrades(prev => ({ ...prev, [sid]: { ...prev[sid], [f]: v } }))}
              onSave={handleSaveGrades} saving={saving}
            />
          )}

          {activeTab === 'cahier' && (
            <CahierForm 
              form={cahierForm} setForm={setCahierForm} onSubmit={handleSaveCahier}
              entries={cahierEntries} onEdit={e => { setCahierForm({ ...e, h_debut: e.heure.split(' - ')[0], h_fin: e.heure.split(' - ')[1] }); setEditCahierId(e.id); }}
              onDelete={async (id) => {
                if (!window.confirm('Supprimer cette entrée ?')) return;
                setSaving(true);
                try {
                  const { error } = await supabase.from('cahier_texte').delete().eq('id', id);
                  if (error) throw error;
                  showNotif('Entrée supprimée !');
                  loadCahier(selectedClass);
                } catch (err) {
                  showNotif(err.message, 'error');
                } finally {
                  setSaving(false);
                }
              }}
              saving={saving} editId={editCahierId}
              currentUserId={user?.id}
            />
          )}
        </AnimatePresence>
      </main>

      {notification && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-xl shadow-lg text-white flex items-center gap-2 z-50 ${notification.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
          {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          <span className="font-bold">{notification.message}</span>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
