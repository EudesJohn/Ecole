import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../../hooks/useAuth';
import { Trash2, AlertTriangle, Shield, Ban, CheckCircle, Loader2, Search, X } from 'lucide-react';

const EcolesTab = () => {
  const { user } = useAuth();
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchSchools = async () => {
    setLoading(true);
    setError('');
    try {
      const token = (await user?.getAccessToken?.()) || user?.access_token;
      const res = await fetch('/api/super-admin/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors du chargement');
      const data = await res.json();
      setSchools(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSchools(); }, []);

  const handleDelete = async (schoolId) => {
    try {
      const token = (await user?.getAccessToken?.()) || user?.access_token;
      const res = await fetch(`/api/super-admin/schools/${schoolId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSchools(prev => prev.filter(s => s.id !== schoolId));
      setConfirmDelete(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRestrict = async (schoolId, days) => {
    try {
      const token = (await user?.getAccessToken?.()) || user?.access_token;
      const res = await fetch(`/api/super-admin/schools/${schoolId}/restrict`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ days, reason: 'Restreint par super admin' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchSchools();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleActivate = async (schoolId) => {
    try {
      const token = (await user?.getAccessToken?.()) || user?.access_token;
      const res = await fetch(`/api/super-admin/schools/${schoolId}/activate`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchSchools();
    } catch (err) {
      setError(err.message);
    }
  };

  const filtered = schools.filter(s =>
    !search || s.nom?.toLowerCase().includes(search.toLowerCase()) ||
    s.abreviation?.toLowerCase().includes(search.toLowerCase()) ||
    s.ville?.toLowerCase().includes(search.toLowerCase())
  );

  const isRestricted = (s) => s.status === 'restricted' || (s.restricted_until && new Date(s.restricted_until) > new Date());

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
            <Shield size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-display font-black text-slate-900">Gestion des Écoles</h2>
            <p className="text-sm text-slate-400 font-medium">{schools.length} école{schools.length > 1 ? 's' : ''} sur la plateforme</p>
          </div>
        </div>
        <button
          onClick={fetchSchools}
          className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
        >
          <Loader2 size={14} className={loading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm font-medium">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      <div className="relative mb-6 max-w-md">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher une école..."
          className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 font-medium">
          {search ? 'Aucune école trouvée' : 'Aucune école inscrite'}
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(school => (
            <motion.div
              key={school.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${
                isRestricted(school) ? 'border-red-200 bg-red-50/30' : 'border-slate-100 hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-slate-900 truncate">{school.nom}</h3>
                    {isRestricted(school) ? (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black uppercase rounded-full tracking-wider">Restreinte</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded-full tracking-wider">Active</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    <span className="font-mono font-bold text-slate-700">{school.abreviation}</span>
                    {school.ville && <span> · {school.ville}</span>}
                    {school.pays && <span> · {school.pays}</span>}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                    <span>{school.student_count || 0} élèves</span>
                    <span>{school.teacher_count || 0} professeurs</span>
                    {school.admin_email && <span className="font-mono">{school.admin_email}</span>}
                  </div>
                  {school.restricted_until && (
                    <p className="text-xs text-red-600 font-medium mt-1">
                      Restreinte jusqu'au {new Date(school.restricted_until).toLocaleDateString('fr-FR')}
                      {school.restriction_reason && ` — ${school.restriction_reason}`}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {isRestricted(school) ? (
                    <button
                      onClick={() => handleActivate(school.id)}
                      className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle size={14} />
                      Réactiver
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const days = prompt('Nombre de jours de restriction :', '7');
                        if (days && parseInt(days) > 0) handleRestrict(school.id, parseInt(days));
                      }}
                      className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <Ban size={14} />
                      Restreindre
                    </button>
                  )}

                  {confirmDelete === school.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(school.id)}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                      >
                        <AlertTriangle size={14} />
                        Confirmer
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(school.id)}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 border border-red-200"
                    >
                      <Trash2 size={14} />
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default EcolesTab;
