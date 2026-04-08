import GradeCalculator from '../../../utils/GradeCalculator';
import { Button } from '../../UI/Button';
import { Save, Check } from 'lucide-react';

export const GradesTable = ({ 
  students, 
  grades, 
  updateGrade, 
  isPrimary, 
  coefficient,
  evaluationType, 
  setEvaluationType, 
  onSave, 
  saving 
}) => {
  return (
    <div className="space-y-6">
      <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-800">
            {isPrimary ? 'Saisie des Compositions' : 'Saisie des Notes'}
          </h3>
          <p className="text-xs text-slate-400 font-medium flex items-center gap-2">
            {isPrimary ? 'Cycle Primaire / Maternelle' : 'Cycle Secondaire'}
            <span className="w-1 h-1 bg-slate-300 rounded-full" />
            <span className="text-blue-600 font-black">Coefficient: {coefficient || 1}</span>
          </p>
        </div>
        <Button variant="primary" icon={isPrimary ? Check : Save} onClick={onSave} loading={saving}>
          {isPrimary ? 'Enregistrer les compositions' : 'Enregistrer les notes'}
        </Button>
      </div>

      <div className="glass-card overflow-hidden shadow-glass-lg">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="text-left text-[11px] font-bold text-gray-400 uppercase px-6 py-4">Élève</th>
                
                {/* Secondary specific columns */}
                {!isPrimary && ['I 1', 'I 2', 'I 3', 'DW', 'D 1', 'D 2'].map(i => (
                  <th key={i} className={`px-2 py-4 text-center text-[10px] font-bold uppercase ${i.startsWith('I') ? 'text-gray-400' : i === 'DW' ? 'text-primary-500' : 'text-gold-600'}`}>
                    {i}
                  </th>
                ))}

                {/* Primary specific columns */}
                {isPrimary && (
                  <th className="px-2 py-4 text-center text-[10px] font-bold text-gold-600 uppercase tracking-widest">Note</th>
                )}

                <th className="px-6 py-4 text-center text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                  {isPrimary ? 'Validation' : 'Moyenne'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {students.map(s => {
                const sg = grades[s.id] || {};
                const moy = GradeCalculator.getMoyenneByCycle(sg, isPrimary ? 'primaire' : 'secondaire');

                return (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-800">{s.prenom} {s.nom}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{s.matricule}</p>
                    </td>

                    {/* Secondary Inputs */}
                    {!isPrimary && ['interro1', 'interro2', 'interro3', 'dw', 'd1', 'd2'].map(f => (
                      <td key={f} className="px-1 py-2 text-center">
                        <input type="number" step="0.25" min="0" max="20"
                          value={sg[f] ?? ''}
                          onChange={(e) => updateGrade(s.id, f, e.target.value)}
                          className={`w-12 h-9 text-center text-sm rounded-lg border focus:bg-white focus:ring-4 outline-none transition-all ${
                            f.startsWith('interro') ? 'border-slate-200 focus:ring-blue-50' : 
                            f === 'dw' ? 'border-blue-50 bg-blue-50/20' : 'border-gold-100 bg-gold-50/20'
                          }`} 
                        />
                      </td>
                    ))}

                    {/* Primary Inputs */}
                    {isPrimary && (
                      <td className="px-1 py-2 text-center">
                        <input type="number" step="0.25" min="0" max="20"
                          value={sg.composition ?? ''}
                          onChange={(e) => updateGrade(s.id, 'composition', e.target.value)}
                          className="w-24 h-9 text-center text-sm rounded-lg border border-gold-200 bg-gold-50/30 font-black text-gold-700 focus:ring-4 focus:ring-gold-100" />
                      </td>
                    )}

                    <td className="px-6 py-4 text-center">
                      {isPrimary ? (
                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${moy >= 10 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                          {moy >= 10 ? 'Validé' : 'Échec'}
                        </span>
                      ) : (
                        <span className={`text-sm font-black ${moy < 10 ? 'text-red-500' : 'text-blue-600'}`}>
                          {moy.toFixed(2)}
                        </span>
                      )}
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
