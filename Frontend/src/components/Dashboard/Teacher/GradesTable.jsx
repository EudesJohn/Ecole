import GradeCalculator from '../../../utils/GradeCalculator';
import { Button } from '../../UI/Button';
import { Save, Check } from 'lucide-react';

export const GradesTable = ({ 
  students, 
  grades, 
  updateGrade, 
  isPrimary, 
  evaluationType, 
  setEvaluationType, 
  onSave, 
  saving 
}) => {
  // Force composition for primary/maternelle
  const effectiveEvalType = isPrimary ? 'composition' : evaluationType;

  return (
    <div className="space-y-6">
      {isPrimary && (
        <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-800">Saisie des Compositions</h3>
            <p className="text-xs text-slate-400 font-medium">Cycle Primaire / Maternelle</p>
          </div>
          <Button variant="primary" icon={Check} onClick={onSave} loading={saving}>
            Enregistrer les compositions
          </Button>
        </div>
      )}
      
      {!isPrimary && (
        <div className="flex justify-end mb-4">
           <Button variant="primary" icon={Save} onClick={onSave} loading={saving}>Enregistrer les notes</Button>
        </div>
      )}
      
      <div className="glass-card overflow-hidden shadow-glass-lg">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="text-left text-[11px] font-bold text-gray-400 uppercase px-6 py-4">Élève</th>
                {['I 1', 'I 2', 'I 3'].map(i => <th key={i} className="px-2 py-4 text-center text-[10px] font-bold text-gray-400 uppercase">{i}</th>)}
                {isPrimary ? (
                  <th className="px-2 py-4 text-center text-[10px] font-bold text-gold-600 uppercase tracking-widest">Composition</th>
                ) : (
                  <>
                    <th className="px-2 py-4 text-center text-[10px] font-bold text-primary-500 uppercase">DW</th>
                    <th className="px-2 py-4 text-center text-[10px] font-bold text-gold-600 uppercase">D 1</th>
                    <th className="px-2 py-4 text-center text-[10px] font-bold text-gold-600 uppercase">D 2</th>
                  </>
                )}
                <th className="px-6 py-4 text-center text-[11px] font-bold text-gray-500 uppercase tracking-widest">Moyenne</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {students.map(s => {
                const sg = grades[s.id] || {};
                const moy = isPrimary 
                  ? (parseFloat(sg.composition) || 0)
                  : GradeCalculator.calculateSubjectAverage(sg.interro1, sg.interro2, sg.interro3, sg.dw, sg.d1, sg.d2);

                return (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-800">{s.prenom} {s.nom}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{s.matricule}</p>
                    </td>
                    {['interro1', 'interro2', 'interro3'].map(f => (
                      <td key={f} className="px-1 py-2 text-center">
                        <input type="number" step="0.25" min="0" max="20"
                          value={sg[f] ?? ''}
                          onChange={(e) => updateGrade(s.id, f, e.target.value)}
                          className="w-12 h-9 text-center text-sm rounded-lg border border-slate-200 focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all" />
                      </td>
                    ))}
                    {isPrimary ? (
                      <td className="px-1 py-2 text-center">
                        <input type="number" step="0.25" min="0" max="20"
                          value={sg.composition ?? ''}
                          onChange={(e) => updateGrade(s.id, 'composition', e.target.value)}
                          className="w-24 h-9 text-center text-sm rounded-lg border border-gold-200 bg-gold-50/30 font-black text-gold-700 focus:ring-4 focus:ring-gold-100" />
                      </td>
                    ) : (
                      <>
                        <td className="px-1 py-2 text-center">
                          <input type="number" step="0.25" min="0" max="20"
                            value={sg.dw ?? ''}
                            onChange={(e) => updateGrade(s.id, 'dw', e.target.value)}
                            className="w-12 h-9 text-center text-sm rounded-lg border border-blue-50 bg-blue-50/20" />
                        </td>
                        <td className="px-1 py-2 text-center">
                          <input type="number" step="0.25" min="0" max="20"
                            value={sg.d1 ?? ''}
                            onChange={(e) => updateGrade(s.id, 'd1', e.target.value)}
                            className="w-12 h-9 text-center text-sm rounded-lg border border-gold-100 bg-gold-50/20" />
                        </td>
                        <td className="px-1 py-2 text-center">
                          <input type="number" step="0.25" min="0" max="20"
                            value={sg.d2 ?? ''}
                            onChange={(e) => updateGrade(s.id, 'd2', e.target.value)}
                            className="w-12 h-9 text-center text-sm rounded-lg border border-gold-100 bg-gold-50/20" />
                        </td>
                      </>
                    )}
                    <td className="px-6 py-4 text-center">
                      <span className={`text-sm font-black ${moy < 10 ? 'text-red-500' : 'text-blue-600'}`}>
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
