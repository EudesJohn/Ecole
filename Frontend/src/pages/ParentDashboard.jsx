import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import BottomNav from '../components/UI/BottomNav';
import SkeletonLoader from '../components/UI/SkeletonLoader';
import { Button } from '../components/UI/Button';
import { motion } from 'framer-motion';
import GradeCalculator from '../utils/GradeCalculator';
import { downloadBulletin, generateQRDataUrl } from '../utils/bulletinTasks';
import { supabase } from '../supabase';
import {
  BookOpen, FileText, Bell, AlertTriangle, Download, Award, Clock,
  LogOut, GraduationCap, CheckCircle, XCircle, ClipboardCheck, Loader2
} from 'lucide-react';

const ParentDashboard = () => {
  const { studentData, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [cahierEntries, setCahierEntries] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [moyenneGenerale, setMoyenneGenerale] = useState(0);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [schoolConfig, setSchoolConfig] = useState({ current_trimestre: '1', current_year: '2025-2026' });
  const [selectedTrimestre, setSelectedTrimestre] = useState('1');
  const [stats, setStats] = useState({ effectif: 0, rang: null, max_moyenne: null, min_moyenne: null });
  const [history, setHistory] = useState({ 1: null, 2: null, 3: null });

  // 1. Initial Load: Fetch School Config once
  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase.from('school_config').select('*');
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

      // 2. Fetch Grades for SELECTED TRIMESTRE and YEAR
      const { data: gradesData } = await supabase
        .from('grades')
        .select('*, matieres(nom)')
        .eq('student_id', studentData.id)
        .eq('trimestre', parseInt(selectedTrimestre))
        .eq('school_year', schoolConfig.current_year);

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

      // 4. Fetch Cahier de Texte for Current Year
      const { data: cahierData } = await supabase
        .from('cahier_texte')
        .select('*, matieres(nom)')
        .eq('classe_id', studentData.classe_id)
        .eq('school_year', schoolConfig.current_year)
        .order('date', { ascending: false })
        .limit(10);

      setCahierEntries(cahierData?.map(d => ({ ...d, matiere: d.matieres?.nom })) || []);

      // 5. Fetch Detailed Stats for the Stats Cards AND ALL TRIMESTRES for history
      const fetchHistoryStats = async (t) => {
        console.log(`🔍 Tentative de récupération des stats Archive T${t} pour l'année: ${schoolConfig.current_year}...`);
        const { data, error } = await supabase.rpc('get_detailed_stats', {
          p_student_id: studentData.id,
          p_trimestre: parseInt(t),
          p_school_year: schoolConfig.current_year
        });
        if (error) console.error(`❌ Erreur Archive T${t}:`, error);
        if (data) console.log(`📊 Résultat Archive T${t}:`, data);
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
      formattedGrades.forEach(g => {
        const moy = GradeCalculator.calculateSubjectAverage(g.interro1, g.interro2, g.interro3, g.devoir, g.composition);
        if (moy < 10) newAlerts.push({ matiere: g.matiere, moyenne: moy.toFixed(1), message: `⚠️ ${g.matiere} — ${moy.toFixed(1)}/20` });
      });
      setAlerts(newAlerts);

      if (formattedGrades.length > 0) {
        const moyennes = formattedGrades.map(g => GradeCalculator.calculateSubjectAverage(g.interro1, g.interro2, g.interro3, g.devoir, g.composition));
        const coeffs = formattedGrades.map(g => {
          const mat = (mats || []).find(m => m.id === g.matiere_id);
          return mat ? parseFloat(mat.coefficient) || 1 : 1;
        });
        setMoyenneGenerale(GradeCalculator.calculateMoyennePondere(moyennes, coeffs));
      } else {
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
        alert('Données de statistiques indisponibles.');
        setGeneratingPdf(false);
        return;
      }

      // 2. Préparer les notes à partir de l'état local (très fiable) enrichi avec les min/max
      // On s'assure que chaque note a ses records de classe (max/min)
      const subjectStats = Array.isArray(statsData.subject_stats) ? statsData.subject_stats : [];
      
      const gradesBySubject = grades.map(g => {
        const s = subjectStats.find(ss => ss.matiere_id === g.matiere_id) || {};
        return {
          matiere: g.matiere,
          matiere_id: g.matiere_id,
          interro1: g.interro1,
          interro2: g.interro2,
          interro3: g.interro3,
          devoir: g.devoir,
          composition: g.composition,
          max: s.max || 0,
          min: s.min || 0
        };
      });

      if (gradesBySubject.length === 0) {
        alert("Aucune note n'a été trouvée pour cet élève.");
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

      const qrCodeDataUrl = await generateQRDataUrl(`https://saintlambert.bj/verify/${encodeURIComponent(studentData.matricule)}/${selectedTrimestre}/${schoolConfig.current_year}`);

      await downloadBulletin({
        student: { ...studentData, dateNaissance: studentData.date_naissance },
        gradesBySubject: gradesBySubject, // Notes enrichies avec records de classe
        matieres,
        classStats: classStats,
        qrCodeDataUrl,
        trimestre: `${selectedTrimestre}${selectedTrimestre === '1' ? 'er' : 'ème'}`,
        schoolYear: schoolConfig.current_year
      });
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la génération: ' + err.message);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-primary-50/20 pb-24">
      {/* Header */}
      <div className="bg-royal-gradient p-6 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-10 w-40 h-40 border border-white/30 rounded-full" />
          <div className="absolute bottom-0 left-10 w-60 h-60 border border-white/20 rounded-full" />
        </div>
        <div className="relative z-10 flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-gold-300" />
            </div>
            <span className="text-white/90 font-display font-bold">Saint Lambert</span>
          </div>
          <button onClick={logout} className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-white/70 hover:bg-white/20 transition">
            <LogOut size={18} />
          </button>
        </div>
        <div className="relative z-10">
          <p className="text-primary-200 text-sm">Bienvenue</p>
          <h1 className="text-2xl font-display font-bold text-white">{studentData.prenom} {studentData.nom}</h1>
          <p className="text-primary-200 text-xs mt-1 font-mono">{studentData.matricule} · {studentData.classe}</p>
        </div>
      </div>

      {/* Trimester Selector (Archive) */}
      <div className="px-4 -mt-4 mb-6 relative z-20">
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-1 shadow-xl flex gap-1 border border-white">
          {['1', '2', '3'].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTrimestre(t)}
              className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                selectedTrimestre === t
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-200'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              Tri. {t}
              {schoolConfig.current_trimestre === t && (
                <span className="w-1.5 h-1.5 bg-gold-400 rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 -mt-10 relative z-10 mb-6">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-4 shadow-glass text-center">
            <p className="text-2xl font-display font-bold text-primary-500">{moyenneGenerale || '—'}</p>
            <p className="text-xs text-gray-500 mt-0.5">Moyenne</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-4 shadow-glass text-center border-l-4 border-gold-400">
            <p className="text-2xl font-display font-bold text-gold-500">{stats.rang || '—'}/{stats.effectif || '—'}</p>
            <p className="text-xs text-gray-500 mt-0.5">Rang du Trimestre</p>
          </motion.div>
        </div>
      </div>

      {/* Annual Progression Table */}
      <div className="mx-4 mb-6">
        <h3 className="text-sm font-display font-bold text-gray-800 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award size={16} className="text-primary-500" /> Bilan de l'Année
          </div>
          <span className="text-[10px] text-gray-400 font-normal uppercase tracking-wider">{schoolConfig.current_year}</span>
        </h3>
        <div className="bg-white rounded-2xl shadow-glass overflow-hidden">
          <div className="grid grid-cols-4 bg-gray-50/50 p-3 text-[10px] font-bold text-gray-400 uppercase tracking-tighter text-center">
            <div className="text-left">Période</div>
            <div>Moy.</div>
            <div>Rang</div>
            <div className="text-right">Statut</div>
          </div>
          <div className="divide-y divide-gray-50">
            {[1, 2, 3].map((t) => {
              const tData = history[t];
              const isActive = selectedTrimestre === String(t);
              return (
                <div key={t} onClick={() => setSelectedTrimestre(String(t))} 
                     className={`grid grid-cols-4 p-3 items-center cursor-pointer transition-colors ${isActive ? 'bg-primary-50/30' : 'hover:bg-gray-50/50'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-primary-500 animate-pulse' : 'bg-gray-200'}`} />
                    <span className={`text-xs font-bold ${isActive ? 'text-primary-600' : 'text-gray-600'}`}>T{t}</span>
                  </div>
                  <div className="text-center font-display font-bold text-gray-700 text-xs">
                    {tData?.moyenne_generale !== undefined ? tData.moyenne_generale.toFixed(2) : '—'}
                  </div>
                  <div className="text-center text-[10px] font-bold text-gray-500">
                    {tData?.rang ? `${tData.rang}/${tData.effectif}` : '—'}
                  </div>
                  <div className="text-right">
                    {tData?.moyenne_generale >= 10 ? (
                      <span className="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold">Passage</span>
                    ) : tData?.moyenne_generale > 0 ? (
                      <span className="text-[9px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-bold">Insuf.</span>
                    ) : (
                      <span className="text-[9px] text-gray-300">N/A</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Appreciation */}
      {moyenneGenerale > 0 && (
        <div className="mx-4 mb-6 p-4 bg-white rounded-2xl shadow-glass flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${moyenneGenerale >= 14 ? 'bg-emerald-100' : moyenneGenerale >= 10 ? 'bg-gold-100' : 'bg-red-100'}`}>
            <Award className={`w-5 h-5 ${moyenneGenerale >= 14 ? 'text-emerald-600' : moyenneGenerale >= 10 ? 'text-gold-600' : 'text-red-600'}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{appreciation}</p>
            <p className="text-xs text-gray-400">Appréciation générale</p>
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mx-4 mb-6 space-y-2">
          <h3 className="text-sm font-display font-bold text-gray-800 flex items-center gap-2">
            <Bell size={16} className="text-red-500" /> Alertes
          </h3>
          {alerts.map((a, i) => (
            <div key={i} className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{a.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Grades */}
      <div className="mx-4 mb-6">
        <h3 className="text-sm font-display font-bold text-gray-800 mb-3 flex items-center gap-2">
          <BookOpen size={16} className="text-primary-500" /> Notes par matière
        </h3>
        {grades.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 shadow-glass text-center text-gray-400 text-sm">Aucune note</div>
        ) : grades.map((g, i) => {
          const moy = GradeCalculator.calculateSubjectAverage(g.interro1, g.interro2, g.interro3, g.devoir, g.composition);
          const isLow = moy < 10;
          return (
            <motion.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl p-4 shadow-glass mb-2">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-800">{g.matiere}</h4>
                <span className={`text-lg font-display font-bold ${isLow ? 'text-red-500' : 'text-primary-500'}`}>{moy.toFixed(1)}/20</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[['I1', g.interro1], ['I2', g.interro2], ['I3', g.interro3], ['Dev', g.devoir], ['Comp', g.composition]].map(([label, val]) => (
                  <div key={label} className="text-center p-1.5 bg-gray-50 rounded-lg">
                    <p className="text-[9px] text-gray-500">{label}</p>
                    <p className="text-xs font-bold text-gray-700">{val || '—'}</p>
                  </div>
                ))}
              </div>
              <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full ${isLow ? 'bg-red-400' : 'bg-primary-500'}`}
                  style={{ width: `${Math.min(moy / 20 * 100, 100)}%` }} />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Présences */}
      <div className="mx-4 mb-6">
        <h3 className="text-sm font-display font-bold text-gray-800 mb-3 flex items-center gap-2">
          <ClipboardCheck size={16} className="text-emerald-500" /> Suivi de présence
        </h3>
        <div className="bg-white rounded-2xl shadow-glass overflow-hidden">
          <div className="grid grid-cols-2 border-b border-gray-50">
            <div className="p-4 text-center">
              <p className="text-2xl font-display font-bold text-emerald-500">{totalPresent}</p>
              <p className="text-xs text-gray-500">Présences</p>
            </div>
            <div className="p-4 text-center border-l border-gray-50">
              <p className="text-2xl font-display font-bold text-red-500">{totalAbsences}</p>
              <p className="text-xs text-gray-500">Absences</p>
            </div>
          </div>
          {absences.length === 0 ? (
            <p className="text-center py-4 text-gray-400 text-sm">Aucune donnée de présence</p>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[250px] overflow-y-auto">
              {absences.map(ab => (
                <div key={ab.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{ab.date}</span>
                    {ab.classe && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{ab.classe}</span>}
                  </div>
                  {ab.status === 'present' ? (
                    <span className="badge-success text-[10px] flex items-center gap-1"><CheckCircle size={10} /> Présent</span>
                  ) : (
                    <span className="badge-danger text-[10px] flex items-center gap-1"><XCircle size={10} /> Absent</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="mx-4 mb-6">
        <h3 className="text-sm font-display font-bold text-gray-800 mb-3 flex items-center gap-2">
          <Clock size={16} className="text-gold-500" /> Activité récente
        </h3>
        {cahierEntries.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 shadow-glass text-center text-gray-400 text-sm">Aucune activité</div>
        ) : cahierEntries.slice(0, 10).map((entry) => (
          <div key={entry.id} className="bg-white rounded-2xl p-4 shadow-glass mb-2">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <BookOpen size={14} className="text-primary-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  Cours : <span className="font-bold text-primary-600">{entry.chapitre}</span>
                </p>
                {entry.matiere && <p className="text-xs text-gray-500 mt-0.5">{entry.matiere}</p>}
                {entry.resume && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{entry.resume}</p>}
                <p className="text-[10px] text-gray-300 mt-1">{entry.date} · {entry.heure}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Download Bulletin */}
      <div className="mx-4 mb-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-royal-gold rounded-2xl p-6 text-center">
          <FileText className="w-10 h-10 text-white/80 mx-auto mb-3" />
          <h3 className="text-lg font-display font-bold text-white mb-1">Bulletin Scolaire</h3>
          <p className="text-primary-200 text-xs mb-4">Téléchargez le bulletin officiel sécurisé</p>
          <Button variant="secondary" size="lg" icon={generatingPdf ? Loader2 : Download}
            loading={generatingPdf}
            onClick={handleDownloadBulletin}
            className="bg-white text-primary-600 hover:bg-gray-50">
            {generatingPdf ? 'Génération...' : 'Télécharger le PDF'}
          </Button>
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
};

export default ParentDashboard;
