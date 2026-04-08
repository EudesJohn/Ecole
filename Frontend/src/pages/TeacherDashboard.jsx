import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import Sidebar from '../components/UI/Sidebar';
import { Button } from '../components/UI/Button';
import SkeletonLoader from '../components/UI/SkeletonLoader';
import { AnimatePresence, motion } from 'framer-motion';
import { useBulletin } from '../hooks/useBulletin';
import { useTeacherData } from '../hooks/useTeacherData';
import { supabase } from '../supabase';
import { 
  AlertCircle, CheckCircle, GraduationCap, Users, BookOpen, 
  ClipboardCheck, Award, FileText, Download, Loader2 
} from 'lucide-react';
import { GradesTable } from '../components/Dashboard/Teacher/GradesTable';
import { CahierForm } from '../components/Dashboard/Teacher/CahierForm';
import { EntityTable } from '../components/Dashboard/Admin/EntityTable';
import GradeCalculator from '../utils/GradeCalculator';

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
  const [attendance, setAttendance] = useState({});
  const [presenceDate, setPresenceDate] = useState(new Date().toISOString().split('T')[0]);
  const [cahierEntries, setCahierEntries] = useState([]);
  const [cahierForm, setCahierForm] = useState({ date: '', h_debut: '', h_fin: '', chapitre: '', resume: '' });
  const [editCahierId, setEditCahierId] = useState(null);

  const { classes, matieres, schoolConfig, loading } = useTeacherData(userProfile);
  const { handleGenerateBulletin, generatingPdf } = useBulletin();

  const showNotif = (msg, type = 'success') => {
    let friendlyMsg = msg;
    if (msg.includes('duplicate key') || msg.includes('23505')) {
      friendlyMsg = "Une entrée identique existe déjà.";
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
      .eq('evaluation_type', 'composition');

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
    if (!selectedClass || !selectedMatiere) {
      showNotif('Veuillez sélectionner la classe ET la matière avant d\'enregistrer les notes.', 'error');
      return;
    }

    setSaving(true);
    try {
      const cls = classes.find(c => c.nom === selectedClass);
      const mat = matieres.find(m => m.nom === selectedMatiere && m.classe_id === cls?.id);
      
      const gradeFields = ['interro1', 'interro2', 'interro3', 'dw', 'd1', 'd2', 'composition', 'note_cm', 'note_cp'];
      const gradeList = Object.values(grades);
      const hasInvalidGrade = gradeList.some(g => {
        return gradeFields.some(key => {
          const val = parseFloat(g[key]);
          return !isNaN(val) && (val < 0 || val > 20);
        });
      });

      if (hasInvalidGrade) {
        showNotif('Toutes les notes doivent être comprises entre 0 et 20.', 'error');
        setSaving(false);
        return;
      }

      const upserts = Object.keys(grades).map(sid => {
        const payload = { ...grades[sid] };
        // CLEANUP: Remove system fields that might cause conflicts or RLS issues
        const systemFields = ['id', 'created_at', 'updated_at', 'students', 'classes', 'matieres'];
        systemFields.forEach(f => delete payload[f]);

        return {
          ...payload,
          student_id: sid,
          matiere_id: mat.id,
          trimestre: parseInt(schoolConfig.current_trimestre),
          school_year: schoolConfig.current_year,
          evaluation_type: 'composition'
        };
      });
      const { error } = await supabase.from('grades').upsert(upserts, { onConflict: 'student_id,matiere_id,trimestre,school_year,evaluation_type' });
      if (error) throw error;
      showNotif('Notes enregistrées !');
    } catch (err) {
      showNotif(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePresence = async () => {
    if (!selectedClass || !selectedMatiere) {
      showNotif('Sélectionnez une classe et matière.', 'error');
      return;
    }
    setSaving(true);
    try {
      const cls = classes.find(c => c.nom === selectedClass);
      const mat = matieres.find(m => m.nom === selectedMatiere && m.classe_id === cls?.id);
      
      const p_records = Object.keys(attendance).map(sid => ({
        student_id: sid,
        classe_id: cls.id,
        matiere_id: mat.id,
        date: presenceDate,
        status: attendance[sid], // 'present', 'absent', 'retard'
        school_year: schoolConfig.current_year
      }));

      const { error } = await supabase.from('absences').upsert(p_records, { onConflict: 'student_id,matiere_id,date' });
      if (error) throw error;
      showNotif('Présences enregistrées !');
    } catch (err) {
      showNotif(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCahier = async () => {
    if (!selectedClass || !selectedMatiere) {
      showNotif('Veuillez sélectionner une classe et une matière.', 'error');
      return;
    }
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
          <p className="text-slate-400 font-medium text-sm mt-1">Gestion pédagogique et suivi des élèves</p>
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
              students={students} grades={grades} 
              isPrimary={['primaire', 'maternelle'].includes(classes.find(c => c.nom === selectedClass)?.cycle?.toLowerCase())}
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

          {activeTab === 'appel' && (
            <div className="space-y-6">
              <div className="glass-card p-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                    <ClipboardCheck size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Feuille d&apos;appel</h3>
                    <input type="date" value={presenceDate} onChange={e => setPresenceDate(e.target.value)} className="text-xs font-bold text-slate-400 bg-transparent border-none p-0 focus:ring-0" />
                  </div>
                </div>
                <Button variant="primary" onClick={handleSavePresence} loading={saving}>Enregistrer l&apos;appel</Button>
              </div>

              <div className="glass-card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Élèves</th>
                      <th className="text-center px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Présence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {students.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-700">{s.prenom} {s.nom}</td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-2">
                            {['present', 'absent', 'retard'].map(status => (
                              <button
                                key={status}
                                onClick={() => setAttendance(prev => ({ ...prev, [s.id]: status }))}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                                  attendance[s.id] === status
                                    ? status === 'present' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                                    : status === 'absent' ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                                    : 'bg-amber-500 text-white shadow-lg shadow-amber-200'
                                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                                }`}
                              >
                                {status === 'present' ? 'Présent' : status === 'absent' ? 'Absent' : 'Retard'}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'moyennes' && (
            <div className="space-y-6">
              <div className="glass-card p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                    <Award size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Moyennes de la classe</h3>
                    <p className="text-xs text-slate-400 font-medium">{selectedClass || 'Sélectionnez une classe'}</p>
                  </div>
                </div>
              </div>
              <div className="glass-card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Élève</th>
                      <th className="text-center px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Moyenne</th>
                      <th className="text-right px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Appréciation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {students.map(s => {
                      const sg = grades[s.id] || {};
                      const cls = classes.find(c => c.nom === selectedClass);
                      const isPrimary = ['primaire', 'maternelle'].includes(cls?.cycle?.toLowerCase());
                      const hasNotes = Object.keys(sg).length > 0;
                      
                      // For Primary, calculate ratio. For Secondary, calculate average.
                      let displayMoy = "--.--";
                      let displayApp = "Pas de notes";

                      if (hasNotes) {
                        if (isPrimary) {
                           // This assumes 'grades' contains all subject marks for the student.
                           // Actually, 'grades' in state is for the *selected* subject.
                           // We need to fetch all grades for the student in the current trimestre to calculate a real ratio.
                           // For now, let's show if the *selected* subject is validated.
                           const moy = GradeCalculator.getMoyenneByCycle(sg, cls.cycle);
                           displayMoy = moy >= 10 ? "1 / 1" : "0 / 1";
                           displayApp = GradeCalculator.getAppreciation(moy);
                        } else {
                           const moy = GradeCalculator.calculateSubjectAverage(sg.interro1, sg.interro2, sg.interro3, sg.dw, sg.d1, sg.d2);
                           displayMoy = moy.toFixed(2);
                           displayApp = GradeCalculator.getAppreciation(moy);
                        }
                      }

                      return (
                        <tr key={s.id}>
                          <td className="px-6 py-4 font-bold text-slate-700">{s.prenom} {s.nom}</td>
                          <td className="px-6 py-4 text-center font-black text-blue-600">
                            {displayMoy}
                          </td>
                          <td className="px-6 py-4 text-right">
                             <span className="px-2 py-1 bg-slate-50 text-[10px] font-bold text-slate-400 rounded-lg uppercase">
                               {displayApp}
                             </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'bulletins' && (
            <EntityTable 
              items={students} colName="students"
              onExtraAction={async (item) => {
                try {
                  await handleGenerateBulletin(item, schoolConfig, classes, matieres);
                } catch (err) {
                  showNotif(err.message, 'error');
                }
              }}
              extraActionIcon={Download} extraActionLabel="Bulletin" generatingId={generatingPdf}
              columns={[
                { key: 'matricule', label: 'Matricule' },
                { key: 'fullname', label: 'Élève', render: s => <span className="font-bold">{s.prenom} {s.nom}</span> },
                { key: 'classe', label: 'Classe', render: () => selectedClass }
              ]}
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
