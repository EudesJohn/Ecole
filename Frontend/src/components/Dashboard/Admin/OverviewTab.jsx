import { motion } from 'framer-motion';
import { Users, GraduationCap, BookOpen, Award } from 'lucide-react';
import { StatCard } from './StatCard';
import GradeCalculator from '../../../utils/GradeCalculator';
import { Button } from '../../UI/Button';

export const OverviewTab = ({ data, setActiveTab }) => {
  const { classes, students, teachers, matieres, grades, schoolConfig } = data;
  const currentTrimestre = parseInt(schoolConfig.current_trimestre);

  // Stats calculation
  const classPerformance = (classes || []).map(cls => {
    const classStudents = (students || []).filter(s => s.classe_id === cls.id);
    if (classStudents.length === 0) return { ...cls, success: 0, fail: 0, rate: 0 };

    let success = 0;
    let fail = 0;

    classStudents.forEach(student => {
      const studentGrades = (grades || []).filter(g => g.student_id === student.id && g.trimestre === currentTrimestre);
      if (studentGrades.length === 0) return;

      const moyennesMatieres = studentGrades.map(g => {
        return GradeCalculator.getMoyenneByCycle(g, cls.cycle);
      }).filter(m => !isNaN(m));

      if (moyennesMatieres.length === 0) return;

      const avg = GradeCalculator.calculateMoyennePondere(moyennesMatieres, studentGrades.map(() => 1));
      if (avg >= 10) success++;
      else fail++;
    });

    const rate = Math.round((success / classStudents.length) * 100);
    return { ...cls, success, fail, rate };
  });

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <StatCard icon={Users} label="Élèves" value={students.length} color="bg-blue-600" delay={0.1} />
        <StatCard icon={GraduationCap} label="Profs" value={teachers.length} color="bg-emerald-600" delay={0.2} />
        <StatCard icon={BookOpen} label="Classes" value={classes.length} color="bg-indigo-600" delay={0.3} />
        <StatCard icon={Award} label="Matières" value={matieres.length} color="bg-gold-500" delay={0.4} />
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-display font-black text-slate-800 flex items-center gap-3">
          <div className="w-2 h-6 bg-emerald-500 rounded-full" />
          Réussite par Salle
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classPerformance.map((cls, idx) => (
            <motion.div 
              key={cls.id} 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card-pro p-6 border-l-4 border-l-emerald-500 hover:shadow-xl transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">{cls.nom}</h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{cls.cycle || 'Secondaire'}</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-600">{cls.rate}%</span>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Succès</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${cls.rate}%` }} />
                </div>
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-emerald-600">{cls.success} Admis</span>
                  <span className="text-red-500">{cls.fail} Échecs</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="glass-card-pro p-8">
         <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-display font-black text-slate-900 flex items-center gap-3">
              <div className="w-2 h-6 bg-blue-600 rounded-full" />
              Derniers élèves inscrits
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('eleves')} className="text-primary-600 text-xs font-bold">
              Voir tout
            </Button>
         </div>
         <div className="space-y-4">
            {students.slice(0, 3).map((s) => (
              <div key={s.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-primary-600 font-black text-xs">
                  {(s.prenom || 'E')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm">{s.prenom} {s.nom}</p>
                  <p className="text-[10px] text-slate-400 font-mono italic">{s.matricule} · {s.classe || 'N/A'}</p>
                </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};
