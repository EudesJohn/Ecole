import { useState } from 'react';
import Sidebar from '../components/UI/Sidebar';
import Modal from '../components/UI/Modal';
import { Button } from '../components/UI/Button';
import SkeletonLoader from '../components/UI/SkeletonLoader';
import { AnimatePresence, motion } from 'framer-motion';
import { useBulletin } from '../hooks/useBulletin';
import { useAdminData } from '../hooks/useAdminData';
import { supabase } from '../supabase';
import { Download, AlertCircle, CheckCircle, Plus, Trash2, Edit, Settings } from 'lucide-react';
import { OverviewTab } from '../components/Dashboard/Admin/OverviewTab';
import { EntityTable } from '../components/Dashboard/Admin/EntityTable';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [formData, setFormData] = useState({});

  const {
    classes, matieres, students, teachers, absences, cahiers,
    schoolConfig, loading, refresh
  } = useAdminData();

  const { handleGenerateBulletin, generatingPdf } = useBulletin();

  const showNotif = (msg, type = 'success') => {
    // Map technical PG errors to user friendly messages
    let friendlyMsg = msg;
    if (msg.includes('duplicate key') || msg.includes('23505')) {
      if (msg.includes('matricule')) friendlyMsg = "Ce matricule est déjà utilisé par un autre élève.";
      else if (msg.includes('email')) friendlyMsg = "Cet email est déjà associé à un compte.";
      else if (msg.includes('nom')) friendlyMsg = "Cet élément (nom/titre) existe déjà.";
      else friendlyMsg = "Un enregistrement identique existe déjà dans la base.";
    }

    setNotification({ message: friendlyMsg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleConfigSave = async (updatedConfig) => {
    setSaving(true);
    try {
      // Filter out temp frontend fields
      const toUpdate = {};
      if (updatedConfig.current_trimestre) toUpdate.current_trimestre = updatedConfig.current_trimestre;
      if (updatedConfig.current_year) toUpdate.current_year = updatedConfig.current_year;

      const updates = Object.entries(toUpdate).map(([key, value]) =>
        supabase.from('school_config').upsert({ key, value }, { onConflict: 'key' })
      );

      const results = await Promise.all(updates);
      const failed = results.find(r => r.error);
      if (failed) throw failed.error;

      showNotif('Configuration mise à jour !');
      setFormData({}); // Clear temp year edit
      refresh();
    } catch (err) {
      showNotif(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!modalType) return;
    setSaving(true);
    try {
      // 1. Prepare Payload
      const payload = { ...formData };

      // Remove UI-only or relation-based fields that aren't in the DB schema
      const unwantedFields = [
        'id', 'classes', 'profiles', 'students', 'matieres', 'matricule', 'parent_id',
        'classe', 'full_name', 'created_at', 'updated_at', 'studentsData'
      ];
      unwantedFields.forEach(f => delete payload[f]);

      // 2. Decide Strategy (API for Create Student/Teacher, Supabase for everything else)
      const isNewSensitive = !editItem && (modalType === 'professeurs' || modalType === 'eleves' || modalType === 'students');

      if (isNewSensitive) {
        // Use relative path if baseUrl is not provided
        let baseUrl = import.meta.env.VITE_BACKEND_URL || '';
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

        const endpoint = (modalType === 'eleves' || modalType === 'students') 
          ? `${baseUrl}/api/admin/students` 
          : `${baseUrl}/api/admin/teachers`;

        if (modalType === 'professeurs') {
          payload.password = 'Slb' + Math.floor(1000 + Math.random() * 9000);
          payload.role = 'teacher';
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify(payload)
        });

        const text = await response.text();
        let result = {};
        try {
          result = text ? JSON.parse(text) : {};
        } catch (e) {
          console.error('Failed to parse response:', text);
          throw new Error(`Erreur inattendue (${response.status}): Le serveur n'a pas renvoyé de JSON.`);
        }

        if (!response.ok) throw new Error(result.error || `Erreur Serveur (${response.status})`);

        if (modalType === 'professeurs') {
          // NOUVEAU: Mettre à jour le profil avec les matières et classes assignées
          if (result.user?.id || result.teacherId) {
            const teacherId = result.user?.id || result.teacherId;
            await supabase.from('profiles').update({
              matiere: payload.matiere || [],
              classe_assignee: payload.classe_assignee || []
            }).eq('id', teacherId);
          }
          showNotif(`Succès ! Professeur ajouté. Mot de passe provisoire : ${payload.password || result.password}`);
        } else {
          showNotif(`Succès ! Élève ajouté. Matricule: ${result.matricule}. Code PIN Parent: ${result.pin}`);
        }
      } else {
        // Direct Supabase Update/Insert
        const tableMap = {
          'classes': 'classes',
          'matieres': 'matieres',
          'professeurs': 'profiles',
          'eleves': 'students',
          'students': 'students'
        };
        const table = tableMap[modalType] || modalType;

        let res;
        if (editItem) {
          res = await supabase.from(table).update(payload).eq('id', editItem.id);
        } else {
          // Use upsert for non-sensitive management tables to avoid "Duplicate Key" errors
          if (['classes', 'matieres'].includes(table)) {
            const conflictTarget = table === 'classes' ? 'nom' : 'nom,classe_id';
            res = await supabase.from(table).upsert([payload], { onConflict: conflictTarget });
          } else {
            // For students and teachers, we use insert but the showNotif will catch and map the duplicate key error
            res = await supabase.from(table).insert([payload]);
          }
        }

        if (res.error) {
          console.error(`Supabase Error (${table}):`, res.error);
          throw new Error(res.error.message || 'Erreur lors de la sauvegarde');
        }
        showNotif('Enregistré avec succès !');
      }

      setModalOpen(false);
      refresh();
    } catch (err) {
      console.error('Save Error:', err);
      showNotif(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Confirmer la suppression ?')) return;
    const tableMap = { 'professeurs': 'profiles', 'eleves': 'students', 'classes': 'classes', 'matieres': 'matieres' };
    const table = tableMap[type] || type;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) showNotif(error.message, 'error');
    else {
      showNotif('Supprimé !');
      refresh();
    }
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    setEditItem(item);
    setFormData(item ? { ...item } : {});
    setModalOpen(true);
  };

  if (loading) return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role="admin" activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 p-8 pt-20 md:pt-8"><SkeletonLoader type="card" count={3} /></div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#fcfdfe]">
      <Sidebar role="admin" activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 p-6 md:p-10 pt-24 md:pt-10 overflow-auto">
        <header className="mb-10 animate-fade-in">
          <div className="flex items-center gap-3 text-primary-500 font-black text-[10px] uppercase tracking-[0.3em] mb-2 opacity-60">
            <div className="w-8 h-[1px] bg-primary-500" />
            Saint Lambert ERP
          </div>
          <h1 className="text-4xl font-display font-black text-slate-900 tracking-tight">
            {activeTab === 'overview' ? 'Tableau de bord' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
          </h1>
          <p className="text-slate-400 font-medium text-sm mt-1">Gestion complète de l&apos;établissement</p>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <OverviewTab data={{ classes, students, teachers, matieres, grades: [], schoolConfig }} setActiveTab={setActiveTab} />
          )}

          {activeTab === 'eleves' && (
            <EntityTable
              items={students} colName="students" searchTerm={searchTerm} setSearchTerm={setSearchTerm}
              onAdd={() => openModal('eleves')} onEdit={(item) => openModal('eleves', item)} onDelete={(id) => handleDelete('eleves', id)}
              onExtraAction={handleGenerateBulletin} extraActionIcon={Download} extraActionLabel="Bulletin" generatingId={generatingPdf}
              columns={[
                { key: 'matricule', label: 'Matricule' },
                {
                  key: 'fullname', label: 'Élève', render: (s) => (
                    <div><p className="font-bold">{s.prenom} {s.nom}</p><p className="text-[10px] text-slate-400">{s.sexe === 'M' ? 'Garçon' : 'Fille'}</p></div>
                  )
                },
                { key: 'classe', label: 'Classe' }
              ]}
            />
          )}

          {activeTab === 'professeurs' && (
            <EntityTable
              items={teachers} colName="teachers" searchTerm={searchTerm} setSearchTerm={setSearchTerm}
              onAdd={() => openModal('professeurs')} onEdit={(item) => openModal('professeurs', item)} onDelete={(id) => handleDelete('professeurs', id)}
              columns={[
                { key: 'full_name', label: 'Nom' },
                { key: 'email', label: 'Email' },
                {
                  key: 'matiere', label: 'Spécialité', render: (t) => (
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(t.matiere) ? t.matiere : []).map(m => <span key={m} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold">{m}</span>)}
                    </div>
                  )
                }
              ]}
            />
          )}

          {activeTab === 'classes' && (
            <EntityTable
              items={classes} colName="classes" searchTerm={searchTerm} setSearchTerm={setSearchTerm}
              onAdd={() => openModal('classes')} onEdit={(item) => openModal('classes', item)} onDelete={(id) => handleDelete('classes', id)}
              columns={[
                { key: 'nom', label: 'Nom' },
                { key: 'cycle', label: 'Cycle', render: (c) => <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${c.cycle === 'secondaire' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>{c.cycle}</span> },
                { key: 'effectif', label: 'Effectif Max' }
              ]}
            />
          )}

          {activeTab === 'matieres' && (
            <EntityTable
              items={matieres} colName="matieres" searchTerm={searchTerm} setSearchTerm={setSearchTerm}
              onAdd={() => openModal('matieres')} onEdit={(item) => openModal('matieres', item)} onDelete={(id) => handleDelete('matieres', id)}
              columns={[
                { key: 'nom', label: 'Matière' },
                { key: 'classe', label: 'Classe' },
                { key: 'coefficient', label: 'Coef.' },
                { key: 'category', label: 'Type' }
              ]}
            />
          )}

          {activeTab === 'presences' && (
            <EntityTable
              items={absences} colName="absences" searchTerm={searchTerm} setSearchTerm={setSearchTerm}
              columns={[
                { key: 'date', label: 'Date' },
                { key: 'student', label: 'Élève', render: (a) => `${a.students?.prenom} ${a.students?.nom}` },
                { key: 'classe', label: 'Classe', render: (a) => a.students?.classes?.nom },
                { key: 'status', label: 'Statut', render: (a) => <span className={a.status === 'absent' ? 'text-red-500 font-bold' : 'text-emerald-500 font-bold'}>{a.status.toUpperCase()}</span> }
              ]}
            />
          )}

          {activeTab === 'cahiers' && (
            <EntityTable
              items={cahiers} colName="cahiers" searchTerm={searchTerm} setSearchTerm={setSearchTerm}
              columns={[
                { key: 'date', label: 'Date' },
                { key: 'matiere', label: 'Matière', render: (c) => c.matieres?.nom },
                { key: 'classe', label: 'Classe', render: (c) => c.classes?.nom },
                { key: 'chapitre', label: 'Leçon' }
              ]}
            />
          )}

          {activeTab === 'bulletins' && (
            <EntityTable
              items={students} colName="students" searchTerm={searchTerm} setSearchTerm={setSearchTerm}
              onEdit={(item) => openModal('eleves', item)}
              onExtraAction={(item) => handleGenerateBulletin(item, schoolConfig, classes, matieres)}
              extraActionIcon={Download} extraActionLabel="Générer Bulletin" generatingId={generatingPdf}
              columns={[
                { key: 'matricule', label: 'Matricule' },
                {
                  key: 'fullname', label: 'Élève', render: (s) => (
                    <div><p className="font-bold">{s.prenom} {s.nom}</p><p className="text-[10px] text-slate-400">{s.classe || 'N/A'}</p></div>
                  )
                },
                { key: 'classe', label: 'Classe' }
              ]}
            />
          )}

          {activeTab === 'settings' && (
            <div className="glass-card-pro p-8 max-w-2xl animate-fade-in mx-auto">
              <h2 className="text-2xl font-display font-black text-slate-900 mb-8 flex items-center gap-3">
                <div className="p-3 bg-primary-50 rounded-2xl text-primary-600"><Settings size={24} /></div>
                Configuration de l'Etablissement
              </h2>
              <div className="space-y-8">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Trimestre Actuel</label>
                    <select
                      className="input-slb w-full"
                      value={schoolConfig.current_trimestre}
                      onChange={e => handleConfigSave({ current_trimestre: e.target.value })}
                    >
                      <option value="1">1er Trimestre</option>
                      <option value="2">2ème Trimestre</option>
                      <option value="3">3ème Trimestre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Année Scolaire</label>
                    <input
                      type="text"
                      className="input-slb w-full font-mono"
                      value={formData.current_year !== undefined ? formData.current_year : (schoolConfig.current_year || '')}
                      onChange={e => setFormData({ ...formData, current_year: e.target.value })}
                      onBlur={() => {
                        if (formData.current_year && formData.current_year !== schoolConfig.current_year) {
                          handleConfigSave({ current_year: formData.current_year });
                        }
                      }}
                      placeholder="ex: 2025-2026"
                    />
                  </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-amber-500 shrink-0">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 leading-relaxed font-bold">
                        Note Importante
                      </p>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                        La modification de ces paramètres impacte instantanément la génération de tous les nouveaux bulletins ainsi que les statistiques affichées sur le tableau de bord pour l'ensemble des utilisateurs.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-[10px] text-slate-400 font-bold italic">Dernière mise à jour : {new Date().toLocaleDateString()}</p>
                  <Button variant="primary" onClick={() => handleConfigSave({ ...schoolConfig, ...formData })} loading={saving} size="sm">
                    Tout Enregistrer
                  </Button>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </main>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`${editItem ? 'Modifier' : 'Ajouter'} ${modalType}`}>
        <div className="space-y-4 p-4">
          {modalType === 'classes' && (
            <>
              <input type="text" placeholder="Nom de la classe (ex: 6ème A)" className="input-slb" value={formData.nom || ''} onChange={e => setFormData({ ...formData, nom: e.target.value })} />
              <select className="input-slb" value={formData.cycle || 'secondaire'} onChange={e => setFormData({ ...formData, cycle: e.target.value })}>
                <option value="maternelle">Maternelle</option>
                <option value="primaire">Primaire</option>
                <option value="secondaire">Secondaire</option>
              </select>
            </>
          )}

          {modalType === 'matieres' && (
            <>
              <input type="text" placeholder="Nom de la matière" className="input-slb" value={formData.nom || ''} onChange={e => setFormData({ ...formData, nom: e.target.value })} />
              <select className="input-slb" value={formData.classe_id || ''} onChange={e => setFormData({ ...formData, classe_id: e.target.value })}>
                <option value="">Sélectionner une classe</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
              <input type="number" placeholder="Coefficient" className="input-slb" value={formData.coefficient || 1} onChange={e => setFormData({ ...formData, coefficient: parseInt(e.target.value) })} />
              <select className="input-slb" value={formData.category || 'ECRITE'} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                <option value="ECRITE">Écrit</option>
                <option value="ORALE">Oral</option>
                <option value="PRATIQUE">Pratique</option>
              </select>
            </>
          )}

          {modalType === 'eleves' && (
            <>
              <input type="text" placeholder="Prénom" className="input-slb" value={formData.prenom || ''} onChange={e => setFormData({ ...formData, prenom: e.target.value })} />
              <input type="text" placeholder="Nom" className="input-slb" value={formData.nom || ''} onChange={e => setFormData({ ...formData, nom: e.target.value })} />
              <select className="input-slb" value={formData.classe_id || ''} onChange={e => setFormData({ ...formData, classe_id: e.target.value })}>
                <option value="">Sélectionner une classe</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
              <select className="input-slb" value={formData.sexe || 'M'} onChange={e => setFormData({ ...formData, sexe: e.target.value })}>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </>
          )}

          {modalType === 'professeurs' && (
            <>
              <input type="text" placeholder="Prénom" className="input-slb" value={formData.prenom || ''} onChange={e => setFormData({ ...formData, prenom: e.target.value })} />
              <input type="text" placeholder="Nom" className="input-slb" value={formData.nom || ''} onChange={e => setFormData({ ...formData, nom: e.target.value })} />
              <input type="email" placeholder="Email (pour connexion)" className="input-slb" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />

              <div className="space-y-2">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Matières (séparées par des virgules)</p>
                <input
                  type="text"
                  placeholder="Français, Mathématiques..."
                  className="input-slb"
                  value={Array.isArray(formData.matiere) ? formData.matiere.join(', ') : (formData.matiere || '')}
                  onChange={e => setFormData({ ...formData, matiere: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '') })}
                />
              </div>

              <div className="space-y-2">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Classes Assignées</p>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-100">
                  {classes.map(c => (
                    <label key={c.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg transition-colors cursor-pointer group">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        checked={(formData.classe_assignee || []).includes(c.nom)}
                        onChange={e => {
                          const current = formData.classe_assignee || [];
                          if (e.target.checked) {
                            setFormData({ ...formData, classe_assignee: [...current, c.nom] });
                          } else {
                            setFormData({ ...formData, classe_assignee: current.filter(id => id !== c.nom) });
                          }
                        }}
                      />
                      <span className="text-xs font-bold text-slate-600 group-hover:text-primary-600">{c.nom}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          <Button variant="primary" onClick={handleSave} loading={saving} className="w-full">Enregistrer</Button>
        </div>
      </Modal>

      {notification && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-xl shadow-lg text-white flex items-center gap-2 z-50 animate-fade-in-up ${notification.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
          {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          <span className="font-bold">{notification.message}</span>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
