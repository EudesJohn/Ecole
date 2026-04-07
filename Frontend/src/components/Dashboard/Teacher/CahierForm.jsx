import { Save, Clock, Trash2, Edit3 } from 'lucide-react';
import { Button } from '../../UI/Button';

export const CahierForm = ({ 
  form, 
  setForm, 
  onSubmit, 
  entries, 
  onEdit, 
  onDelete, 
  editId, 
  saving 
}) => {
  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div className="glass-card p-8 border-slate-100/50 shadow-glass-pro">
        <h3 className="text-xl font-display font-black text-slate-900 mb-6 flex items-center gap-3">
          <div className="w-2 h-6 bg-blue-500 rounded-full" />
          Nouveau contenu
        </h3>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-slb text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Début</label>
                <input type="time" value={form.h_debut} onChange={(e) => setForm({ ...form, h_debut: e.target.value })} className="input-slb text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Fin</label>
                <input type="time" value={form.h_fin} onChange={(e) => setForm({ ...form, h_fin: e.target.value })} className="input-slb text-sm" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Chapitre / Leçon</label>
            <input type="text" value={form.chapitre} onChange={(e) => setForm({ ...form, chapitre: e.target.value })}
              className="input-slb text-sm" placeholder="Ex: Les équations du premier degré" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Résumé du cours</label>
            <textarea value={form.resume} onChange={(e) => setForm({ ...form, resume: e.target.value })}
              className="input-slb min-h-[120px] resize-none text-sm" placeholder="Points abordés, devoirs donnés..." />
          </div>
          <Button variant="primary" icon={Save} onClick={onSubmit} loading={saving} className="w-full py-4 rounded-2xl shadow-lg shadow-blue-900/10">
            {editId ? 'Mettre à jour l&apos;entrée' : 'Enregistrer dans le cahier'}
          </Button>
        </div>
      </div>

      <div className="glass-card p-8 border-slate-100/50 shadow-glass-pro">
        <h3 className="text-xl font-display font-black text-slate-900 mb-6 flex items-center gap-3">
          <div className="w-2 h-6 bg-gold-400 rounded-full" />
          Historique récent
        </h3>
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          {entries.length === 0 ? (
            <div className="py-20 text-center text-slate-300">
               <Clock size={40} className="mx-auto mb-4 opacity-20" />
               <p className="text-sm font-medium">Aucun cours enregistré pour l&apos;instant.</p>
            </div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="p-5 rounded-[1.5rem] bg-slate-50 border border-white hover:bg-white hover:shadow-glass-lg transition-all group">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-white text-[10px] font-black text-slate-400 rounded-lg border border-slate-100">{entry.date}</span>
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{entry.matiere}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(entry)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => onDelete(entry.id, entry.created_at)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <h4 className="font-black text-slate-800 text-sm mb-1">{entry.chapitre}</h4>
                <p className="text-[11px] text-slate-400 lowercase mb-2">{entry.heure}</p>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{entry.resume}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
