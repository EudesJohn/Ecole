import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';

import { useAuth } from '../hooks/useAuth';
import { useSchool } from '../contexts/SchoolContext';
import BottomNav from '../components/UI/BottomNav';
import SkeletonLoader from '../components/UI/SkeletonLoader';
import { Button } from '../components/UI/Button';
import { motion } from 'framer-motion';
import GradeCalculator from '../utils/GradeCalculator';
import { downloadBulletin, generateQRDataUrl } from '../utils/bulletinTasks';
import { supabase } from '../supabase';
import {
  FileText, AlertTriangle, Download, Award,
  LogOut, GraduationCap, Loader2, BookOpen
} from 'lucide-react';

const ParentDashboard = () => {
  const { studentData, logout } = useAuth();
  const { school } = useSchool(); // Get school info from context
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [cahierEntries, setCahierEntries] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [moyenneGenerale, setMoyenneGenerale] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [totalCoeffs, setTotalCoeffs] = useState(0);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [schoolConfig, setSchoolConfig] = useState({ current_trimestre: '1', current_year: '2025-2026' });
  const [selectedTrimestre, setSelectedTrimestre] = useState('1');
  const [stats, setStats] = useState({ effectif: 0, rang: null, max_moyenne: null, min_moyenne: null });
  const [history, setHistory] = useState({ 1: null, 2: null, 3: null });
  const [availablePeriods, setAvailablePeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const isPrimary = ['primaire', 'maternelle'].includes(studentData?.cycle?.toLowerCase());

  // 1. Initial Load: Fetch School Config once
  useEffect(() => {
    const fetchConfig = async () => {
      if (!studentData?.school_id) return;
      // Filter by school_id so each school's parents see only their own config
      const { data } = await supabase
        .from('school_config')
        .select('*')
        .eq('school_id', studentData.school_id);
      if (data) {
        const configObj = data.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
        setSchoolConfig(prev => ({ ...prev, ...configObj }));
        // Only auto-select on FIRST load
        if (configObj.current_trimestre) {
          setSelectedTrimestre(configObj.current_trimestre);
        }
      }
    };
    if (studentData) fetchConfig();
  }, [studentData]);

  // 1b. Fetch Available Periods for Primary
  useEffect(() => {
    const fetchPeriods = async () => {
      if (!isPrimary || !studentData?.id) return;
      const { data } = await supabase
        .from('grades')
        .select('period_label')
        .eq('student_id', studentData.id)
        .order('created_at', { ascending: false });

      const periods = [...new Set((data || []).map(d => d.period_label))].filter(Boolean);
      setAvailablePeriods(periods);
      if (periods.length > 0 && !selectedPeriod) {
        setSelectedPeriod(periods[0]);
      }
    };
    fetchPeriods();
  }, [isPrimary, studentData, selectedTrimestre]);

  const loadStudentData = useCallback(async () => {
    if (!studentData?.id && !studentData?.matricule) return;
    setLoading(true);
    try {
      // 1. Fetch Matieres
      const { data: mats } = await supabase
        .from('matieres')
        .select('*')
        .eq('classe_id', studentData.classe_id);

      setMatieres(mats || []);

      // 2. Fetch Grades for SELECTED PERIOD and YEAR
      const query = supabase
        .from('grades')
        .select('*, matieres(nom)')
        .eq('student_id', studentData.id)
        .eq('school_year', schoolConfig.current_year)
        .eq('evaluation_type', 'composition');

      if (isPrimary && selectedPeriod) {
        query.eq('period_label', selectedPeriod);
      } else {
        query.eq('trimestre', parseInt(selectedTrimestre));
      }

      const { data: gradesData } = await query;

      const formattedGrades = (gradesData || []).map(g => ({
        ...g,
        matiere: g.matieres?.nom
      }));
      setGrades(formattedGrades);

      // 3. Fetch Absences for Current Year
      const { data: absData } = await supabase
        .from('absences')
        .select('*')
        .eq('student_id', studentData.id)
        .eq('school_year', schoolConfig.current_year)
        .order('date', { ascending: false });

      setAbsences(absData || []);

      // 4. Fetch Cahier de Texte for the student's class
      const { data: cahierData } = await supabase
        .from('cahier_texte')
        .select('*, matieres(nom), profiles(nom, prenom)')
        .eq('classe_id', studentData.classe_id)
        .eq('school_year', schoolConfig.current_year)
        .order('date', { ascending: false })
        .limit(30);

      setCahierEntries(cahierData?.map(d => ({
        ...d,
        matiere: d.matieres?.nom,
        teacherName: d.profiles ? `${d.profiles.prenom} ${d.profiles.nom}` : 'Professeur'
      })) || []);

      // 5. Fetch Detailed Stats for the Stats Cards AND ALL TRIMESTRES for history
      const fetchHistoryStats = async (t) => {

        const { data, error } = await supabase.rpc('get_detailed_stats', {
          p_student_id: studentData.id,
          p_trimestre: parseInt(t),
          p_school_year: schoolConfig.current_year,
          p_period_label: isPrimary ? selectedPeriod : null
        });
        if (error) console.error(`❌ Erreur Archive T${t}:`, error);

        return { trimestre: t, data };
      };

      const results = await Promise.all([1, 2, 3].map(t => fetchHistoryStats(t)));

      const historyMap = {};
      results.forEach(res => {
        if (res.data?.general_stats) {
          historyMap[res.trimestre] = res.data.general_stats;
        }
      });
      setHistory(historyMap);

      // Current Selected Stats
      const currentStats = historyMap[selectedTrimestre];
      if (currentStats) {
        setStats({
          effectif: currentStats.effectif || 0,
          rang: currentStats.rang || null,
          max_moyenne: currentStats.max_moyenne || null,
          min_moyenne: currentStats.min_moyenne || null
        });
      }

      // 6. Logic: Alerts & Moyenne
      const newAlerts = [];
      // const isPrimary = studentData.cycle === 'primaire' || studentData.cycle === 'maternelle';

      formattedGrades.forEach(g => {
        const moy = GradeCalculator.getMoyenneByCycle(g, studentData.cycle);

        if (moy < 10) newAlerts.push({ matiere: g.matiere, moyenne: moy.toFixed(1), message: `⚠️ ${g.matiere} — ${moy.toFixed(1)}/20` });
      });
      setAlerts(newAlerts);

      if (formattedGrades.length > 0) {
        const moyennes = formattedGrades.map(g => {
          return GradeCalculator.getMoyenneByCycle(g, studentData.cycle);
        });
        const coeffs = formattedGrades.map(g => {
          const mat = (mats || []).find(m => m.id === g.matiere_id);
          return mat ? parseFloat(mat.coefficient) || 1 : 1;
        });

        // Calculate Totals
        let tPoints = 0;
        let tCoeffs = 0;
        for (let i = 0; i < moyennes.length; i++) {
          tPoints += moyennes[i] * coeffs[i];
          tCoeffs += coeffs[i];
        }
        setTotalPoints(tPoints);
        setTotalCoeffs(tCoeffs);

        setMoyenneGenerale(GradeCalculator.calculateMoyennePondere(moyennes, coeffs));
      } else {
        setMoyenneGenerale(0);
        setTotalPoints(0);
        setTotalCoeffs(0);
        setMoyenneGenerale(0);
        // If no grades, we already have history, we can still set current stats if they exist (rank 00)
      }
    } catch (err) {
      console.error('Error loading parent dashboard data:', err);
    }
    setLoading(false);
  }, [studentData, selectedTrimestre, schoolConfig.current_year]);

  useEffect(() => {
    if (studentData) loadStudentData();
    else setLoading(false);
  }, [studentData, loadStudentData]);

  const handleDownloadBulletin = async () => {
    setGeneratingPdf(true);
    try {
      // 1. Récupérer les statistiques globales (Rang, Effectif, Moyenne classe)
      const { data: statsData, error: statsError } = await supabase.rpc('get_detailed_stats', {
        p_student_id: studentData.id,
        p_trimestre: parseInt(selectedTrimestre),
        p_school_year: schoolConfig.current_year
      });

      if (statsError) throw statsError;
      if (!statsData || !statsData.general_stats) {
        toast.error('Données de statistiques indisponibles.');
        setGeneratingPdf(false);
        return;
      }


      // 2. Préparer les notes à partir de l'état local enrichi avec les min/max issus du RPC
      const subjectStats = (statsData?.subject_stats) || [];

      const gradesBySubject = grades.map(g => {
        const s = subjectStats.find(ss => ss.matiere_id === g.matiere_id) || {};
        return {
          ...g,
          matiere: g.matiere,
          max: s.max || 0,
          min: s.min || 0
        };
      });

      if (gradesBySubject.length === 0) {
        toast.error("Aucune note n'a été trouvée pour cet élève.");
        setGeneratingPdf(false);
        return;
      }


      const classStats = {
        effectif: statsData.general_stats.effectif || 0,
        plusForte: statsData.general_stats.max_moyenne || null,
        plusFaible: statsData.general_stats.min_moyenne || null,
        studentAverage: statsData.general_stats.moyenne_generale || moyenneGenerale,
        rang: statsData.general_stats.rang || null
      };

      const qrCodeDataUrl = await generateQRDataUrl(`https://erp-ecole.bj/verify/${encodeURIComponent(studentData.matricule)}/${selectedTrimestre}/${schoolConfig.current_year}`);

      await downloadBulletin({
        student: { ...studentData, dateNaissance: studentData.date_naissance, cycle: studentData.cycle, sexe: studentData.sexe || '—' },
        gradesBySubject: gradesBySubject, // Notes enrichies avec records de classe
        matieres,
        classStats: classStats,
        qrCodeDataUrl,
        trimestre: `${selectedTrimestre}${selectedTrimestre === '1' ? 'er' : 'ème'}`,
        schoolYear: schoolConfig.current_year,
        schoolInfo: school
      });
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la génération: ' + err.message);
    }

    setGeneratingPdf(false);
  };

  if (!studentData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary-50 to-gold-50">
        <div className="glass-card-lg p-8 text-center max-w-sm">
          <AlertTriangle className="w-16 h-16 text-gold-500 mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold text-gray-900 mb-2">Session expirée</h2>
          <p className="text-gray-500 text-sm mb-6">Veuillez vous reconnecter avec le matricule.</p>
          <Button variant="primary" onClick={logout} className="w-full">Retour à la connexion</Button>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20"><SkeletonLoader type="card" count={4} /><BottomNav /></div>
  );

  const appreciation = GradeCalculator.getAppreciation(moyenneGenerale);
  const totalAbsences = absences.filter(a => a.status === 'absent').length;
  const totalPresent = absences.filter(a => a.status === 'present').length;

  // Dynamic school name from context
  const schoolName = school?.nom || 'École Saint Lambert';

  return (
    <div className="min-h-screen bg-[#fcfdfe] pb-24">
      {/* Header */}
      <div className="bg-royal-gradient p-8 pb-32 relative overflow-hidden rounded-b-[3rem] shadow-2xl">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-[-10%] right-[-10%] w-64 h-64 border-[0.5px] border-white/40 rounded-full" />
          <div className="absolute bottom-[-20%] left-[-10%] w-96 h-96 border-[0.5px] border-white/20 rounded-full" />
        </div>
        <div className="relative z-10 flex items-center justify-between mb-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
              <GraduationCap className="w-6 h-6 text-gold-300" />
            </div>
            <div>
              <span className="text-white/60 text-[10px] uppercase tracking-widest font-bold">Portail Parent</span>
              <h2 className="text-white font-display font-bold leading-none">{schoolName}</h2>
            </div>
          </motion.div>
          <button onClick={logout} className="w-11 h-11 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-white/70 hover:bg-white/20 transition-all border border-white/10">
            <LogOut size={20} />
          </button>
        </div>
        <div className="relative z-10">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <p className="text-blue-200/80 text-sm font-medium">Tableau de bord de</p>
            <h1 className="text-3xl md:text-4xl font-display font-black text-white tracking-tight">{studentData.prenom} {studentData.nom}</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 bg-gold-400/20 text-gold-300 rounded-md text-[10px] font-bold border border-gold-400/30 uppercase tracking-wider">{studentData.classe}</span>
              <span className="text-blue-200/40 font-mono text-[10px]">{studentData.matricule}</span>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="px-6 -mt-20 mb-8 relative z-30">
        <div className="glass-card-pro p-1.5 flex gap-1.5 overflow-x-auto custom-scrollbar no-scrollbar">
          {isPrimary ? (
            availablePeriods.length > 0 ? availablePeriods.map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`min-w-[120px] py-4 rounded-[1.5rem] text-xs font-black transition-all duration-500 whitespace-nowrap px-4 ${selectedPeriod === p
                    ? 'bg-royal-gradient text-white shadow-xl shadow-blue-900/20 scale-[1.02]'
                    : 'text-gray-400 hover:bg-gray-50'
                  }`}
              >
                {p}
              </button>
            )) : (
              <div className="flex-1 py-4 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Aucune composition enregistrée
              </div>
            )
          ) : (
            ['1', '2', '3'].map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTrimestre(t)}
                className={`flex-1 py-4 rounded-[1.5rem] text-xs font-black transition-all duration-500 flex items-center justify-center gap-2 ${selectedTrimestre === t
                    ? 'bg-royal-gradient text-white shadow-xl shadow-blue-900/20 scale-[1.02]'
                    : 'text-gray-400 hover:bg-gray-50'
                  }`}
              >
                Trimestre {t}
                {schoolConfig.current_trimestre === t && (
                  <span className="w-2 h-2 bg-gold-400 rounded-full animate-pulse shadow-[0_0_10px_#fbbf24]" />
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Stats Bento Grid */}
      <div className="px-6 mb-8 grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bento-item border-l-4 border-blue-600 bg-white shadow-glass-pro"
        >
          <div className="flex items-start justify-between">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Award className="text-blue-600" size={16} />
            </div>
            <span className="text-[10px] font-bold text-blue-600 uppercase">Moyenne</span>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-1">
              <p className="text-4xl font-display font-black text-slate-900 leading-none">{moyenneGenerale || '00.0'}</p>
              <span className="text-sm font-bold text-slate-300">/20</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-medium italic">
              Points: {totalPoints.toFixed(2)} / {totalCoeffs * 20}
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bento-item border-l-4 border-gold-400 bg-white shadow-glass-pro"
        >
          <div className="flex items-start justify-between">
            <div className="w-8 h-8 bg-gold-50 rounded-lg flex items-center justify-center">
              <GraduationCap className="text-gold-600" size={16} />
            </div>
            <span className="text-[10px] font-bold text-gold-600 uppercase">Position</span>
          </div>
          <div className="mt-4">
            <p className="text-4xl font-display font-black text-slate-900 leading-none">
              {stats.rang || '00'}<span className="text-lg text-slate-300 font-bold">/{stats.effectif || '00'}</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium italic">Rang de la classe</p>
          </div>
        </motion.div>
      </div>

      {/* Annual Progression Table */}
      <div className="mx-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-display font-black text-slate-800 flex items-center gap-2">
            <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
            Bilan de l&apos;Année
          </h3>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{schoolConfig.current_year}</span>
        </div>
        <div className="glass-card-pro overflow-hidden border-slate-100/50">
          <div className="grid grid-cols-4 bg-slate-50/50 p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100/50">
            <div className="text-left">Période</div>
            <div className="text-center">Moy.</div>
            <div className="text-center">Rang</div>
            <div className="text-right">Statut</div>
          </div>
          <div className="divide-y divide-slate-100/50">
            {[1, 2, 3].map((t) => {
              const tData = history[t];
              const isActive = selectedTrimestre === String(t);
              return (
                <div key={t} onClick={() => setSelectedTrimestre(String(t))}
                  className={`grid grid-cols-4 p-4 items-center cursor-pointer transition-all duration-300 ${isActive ? 'bg-blue-50/40' : 'hover:bg-slate-50/30'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-blue-600 shadow-[0_0_8px_#2563eb]' : 'bg-slate-200'}`} />
                    <span className={`text-xs font-black ${isActive ? 'text-blue-700' : 'text-slate-600'}`}>Trimestre {t}</span>
                  </div>
                  <div className="text-center font-display font-bold text-slate-900 text-sm">
                    {tData?.moyenne_generale != null ? Number(tData.moyenne_generale).toFixed(2) : '--.--'}
                  </div>
                  <div className="text-center text-[10px] font-bold text-slate-400">
                    {tData?.rang ? `${tData.rang}/${tData.effectif}` : '--/--'}
                  </div>
                  <div className="text-right">
                    {tData?.moyenne_generale >= 10 ? (
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-[9px] font-black uppercase tracking-tighter border border-emerald-100">Admis</span>
                    ) : tData?.moyenne_generale > 0 ? (
                      <span className="px-2 py-1 bg-red-50 text-red-600 rounded-md text-[9px] font-black uppercase tracking-tighter border border-red-100">Rattrap.</span>
                    ) : (
                      <span className="text-[10px] text-slate-300 font-bold">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Appreciation & Alerts */}
      <div className="px-6 mb-8 space-y-4">
        {moyenneGenerale > 0 && (
          <div className="glass-card-pro p-5 border-l-4 border-blue-600 flex items-center gap-4 bg-white">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${moyenneGenerale >= 14 ? 'bg-emerald-50 text-emerald-600' : moyenneGenerale >= 10 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
              <Award size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-0.5">Appréciation globale</p>
              <h4 className="text-sm font-black text-slate-900 uppercase">{appreciation}</h4>
            </div>
          </div>
        )}

        {alerts.length > 0 && alerts.map((a, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            className="p-4 bg-red-50/50 backdrop-blur-sm border border-red-100 rounded-[1.5rem] flex items-center gap-4">
            <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-red-200">
              <AlertTriangle size={20} />
            </div>
            <p className="text-xs font-bold text-red-700 leading-tight">{a.message}</p>
          </motion.div>
        ))}
      </div>

      {/* Grades Grid */}
      <div className="px-6 mb-8">
        <h3 className="text-sm font-display font-black text-slate-800 mb-5 flex items-center gap-2">
          <div className="w-1.5 h-4 bg-indigo-600 rounded-full" />
          Notes par matière
        </h3>
        {grades.length === 0 ? (
          <div className="glass-card-pro p-10 text-center">
            <p className="text-slate-400 text-sm font-medium">Aucune note n&apos;a été enregistrée pour ce trimestre.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {grades.map((g, i) => {
              // const isPrimary = studentData.cycle === 'primaire' || studentData.cycle === 'maternelle';
              const moy = GradeCalculator.getMoyenneByCycle(g, studentData.cycle);
              const isLow = moy < 10;
              return (
                <motion.div
                  key={g.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card-pro p-5 bg-white border-slate-100 hover:scale-[1.01] hover:shadow-glass-lg"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-black text-slate-800 text-sm uppercase tracking-tight">{g.matiere}</h4>
                      <p className="text-[10px] text-slate-400 font-bold">Coefficient : {g.coefficient || 1}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-2xl font-display font-black ${isLow ? 'text-red-500' : 'text-blue-600'}`}>{moy.toFixed(1)}</span>
                      <span className="text-[10px] text-slate-300 font-black ml-0.5">/20</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                    {['primaire', 'maternelle'].includes(studentData.cycle?.toLowerCase()) ? (
                      /* Simplified Monthly View */
                      <>
                        {g.composition !== null && g.composition !== undefined && g.composition !== '' && (
                          <div className="text-center p-2 bg-gold-50 border border-gold-100 rounded-xl">
                            <p className="text-[8px] font-black tracking-widest mb-1 uppercase text-gold-500">Composition</p>
                            <p className="text-[11px] font-black text-gold-700">{g.composition}</p>
                          </div>
                        )}
                        {(g.note_cm || g.note_cp) && (
                          <div className="text-center p-2 bg-blue-50 rounded-xl border border-blue-100">
                            <p className="text-[8px] text-blue-400 font-black tracking-widest mb-1 uppercase">Étapes</p>
                            <p className="text-[11px] font-black text-blue-700">
                              {GradeCalculator.calculateStepGrade(g.note_cm, g.note_cp).toFixed(2)}
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      /* Secondary System */
                      <>
                        {['interro1', 'interro2', 'interro3'].map((field, idx) => (
                          g[field] !== null && g[field] !== undefined && g[field] !== '' && (
                            <div key={field} className="text-center p-2 bg-slate-50 border border-slate-100/50 rounded-xl">
                              <p className="text-[8px] font-black tracking-widest mb-1 uppercase text-slate-400">I{idx + 1}</p>
                              <p className="text-[11px] font-black text-slate-700">{g[field]}</p>
                            </div>
                          )
                        ))}
                        <div className="text-center p-2 bg-primary-50 rounded-xl border border-primary-100">
                          <p className="text-[8px] text-primary-500 font-black tracking-widest mb-1 uppercase">DW</p>
                          <p className="text-[11px] font-black text-primary-700">{g.dw || '--'}</p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="relative h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(moy / 20) * 100}%` }}
                      transition={{ duration: 1, delay: i * 0.1 }}
                      className={`h-full rounded-full ${isLow ? 'bg-red-400' : 'bg-blue-600'}`}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Attendance & Recent Activity */}
      <div className="px-6 mb-8 grid grid-cols-1 gap-6">
        <div className="glass-card-pro p-6">
          <h3 className="text-sm font-display font-black text-slate-800 mb-5 flex items-center gap-2">
            <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
            Suivi de Présence
          </h3>
          <div className="flex bg-slate-50/50 rounded-2xl overflow-hidden mb-6 border border-slate-100/50">
            <div className="flex-1 p-4 text-center border-r border-slate-100/50">
              <p className="text-3xl font-black text-emerald-600 leading-none">{totalPresent}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Présences</p>
            </div>
            <div className="flex-1 p-4 text-center">
              <p className="text-3xl font-black text-red-500 leading-none">{totalAbsences}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Absences</p>
            </div>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {absences.map(ab => (
              <div key={ab.id} className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all active:scale-[0.98]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black text-slate-400 font-display flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-slate-200" />
                    {new Date(ab.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                    ab.status === 'present' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    : ab.status === 'absent' ? 'bg-red-50 text-red-600 border border-red-100'
                    : 'bg-amber-50 text-amber-600 border border-amber-100'
                  }`}>
                    {ab.status}
                  </span>
                </div>
                {ab.commentaire && (
                  <div className="mt-3 p-3 bg-blue-50/50 rounded-xl border-l-4 border-blue-400">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 italic">Note du professeur</p>
                    <p className="text-[11px] font-bold text-slate-600 leading-relaxed">{ab.commentaire}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cahier de Texte */}
      <div className="px-6 mb-8">
        <div className="glass-card-pro p-6">
          <h3 className="text-sm font-display font-black text-slate-800 mb-5 flex items-center gap-2">
            <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
            Cahier de Texte
          </h3>
          {cahierEntries.length === 0 ? (
            <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-slate-100/50">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-medium">Aucune leçon enregistrée pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
              {cahierEntries.map((entry) => (
                <div key={entry.id} className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[9px] font-black uppercase tracking-wider border border-indigo-100">
                          {entry.matiere || 'Matière'}
                        </span>
                        {entry.heure && (
                          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 1118 0z" />
                            </svg>
                            {entry.heure}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] font-bold text-slate-800 leading-tight">
                        {entry.chapitre}
                      </p>
                      {entry.resume && (
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{entry.resume}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="text-[10px] font-bold text-slate-400">
                        {new Date(entry.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </p>
                      {entry.teacherName && (
                        <p className="text-[8px] text-slate-300 mt-0.5">{entry.teacherName}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Final Action: Download */}
      <div className="px-6 mb-12">
        <motion.div
          whileTap={{ scale: 0.98 }}
          className="bg-royal-gold p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group text-center"
        >
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/20 shadow-inner group-hover:rotate-12 transition-transform">
              <FileText className="text-white" size={32} />
            </div>
            <h3 className="text-2xl font-display font-black text-white mb-2 tracking-tight">Bulletin Officiel</h3>
            <p className="text-blue-200/60 text-[10px] font-bold uppercase tracking-widest mb-8">Téléchargement Sécurisé (QR Code)</p>
            <Button
              variant="white"
              size="lg"
              icon={generatingPdf ? Loader2 : Download}
              loading={generatingPdf}
              onClick={handleDownloadBulletin}
              className="w-full py-6 rounded-2xl font-black text-blue-900 shadow-xl"
            >
              TÉLÉCHARGER LE PDF
            </Button>
          </div>
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
};

export default ParentDashboard;