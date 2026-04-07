import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/UI/Sidebar';
import Modal from '../components/UI/Modal';
import { Button } from '../components/UI/Button';
import SkeletonLoader from '../components/UI/SkeletonLoader';
import { motion, AnimatePresence } from 'framer-motion';
import generateSLBId from '../utils/generateSLBId';
import GradeCalculator from '../utils/GradeCalculator';
import { downloadBulletin, generateQRDataUrl } from '../utils/bulletinTasks';
import { supabase } from '../supabase';
import {
  Users, GraduationCap, BookOpen, FileText, Plus, Trash2, Edit3, Search,
  BookMarked, Award, Loader2, CheckCircle, AlertCircle,
  Download, Check, X as XIcon, RefreshCw, Settings, Calendar
} from 'lucide-react';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ students: 0, teachers: 0, classes: 0, matieres: 0 });

  // Data states
  const [classes, setClasses] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [cahiers, setCahiers] = useState([]);
  const [schoolConfig, setSchoolConfig] = useState({ current_trimestre: '1', current_year: '2025-2026' });

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState(null);
  const [safeMode, setSafeMode] = useState(false); // Mode Manuel pour réseaux restreints

  // Bulletin
  const [selectedBulletinClass, setSelectedBulletinClass] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(null);

  // Presences
  const [presenceClass, setPresenceClass] = useState('');
  const [presenceStudent, setPresenceStudent] = useState('');

  // Cahier Filters
  const [cahierFilterClass, setCahierFilterClass] = useState('');
  const [cahierFilterMatiere, setCahierFilterMatiere] = useState('');
  const [cahierSort, setCahierSort] = useState({ key: 'date', direction: 'desc' });


  // Identifiants nouveaux professeurs
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [newTeacherCreds, setNewTeacherCreds] = useState(null);

  // ===== UTILITAIRES =====
  const formatMatricule = (value) => {
    if (!['eleves', 'bulletins'].includes(activeTab)) return value;
    // Only format if starts with a digit (suggests a matricule search)
    if (value.length > 0 && !/^\d/.test(value)) return value;

    const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length <= 4) return clean;
    if (clean.length <= 7) {
      const part1 = clean.substring(0, 4);
      const part2 = clean.substring(4);
      if (part2.length > 0 && !'SLB'.startsWith(part2)) return `${part1} SLB ${part2}`;
      return `${part1} ${part2}`;
    }
    const part1 = clean.substring(0, 4);
    let part3 = clean.includes('SLB') ? clean.split('SLB')[1] : clean.substring(4);
    return `${part1} SLB ${part3.substring(0, 2)}`.trim();
  };

  const showNotif = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchCahiers = async () => {
    try {
      const { data, error } = await supabase
        .from('cahier_texte')
        .select('*, profiles(nom, prenom), matieres(nom), classes(nom)')
        .order('date', { ascending: false });
      if (!error && data) setCahiers(data);
    } catch (err) {
      console.error('Error fetching cahiers:', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const results = await Promise.all([
        supabase.from('classes').select('*').order('nom'),
        supabase.from('matieres').select('*, classes(nom)').order('nom'),
        supabase.from('students').select('*, classes(nom)').order('nom'),
        supabase.from('profiles').select('*').eq('role', 'teacher').order('nom'),
        supabase.from('absences').select('*, students(nom, prenom, classes(nom))').order('date', { ascending: false }),
        supabase.from('cahier_texte').select('*, profiles(nom, prenom), matieres(nom), classes(nom)').order('date', { ascending: false }),
        supabase.from('school_config').select('*')
      ]);

      const [
        { data: classesData },
        { data: matieresData },
        { data: studentsData },
        { data: teachersData },
        { data: absencesData },
        { data: cahierData },
        { data: configData }
      ] = results;

      if (configData) {
        const configObj = configData.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
        setSchoolConfig(prev => ({ ...prev, ...configObj }));
      }

      setClasses(classesData || []);
      setMatieres((matieresData || []).map(m => ({ ...m, classe: m.classes?.nom })));
      setStudents((studentsData || []).map(s => ({ ...s, classe: s.classes?.nom })));
      setTeachers(teachersData || []);
      setAbsences(absencesData || []);
      setCahiers(cahierData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      showNotif('Erreur lors du chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // SETUP REAL-TIME SUBSCRIPTIONS
    const channel = supabase
      .channel('admin_db_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'classes' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setClasses(prev => [...prev, payload.new].sort((a, b) => a.nom.localeCompare(b.nom)));
          } else if (payload.eventType === 'UPDATE') {
            setClasses(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
          } else if (payload.eventType === 'DELETE') {
            setClasses(prev => prev.filter(c => c.id === payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cahier_texte' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            fetchCahiers();
          } else if (payload.eventType === 'DELETE') {
            setCahiers(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const getJoined = async () => {
              const { data } = await supabase.from('students').select('*, classes(nom)').eq('id', payload.new.id).single();
              if (data) {
                const newSt = { ...data, classe: data.classes?.nom };
                setStudents(prev => {
                  // Optimistic update without triggering global fetch
                  if (payload.eventType === 'INSERT') return [newSt, ...prev];
                  return prev.map(s => s.id === newSt.id ? newSt : s);
                });
              }
            };
            getJoined();
          } else if (payload.eventType === 'DELETE') {
            setStudents(prev => prev.filter(s => s.id === payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matieres' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const getJoined = async () => {
              const { data } = await supabase.from('matieres').select('*, classes(nom)').eq('id', payload.new.id).single();
              if (data) {
                const newMat = { ...data, classe: data.classes?.nom };
                setMatieres(prev => {
                  if (payload.eventType === 'INSERT') return [newMat, ...prev];
                  return prev.map(m => m.id === newMat.id ? newMat : m);
                });
              }
            };
            getJoined();
          } else if (payload.eventType === 'DELETE') {
            setMatieres(prev => prev.filter(m => m.id === payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          if (payload.new && payload.new.role === 'teacher') {
            if (payload.eventType === 'INSERT') {
              setTeachers(prev => [...prev, payload.new].sort((a, b) => a.full_name?.localeCompare(b.full_name)));
            } else if (payload.eventType === 'UPDATE') {
              setTeachers(prev => prev.map(t => t.id === payload.new.id ? payload.new : t));
            }
          }
          if (payload.eventType === 'DELETE') {
            setTeachers(prev => prev.filter(t => t.id === payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'absences' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // Ajout optimiste pour éviter le rechargement complet
            setAbsences(prev => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setAbsences(prev => prev.map(a => a.id === payload.new.id ? payload.new : a));
          } else if (payload.eventType === 'DELETE') {
            setAbsences(prev => prev.filter(a => a.id === payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  // ===== Stats calculés automatiquement quand les données changent =====
  useEffect(() => {
    setStats({
      students: students.length,
      teachers: teachers.length,
      classes: classes.length,
      matieres: matieres.length
    });
  }, [students, teachers, classes, matieres]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let result;
      const payload = { ...formData };

      // Special logic for class mapping (using stable ID instead of names now)
      if (payload.classe && modalType !== 'classes') {
        payload.classe_id = payload.classe;
        delete payload.classe;
      }

      // REMOVE GENERATED COLUMNS
      if (modalType === 'teachers') {
        delete payload.full_name;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const getBackendUrl = () => {
        const url = import.meta.env.VITE_BACKEND_URL;
        if (!url || url.includes('your_backend_url')) return '';
        return url;
      };
      const backendUrl = getBackendUrl();

      if (modalType === 'students' && !editItem) {
        // CALL BACKEND API FOR STUDENT CREATION (Generates Matricule & PIN)
        const response = await fetch(`${backendUrl}/api/admin/students`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erreur lors de la création de l\'élève');

        setNewTeacherCreds({ email: `Matricule: ${data.matricule}`, password: `PIN Parent: ${data.pin}`, isStudent: true });
        setShowCredsModal(true);
        showNotif(`Élève créé ! Matricule: ${data.matricule}`);
      } else if (modalType === 'teachers' && !editItem) {
        const response = await fetch(`${backendUrl}/api/admin/teachers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            email: payload.email,
            password: ''
          })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erreur lors de la création');

        // AFFICHER LES IDENTIFIANTS
        setNewTeacherCreds({ email: payload.email, password: data.password });
        setShowCredsModal(true);
        showNotif(`Professeur créé !`);
      } else if (editItem) {
        result = await supabase.from(modalType === 'teachers' ? 'profiles' : modalType).update(payload).eq('id', editItem.id).select();
        if (result.error) throw result.error;
        if (!result.data || result.data.length === 0) throw new Error("Modification refusée par la base de données (Vérifiez votre rôle Admin).");
        showNotif(`Mis à jour avec succès !`);
      } else {
        result = await supabase.from(modalType === 'teachers' ? 'profiles' : modalType).insert([payload]).select();
        if (result.error) throw result.error;
        if (!result.data || result.data.length === 0) throw new Error("Ajout refusé par la base de données.");
        showNotif(`Enregistré avec succès !`);
      }

      setModalOpen(false);
      setFormData({});

      // Update current displayed data depending on what we added before refresh
      // Commented out fetch data to use optimistic updates
      // fetchData(); // Refresh
    } catch (err) {
      console.error('Save error:', err);
      showNotif(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (teacher) => {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    const randomPass = array[0].toString(36).slice(-8);
    const newPass = prompt(`Nouveau mot de passe pour ${teacher.prenom} ${teacher.nom} :`, randomPass);
    if (!newPass) return;

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const getBackendUrl = () => {
        const url = import.meta.env.VITE_BACKEND_URL;
        if (!url || url.includes('your_backend_url')) return '';
        return url;
      };
      const backendUrl = getBackendUrl();

      const response = await fetch(`${backendUrl}/api/admin/teachers/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: teacher.id, newPassword: newPass })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erreur lors de la réinitialisation');

      showNotif(`Mot de passe mis à jour pour ${teacher.email}`);
    } catch (err) {
      showNotif(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };


  const handleDelete = async (col, id) => {
    if (window.confirm('Confirmer la suppression ?')) {
      try {
        const { data, error } = await supabase.from(col === 'teachers' ? 'profiles' : col).delete().eq('id', id).select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error("Suppression refusée par la base de données (Droits insuffisants).");

        showNotif('Supprimé avec succès');
        await new Promise(r => setTimeout(r, 500));
        fetchData();
      } catch (err) {
        showNotif(err.message, 'error');
      }
    }
  };

  const handleRepairConnection = async () => {
    showNotif('Rafraîchissement manuel...', 'info');
    window.location.reload();
  };

  const handleSeedMatieres = async () => {
    showNotif('Non disponible sans Backend', 'error');
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    setEditItem(item);
    if (item) {
      const rest = { ...item };
      delete rest.id;
      delete rest.createdAt;
      delete rest.updatedAt;
      setFormData(rest);
    } else {
      setFormData({});
    }
    setModalOpen(true);
  };


  const handleGenerateBulletin = async (student) => {
    setGeneratingPdf(student.id);
    try {
      if (!student.classe_id) throw new Error("Cet élève n'est pas assigné à une classe.");

      // 2. Fetch Detailed Stats (Subject records + Class stats)
      const { data: statsData, error: rpcError } = await supabase.rpc('get_detailed_stats', {
        p_student_id: student.id,
        p_trimestre: parseInt(schoolConfig.current_trimestre),
        p_school_year: schoolConfig.current_year
      });
      if (rpcError) throw rpcError;

      const classStats = {
        effectif: statsData.general_stats.effectif || 0,
        plusForte: statsData.general_stats.max_moyenne || 0,
        plusFaible: statsData.general_stats.min_moyenne || 0,
        studentAverage: statsData.general_stats.moyenne_generale || 0,
        rang: statsData.general_stats.rang || 1,
        subjectStats: statsData.subject_stats || {}
      };

      // 4. Prepare data for the specific target student
      const { data: studentGrades } = await supabase
        .from('grades')
        .select('*, matieres(nom, coefficient)')
        .eq('student_id', student.id)
        .eq('trimestre', parseInt(schoolConfig.current_trimestre))
        .eq('school_year', schoolConfig.current_year);

      const targetGrades = (studentGrades || []).map(g => ({
        matiere: g.matieres?.nom,
        matiere_id: g.matiere_id,
        interro1: g.interro1,
        interro2: g.interro2,
        interro3: g.interro3,
        devoir: g.devoir,
        composition: g.composition
      }));

      if (targetGrades.length === 0) {
        throw new Error("Cet élève n'a aucune note.");
      }

      const qrUrl = await generateQRDataUrl(`https://saintlambert.bj/verify/${encodeURIComponent(student.matricule)}/${schoolConfig.current_trimestre}/${schoolConfig.current_year}`);

      await downloadBulletin({
        student: { 
          ...student, 
          classe: student.classe,
          dateNaissance: student.date_naissance // Align with PDF component prop
        },
        gradesBySubject: targetGrades,
        matieres,
        classStats: classStats,
        qrCodeDataUrl: qrUrl,
        trimestre: `${schoolConfig.current_trimestre}${schoolConfig.current_trimestre === '1' ? 'er' : 'ème'}`,
        schoolYear: schoolConfig.current_year
      });

      showNotif('Bulletin généré avec succès !');
    } catch (err) {
      console.error('PDF Error:', err);
      showNotif(err.message, 'error');
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handleGenerateAllBulletins = async (classeName) => {
    const cls = classes.find(c => c.nom === classeName);
    if (!cls) return;

    const classSts = students.filter(s => s.classe === classeName);
    if (classSts.length === 0) {
      showNotif('Aucun élève dans cette classe', 'error');
      return;
    }

    showNotif(`Génération de ${classSts.length} bulletins pour ${classeName}...`, 'info');

    // Process one by one to avoid overwhelming the browser/API
    for (const student of classSts) {
      try {
        await handleGenerateBulletin(student);
        // Small delay for sequential downloads
        await new Promise(r => setTimeout(r, 800));
      } catch (err) {
        console.error(`Error for ${student.nom}:`, err);
      }
    }
    showNotif('Génération groupée terminée.');
  };

  const filteredItems = (items) => {
    if (!searchTerm) return items;
    return items.filter(item =>
      Object.values(item).some(v =>
        String(v).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  };

  // Get filtered absences
  const getFilteredAbsences = () => {
    let filtered = absences;
    if (presenceClass) filtered = filtered.filter(a => a.students?.classes?.nom === presenceClass);
    if (presenceStudent) filtered = filtered.filter(a => a.student_id === presenceStudent);
    return filtered;
  };

  const handleUpdateConfig = async (key, value) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('school_config')
        .update({ value: String(value) })
        .eq('key', key);
      
      if (error) throw error;
      setSchoolConfig(prev => ({ ...prev, [key]: String(value) }));
      showNotif('Configuration mise à jour');
    } catch (err) {
      showNotif(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const getStudentById = (id) => students.find(s => s.id === id);

  /* ======================== RENDER HELPERS ======================== */

  const StatCard = ({ icon: Icon, label, value, color, delay }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.5 }}
      className="glass-card p-5 relative overflow-hidden group cursor-default"
    >
      <div className={`absolute top-0 right-0 w-16 h-16 ${color} rounded-bl-[2.5rem] opacity-10 group-hover:opacity-20 transition-opacity`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-display font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </motion.div>
  );

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={GraduationCap} label="Élèves" value={stats.students} color="bg-primary-500" delay={0} />
        <StatCard icon={Users} label="Professeurs" value={stats.teachers} color="bg-emerald-500" delay={0.1} />
        <StatCard icon={BookOpen} label="Classes" value={stats.classes} color="bg-purple-500" delay={0.2} />
        <StatCard icon={BookMarked} label="Matières" value={stats.matieres} color="bg-gold-500" delay={0.3} />
      </div>
      <div className="glass-card p-6">
        <h3 className="text-lg font-display font-bold text-gray-900 mb-4">Derniers élèves inscrits</h3>
        {students.length === 0 ? (
          <p className="text-center py-6 text-gray-400 text-sm">Aucun élève enregistré</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {students.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-3">
                <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 text-xs font-bold">
                  {(s.prenom || 'E')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-700 text-sm">{s.prenom} {s.nom}</p>
                  <p className="text-xs text-gray-400">{s.matricule} · {s.classe || 'Non assigné'}</p>
                </div>
                <Button variant="ghost" size="sm" icon={Download} onClick={() => handleGenerateBulletin(s)}>
                  PDF
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderTable = (items, columns, colName) => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Rechercher..." value={searchTerm}
            onChange={(e) => setSearchTerm(formatMatricule(e.target.value))}
            className="input-slb pl-10 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          {colName === 'matieres' && items.length === 0 && (
            <Button variant="secondary" icon={BookMarked} onClick={handleSeedMatieres} disabled={saving}>
              Générer
            </Button>
          )}
          <Button variant="primary" icon={Plus} onClick={() => openModal(colName)}>
            Ajouter
          </Button>
        </div>
      </div>
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                {columns.map(col => (
                  <th key={col.key} className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                    {col.label}
                  </th>
                ))}
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredItems(items).map((item, i) => (
                <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }} className="hover:bg-primary-50/30 transition-colors">
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3 text-sm text-gray-700">
                      {col.render ? col.render(item) : item[col.key] || '—'}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {colName === 'students' && (
                        <button onClick={() => handleGenerateBulletin(item)}
                          disabled={generatingPdf === item.id}
                          className="p-1.5 text-gray-400 hover:text-gold-600 hover:bg-gold-50 rounded-lg transition disabled:opacity-50">
                          {generatingPdf === item.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        </button>
                      )}
                      {colName === 'teachers' && (
                        <button onClick={() => handleResetPassword(item)}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                          title="Réinitialiser le mot de passe">
                          <RefreshCw size={14} />
                        </button>
                      )}
                      <button onClick={() => openModal(colName, item)}
                        className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => handleDelete(colName, item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filteredItems(items).length === 0 && (
            <p className="text-center py-8 text-gray-400 text-sm">Aucun élément trouvé</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderBulletins = () => (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <h3 className="text-lg font-display font-bold text-gray-900 mb-4 flex items-center gap-2">
          <FileText size={20} className="text-primary-500" />
          Bulletin individuel
        </h3>
        <p className="text-sm text-gray-500 mb-4">Cliquez sur le bouton télécharger à côté de chaque élève.</p>
        <div className="relative max-w-sm mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Rechercher un élève..." value={searchTerm}
            onChange={(e) => setSearchTerm(formatMatricule(e.target.value))} className="input-slb pl-10 text-sm" />
        </div>
        <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
          {filteredItems(students).map(student => (
            <div key={student.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 text-xs font-bold">
                  {(student.prenom || 'E')[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{student.prenom} {student.nom}</p>
                  <p className="text-xs text-gray-400">{student.matricule} · {student.classe}</p>
                </div>
              </div>
              <Button variant="gold" size="sm" icon={Download}
                loading={generatingPdf === student.id}
                onClick={() => handleGenerateBulletin(student)}>
                Bulletin
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-6">
        <h3 className="text-lg font-display font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Award size={20} className="text-gold-500" />
          Bulletins par classe (Administration)
        </h3>
        <p className="text-sm text-gray-500 mb-4">G&eacute;n&eacute;rer tous les bulletins d&apos;une classe en une fois.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <select value={selectedBulletinClass}
            onChange={(e) => setSelectedBulletinClass(e.target.value)}
            className="input-slb max-w-xs">
            <option value="">Choisir une classe</option>
            {classes.map(c => <option key={c.id} value={c.nom}>{c.nom} ({students.filter(s => s.classe === c.nom).length} élèves)</option>)}
          </select>
          <Button variant="primary" icon={Download} size="lg"
            disabled={!selectedBulletinClass}
            onClick={() => handleGenerateAllBulletins(selectedBulletinClass)}>
            Générer tous les bulletins
          </Button>
        </div>
      </div>
    </div>
  );

  const renderPresences = () => {
    const filtered = getFilteredAbsences();
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <select value={presenceClass} onChange={(e) => { setPresenceClass(e.target.value); setPresenceStudent(''); }}
            className="input-slb max-w-xs">
            <option value="">Toutes les classes</option>
            {classes.map(c => <option key={c.id} value={c.nom}>{c.nom}</option>)}
          </select>
          <select value={presenceStudent} onChange={(e) => setPresenceStudent(e.target.value)}
            className="input-slb max-w-xs">
            <option value="">Tous les élèves</option>
            {students.filter(s => !presenceClass || s.classe === presenceClass).map(s => (
              <option key={s.id} value={s.id}>{s.prenom} {s.nom}</option>
            ))}
          </select>
        </div>
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th className="text-left text-[11px] font-semibold text-gray-500 uppercase px-4 py-3">Élève</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 uppercase px-4 py-3">Classe</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 uppercase px-4 py-3">Date</th>
                  <th className="text-center text-[11px] font-semibold text-gray-500 uppercase px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((ab) => (
                    <tr key={ab.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {ab.students ? `${ab.students.prenom} ${ab.students.nom}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {ab.students?.classes?.nom || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{ab.date || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {ab.status === 'present' ? (
                          <span className="badge-success flex items-center gap-1 justify-center"><Check size={12} /> Présent</span>
                        ) : (
                          <span className="badge-danger flex items-center gap-1 justify-center"><XIcon size={12} /> Absent</span>
                        )}
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-center py-8 text-gray-400 text-sm">Aucune donn&eacute;e de pr&eacute;sence</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCahiers = () => {
    const filteredCahiers = cahiers.filter(c => {
      const matchClass = !cahierFilterClass || c.classe_id === cahierFilterClass;
      const matchMat = !cahierFilterMatiere || c.matieres?.nom === cahierFilterMatiere;
      return matchClass && matchMat;
    });

    const sortedCahiers = [...filteredCahiers].sort((a, b) => {
      const dir = cahierSort.direction === 'asc' ? 1 : -1;
      if (cahierSort.key === 'date') return (new Date(a.date) - new Date(b.date)) * dir;
      if (cahierSort.key === 'prof') {
        const nameA = `${a.profiles?.prenom} ${a.profiles?.nom}`;
        const nameB = `${b.profiles?.prenom} ${b.profiles?.nom}`;
        return nameA.localeCompare(nameB) * dir;
      }
      if (cahierSort.key === 'classe') return (a.classes?.nom || '').localeCompare(b.classes?.nom || '') * dir;
      if (cahierSort.key === 'matiere') return (a.matieres?.nom || '').localeCompare(b.matieres?.nom || '') * dir;
      return 0;
    });

    const handleSort = (key) => {
      setCahierSort(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
      }));
    };

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 mb-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Filtrer par Classe</label>
            <select value={cahierFilterClass} onChange={(e) => setCahierFilterClass(e.target.value)} className="input-slb text-sm">
              <option value="">Toutes les classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Filtrer par Matière</label>
            <select value={cahierFilterMatiere} onChange={(e) => setCahierFilterMatiere(e.target.value)} className="input-slb text-sm">
              <option value="">Toutes les matières</option>
              {Array.from(new Set(matieres.map(m => m.nom))).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <button onClick={() => { setCahierFilterClass(''); setCahierFilterMatiere(''); }} className="self-end px-4 py-2 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
            Réinitialiser
          </button>
        </div>

        <div className="glass-card overflow-hidden">
          {sortedCahiers.length === 0 ? (
            <p className="text-center py-12 text-gray-400 italic">Aucun cahier de texte enregistré pour le moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100">
                    <th onClick={() => handleSort('date')} className="text-left text-[11px] font-semibold text-gray-500 uppercase px-4 py-3 cursor-pointer hover:bg-gray-100">
                      Date {cahierSort.key === 'date' && (cahierSort.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('prof')} className="text-left text-[11px] font-semibold text-gray-500 uppercase px-4 py-3 cursor-pointer hover:bg-gray-100">
                      Professeur {cahierSort.key === 'prof' && (cahierSort.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('classe')} className="text-left text-[11px] font-semibold text-gray-500 uppercase px-4 py-3 cursor-pointer hover:bg-gray-100">
                      Classe {cahierSort.key === 'classe' && (cahierSort.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('matiere')} className="text-left text-[11px] font-semibold text-gray-500 uppercase px-4 py-3 cursor-pointer hover:bg-gray-100">
                      Matière {cahierSort.key === 'matiere' && (cahierSort.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="text-left text-[11px] font-semibold text-gray-500 uppercase px-4 py-3">Début</th>
                    <th className="text-left text-[11px] font-semibold text-gray-500 uppercase px-4 py-3">Fin</th>
                    <th className="text-left text-[11px] font-semibold text-gray-500 uppercase px-4 py-3">Chapitre</th>
                    <th className="text-left text-[11px] font-semibold text-gray-500 uppercase px-4 py-3">Résumé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedCahiers.map((c) => {
                    // Utilisation du séparateur standard " - " pour une fiabilité maximale
                    const parts = (c.heure || '').split(' - ');
                    const h_debut = parts[0] || c.heure || '—';
                    const h_fin = parts[1] || '—';
                    
                    return (
                      <tr key={c.id} className="hover:bg-gray-50/50 align-top">
                        <td className="px-4 py-3 text-sm text-gray-500">{c.date}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">{c.profiles?.prenom} {c.profiles?.nom}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{c.classes?.nom}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{c.matieres?.nom}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap" title={`Brut: ${c.heure}`}>{h_debut}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap" title={`Brut: ${c.heure}`}>{h_fin}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{c.chapitre}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 max-w-sm whitespace-normal break-words">{c.resume}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderModalForm = () => {
    const fields = {
      classes: [
        { key: 'nom', label: 'Nom de la classe', placeholder: '6ème A', required: true },
        { key: 'niveau', label: 'Niveau', placeholder: '6ème' },
        { key: 'effectif', label: 'Effectif max', type: 'number', placeholder: '35' },
      ],
      matieres: [
        { key: 'nom', label: 'Nom de la matière', placeholder: 'Mathématiques', required: true },
        { key: 'coefficient', label: 'Coefficient', type: 'number', placeholder: '4', required: true },
        { key: 'classe', label: 'Classe', type: 'classSelect', required: true },
        // Professeur optionnel retiré à la demande de l'utilisateur
      ],
      students: [
        { key: 'prenom', label: 'Prénom', placeholder: 'Jean', required: true },
        { key: 'nom', label: 'Nom', placeholder: 'DUPONT', required: true },
        { key: 'classe', label: 'Classe', type: 'classSelect' },
        { key: 'date_naissance', label: 'Date de naissance', type: 'date' },
        { key: 'sexe', label: 'Sexe', type: 'select', options: ['M', 'F'] },
      ],
      teachers: [
        { key: 'prenom', label: 'Prénom', placeholder: 'Marie', required: true },
        { key: 'nom', label: 'Nom', placeholder: 'KOUNDE', required: true },
        { key: 'email', label: 'Email', type: 'email', placeholder: 'marie@saintlambert.bj' },
        { key: 'matiere', label: 'Matières', type: 'multiMatiere' },
        { key: 'classe_assignee', label: 'Classes assignées', type: 'multiClass' },
      ],
    };

    return (
      <div className="space-y-4">
        {(fields[modalType] || []).map(field => (
          <div key={field.key}>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              {field.label} {field.required && <span className="text-red-400">*</span>}
            </label>
            {field.type === 'select' ? (
              <select value={formData[field.key] || ''} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} className="input-slb">
                <option value="">Sélectionner</option>
                {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : field.type === 'classSelect' ? (
              <select value={formData[field.key] || ''} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} className="input-slb">
                <option value="">Sélectionner une classe</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            ) : field.type === 'matiereSelect' ? (
              <select value={formData[field.key] || ''} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} className="input-slb">
                <option value="">Sélectionner une matière</option>
                {matieres.map(m => <option key={m.id} value={m.nom}>{m.nom}</option>)}
              </select>
            ) : field.type === 'teacherSelect' ? (
              <select value={formData[field.key] || ''} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} className="input-slb">
                <option value="">Sélectionner un professeur</option>
                {teachers.map(t => <option key={t.id} value={`${t.prenom} ${t.nom}`}>{t.prenom} {t.nom}</option>)}
              </select>
            ) : (field.type === 'multiMatiere' || field.type === 'multiClass') ? (
              <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 max-h-[150px] overflow-y-auto">
                {(field.type === 'multiMatiere' ? matieres : classes).map(opt => {
                  const val = opt.nom;
                  const isChecked = Array.isArray(formData[field.key]) && formData[field.key].includes(val);
                  return (
                    <label key={opt.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${isChecked ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-gray-100 text-gray-500 hover:border-primary-100'}`}>
                      <input type="checkbox" className="hidden" checked={isChecked} onChange={() => {
                        const current = Array.isArray(formData[field.key]) ? formData[field.key] : [];
                        const next = isChecked ? current.filter(v => v !== val) : [...current, val];
                        setFormData({ ...formData, [field.key]: next });
                      }} />
                      <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${isChecked ? 'bg-primary-500 border-primary-500' : 'border-gray-300'}`}>
                        {isChecked && <Check size={10} className="text-white" />}
                      </span>
                      <span className="text-[11px] font-medium truncate">{val}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <input type={field.type || 'text'} value={formData[field.key] || ''}
                onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                className="input-slb" placeholder={field.placeholder} required={field.required} />
            )}
          </div>
        ))}
        {modalType === 'students' && editItem && (
          <div className="p-3 bg-primary-50 rounded-xl border border-primary-100">
            <p className="text-xs text-primary-600 font-mono font-bold">📋 Matricule: {editItem.matricule}</p>
          </div>
        )}
        {modalType === 'students' && !editItem && (
          <div className="p-3 bg-gold-50 rounded-xl border border-gold-200">
            <p className="text-xs text-gold-700">✨ Le matricule SLB sera généré automatiquement</p>
          </div>
        )}
        <div className="flex gap-3 pt-3">
          <Button variant="secondary" onClick={() => { setModalOpen(false); setFormData({}); }} className="flex-1">
            Annuler
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving} className="flex-1">
            {editItem ? 'Mettre à jour' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    );
  };

  /* ======================== MAIN RENDER ======================== */

  if (loading) return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role="admin" activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 p-6 md:p-8 pt-20 md:pt-8"><SkeletonLoader type="stat" count={4} /></div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role="admin" activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 min-w-0 overflow-auto pt-16 md:pt-0">
        {/* Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className={`fixed top-4 right-4 z-[80] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white ${notification.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'
                }`}>
              {notification.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
              <span className="text-sm font-medium max-w-xs">{notification.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-6 md:p-8 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-gray-900">Administration</h1>
            <p className="text-gray-400 text-sm mt-1">Gerez votre établissement en toute sécurité (Connecté)</p>
          </motion.div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSafeMode(!safeMode)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${safeMode
                ? 'bg-amber-100 border-amber-300 text-amber-700 font-bold'
                : 'bg-green-100 border-green-300 text-green-700'
                }`}
            >
              {safeMode ? '⚠️ Mode Manuel Actif' : '⚡ Mode Temps Réel'}
            </button>
            <Button variant="ghost" icon={RefreshCw} size="sm" onClick={handleRepairConnection}>
              Réparer la connexion
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 md:px-8 pb-8">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'classes' && renderTable(classes, [
                { key: 'nom', label: 'Classe' },
                { key: 'niveau', label: 'Niveau' },
                { key: 'effectif', label: 'Effectif' },
              ], 'classes')}
              {activeTab === 'matieres' && renderTable(matieres, [
                { key: 'nom', label: 'Matière' },
                {
                  key: 'classe', label: 'Classe', render: (item) => (
                    <span className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded-md text-[10px] font-bold border border-primary-100">{item.classe || 'N/A'}</span>
                  )
                },
                {
                  key: 'coefficient', label: 'Coeff.', render: (item) => (
                    <span className="inline-flex items-center justify-center w-7 h-7 bg-gold-100 text-gold-700 rounded-lg font-bold text-xs">{item.coefficient || '—'}</span>
                  )
                },
                { key: 'professeur', label: 'Professeur' },
              ], 'matieres')}
              {activeTab === 'eleves' && renderTable(students, [
                {
                  key: 'matricule', label: 'Matricule', render: (item) => (
                    <span className="font-mono text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-lg">{item.matricule}</span>
                  )
                },
                { key: 'prenom', label: 'Prénom' },
                { key: 'nom', label: 'Nom' },
                { key: 'classe', label: 'Classe' },
                { 
                  key: 'pin_code', label: 'Code PIN', render: (item) => (
                    <span className="font-mono text-xs text-gray-500">{item.pin_code || '—'}</span>
                  )
                },
              ], 'students')}
              {activeTab === 'professeurs' && renderTable(teachers, [
                { key: 'prenom', label: 'Prénom' },
                { key: 'nom', label: 'Nom' },
                { key: 'email', label: 'Email' },
                {
                  key: 'matiere', label: 'Matières', render: (item) => (
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(item.matiere) ? item.matiere.map((m, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-gold-50 text-gold-700 rounded text-[9px] font-bold border border-gold-100">{m}</span>
                      )) : <span className="text-gray-400">—</span>}
                    </div>
                  )
                },
                {
                  key: 'classe_assignee', label: 'Classes', render: (item) => (
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(item.classe_assignee) ? item.classe_assignee.map((c, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-primary-50 text-primary-700 rounded text-[9px] font-bold border border-primary-100">{c}</span>
                      )) : <span className="text-gray-400">—</span>}
                    </div>
                  )
                },
              ], 'teachers')}
              {activeTab === 'bulletins' && renderBulletins()}
              {activeTab === 'presences' && renderPresences()}
              {activeTab === 'cahiers' && renderCahiers()}
              {activeTab === 'settings' && (
                <div className="space-y-6">
                  <div className="glass-card p-6">
                    <h3 className="text-xl font-display font-bold text-gray-900 mb-6 flex items-center gap-2">
                       <Settings className="text-primary-500" /> Paramètres de l'établissement
                    </h3>
                    
                    <div className="grid md:grid-cols-2 gap-8">
                      {/* Trimestre */}
                      <div className="p-6 bg-primary-50/50 rounded-2xl border border-primary-100">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-100">
                            <Award size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-primary-900 leading-tight">Trimestre Actif</p>
                            <p className="text-xs text-primary-600 mt-0.5">Définit la période de saisie des notes</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {['1', '2', '3'].map((t) => (
                            <button
                              key={t}
                              onClick={() => handleUpdateConfig('current_trimestre', t)}
                              className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                                schoolConfig.current_trimestre === t
                                  ? 'bg-primary-600 text-white shadow-md'
                                  : 'bg-white text-gray-500 hover:bg-white/80'
                              }`}
                            >
                              T{t}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Année Scolaire */}
                      <div className="p-6 bg-gold-50/50 rounded-2xl border border-gold-100">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-gold-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-gold-100">
                            <Calendar size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gold-900 leading-tight">Année Scolaire</p>
                            <p className="text-xs text-gold-600 mt-0.5">Année en cours de consultation</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            placeholder="Ex: 2025-2026"
                            value={schoolConfig.current_year}
                            onChange={(e) => handleUpdateConfig('current_year', e.target.value)}
                            onBlur={(e) => handleUpdateConfig('current_year', e.target.value)}
                            className="w-full p-3 rounded-xl bg-white border-transparent font-bold text-gray-700 shadow-sm focus:ring-2 focus:ring-gold-300"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
                      <AlertCircle className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
                      <p className="text-xs text-amber-700 leading-relaxed">
                        <strong>Note :</strong> Le changement de trimestre ou d'année scolaire remet les compteurs à zéro sur les tableaux de bord pour la saisie. Les anciennes données sont conservées et restent consultables via les archives.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setFormData({}); }}
        title={`${editItem ? 'Modifier' : 'Ajouter'} ${{ classes: 'une classe', matieres: 'une matière', students: 'un élève', teachers: 'un professeur' }[modalType] || ''
          }`}>
        {renderModalForm()}
      </Modal>

      {/* Modal Succès Identifiants */}
      <Modal isOpen={showCredsModal} onClose={() => setShowCredsModal(false)} 
        title={newTeacherCreds?.isStudent ? "✨ Élève Enregistré" : "✨ Compte Professeur Créé"}>
        <div className="py-2 text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <CheckCircle size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Identifiants de connexion</h3>
          <p className="text-sm text-gray-500 mb-6">Veuillez noter ces informations pour le professeur :</p>

          <div className="space-y-3 mb-8">
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-left">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                {newTeacherCreds?.isStudent ? 'Matricule (Identifiant)' : 'Email (Identifiant)'}
              </p>
              <div className="flex items-center justify-between">
                <code className="text-sm font-mono font-bold text-primary-700">{newTeacherCreds?.email.replace('Matricule: ', '')}</code>
                <button onClick={() => { navigator.clipboard.writeText(newTeacherCreds?.email); showNotif('Email copié !'); }}
                  className="p-1.5 hover:bg-white rounded-lg transition-colors text-gray-400">
                  <Plus size={14} className="rotate-45" /> {/* Use Plus rotated for "copy" feel if no icons */}
                </button>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-left">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                {newTeacherCreds?.isStudent ? 'Code PIN Parent' : 'Mot de passe provisoire'}
              </p>
              <div className="flex items-center justify-between">
                <code className="text-sm font-mono font-bold text-gray-900">{newTeacherCreds?.password.replace('PIN Parent: ', '')}</code>
                <button onClick={() => { navigator.clipboard.writeText(newTeacherCreds?.password); showNotif('Mot de passe copié !'); }}
                  className="p-1.5 hover:bg-white rounded-lg transition-colors text-gray-400">
                  <Plus size={14} className="rotate-45" />
                </button>
              </div>
            </div>
          </div>

          <Button variant="primary" onClick={() => setShowCredsModal(false)} className="w-full py-4 shadow-lg shadow-primary-100">
            J'ai bien noté les informations
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default AdminDashboard;
