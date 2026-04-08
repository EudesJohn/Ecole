import { motion } from 'framer-motion';
import { Search, Plus, Edit3, Trash2, Download, RefreshCw, Loader2, BookMarked, Key } from 'lucide-react';
import { Button } from '../../UI/Button';

export const EntityTable = ({
  items,
  columns,
  colName,
  searchTerm,
  setSearchTerm,
  onAdd,
  onEdit,
  onDelete,
  onReset,
  onExtraAction,
  extraActionIcon: ExtraIcon,
  extraActionLabel,
  generatingId,
  saving
}) => {
  const filteredItems = !searchTerm ? items : items.filter(item =>
    Object.values(item).some(v =>
      v != null && String(v).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher dans la liste..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-100 rounded-2xl text-sm focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          {colName === 'matieres' && items.length === 0 && onExtraAction && (
            <Button variant="ghost" icon={BookMarked} onClick={onExtraAction} disabled={saving} className="text-blue-600 font-bold">
              Générer par défaut
            </Button>
          )}
          {onAdd && (
            <Button variant="primary" icon={Plus} onClick={onAdd} className="rounded-2xl px-6">
              Ajouter {colName === 'students' ? 'un élève' : colName === 'teachers' ? 'un prof' : 'une classe'}
            </Button>
          )}
        </div>
      </div>

      <div className="glass-card-pro overflow-hidden border-slate-100/50 shadow-glass-lg">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100/50">
                {columns.map(col => (
                  <th key={col.key} className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] px-6 py-5">
                    {col.label}
                  </th>
                ))}
                <th className="text-right px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredItems.map((item, i) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="group hover:bg-slate-50/50 transition-colors"
                >
                  {columns.map(col => (
                    <td key={col.key} className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-700">
                        {col.render ? col.render(item) : item[col.key] || '—'}
                      </div>
                    </td>
                  ))}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                      {onExtraAction && ExtraIcon && colName !== 'matieres' && (
                        <button
                          onClick={() => onExtraAction(item)}
                          disabled={generatingId === item.id}
                          className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100"
                          title={extraActionLabel}
                        >
                          {generatingId === item.id ? <Loader2 size={16} className="animate-spin" /> : <ExtraIcon size={16} />}
                        </button>
                      )}
                      {onReset && (
                        <button
                          onClick={() => onReset(item)}
                          className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all border border-transparent hover:border-amber-100"
                          title="Réinitialiser les accès"
                        >
                          <Key size={16} />
                        </button>
                      )}
                      {onEdit && (
                        <button
                          onClick={() => onEdit(item)}
                          className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100"
                        >
                          <Edit3 size={16} />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(item.id)}
                          className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filteredItems.length === 0 && (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Search size={24} className="text-slate-300" />
              </div>
              <p className="text-slate-400 text-sm font-medium">Aucun résultat trouvé pour votre recherche</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
