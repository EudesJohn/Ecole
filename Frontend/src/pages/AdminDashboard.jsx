import { useState } from 'react';
import Sidebar from '../components/UI/Sidebar';
import Modal from '../components/UI/Modal';
import { Button } from '../components/UI/Button';
import SkeletonLoader from '../components/UI/SkeletonLoader';
import { AnimatePresence, motion } from 'framer-motion';
import { useBulletin } from '../hooks/useBulletin';
import { useAdminData } from '../hooks/useAdminData';
import { supabase } from '../supabase';
import { Download, AlertCircle, CheckCircle, Plus, Trash2, Edit } from 'lucide-react';
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
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // For sensitive entities (students/teachers), use the API
      if (!editItem && (modalType === 'students' || modalType === 'professeurs')) {
        const route = modalType === 'professeurs' ? 'teachers' : 'students';
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/${route}`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify(formData)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Erreur API');
        showNotif(`Succès ! Matricule: ${result.matricule || 'Généré'}, PIN: ${result.pin || result.password || 'Généré'}`);
      } else {
        // For other entities or updates, use direct Supabase
        const payload = { ...formData };
        const unwantedFields = ['id', 'classes', 'profiles', 'students', 'matieres', 'classe', 'full_name', 'created_at', 'updated_at'];
        unwantedFields.forEach(f => delete payload[f]);

        const tableMap = {
          'classes': 'classes',
          'matieres': 'matieres',
          'professeurs': 'profiles',
          'eleves': 'students'
        };
        const table = tableMap[modalType] || modalType;

        let res;
        if (editItem) {
          res = await supabase.from(table).update(payload).eq('id', editItem.id);
        } else {
          res = await supabase.from(table).insert([payload]);
        }
        if (res.error) throw res.error;
        showNotif('Enregistré avec succès !');
      }

      setModalOpen(false);
      refresh();
    } catch (err) {
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
                { key: 'fullname', label: 'Élève', render: (s) => (
                  <div><p className="font-bold">{s.prenom} {s.nom}</p><p className="text-[10px] text-slate-400">{s.sexe === 'M' ? 'Garçon' : 'Fille'}</p></div>
                )},
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
                { key: 'matiere', label: 'Spécialité', render: (t) => (
                  <div className="flex flex-wrap gap-1">
                    {(Array.isArray(t.matiere) ? t.matiere : []).map(m => <span key={m} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold">{m}</span>)}
                  </div>
                )}
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
        </AnimatePresence>
      </main>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`${editItem ? 'Modifier' : 'Ajouter'} ${modalType}`}>
        <div className="space-y-4 p-4">
          {modalType === 'classes' && (
            <>
              <input type="text" placeholder="Nom de la classe (ex: 6ème A)" className="input-slb" value={formData.nom || ''} onChange={e => setFormData({...formData, nom: e.target.value})} />
              <select className="input-slb" value={formData.cycle || 'secondaire'} onChange={e => setFormData({...formData, cycle: e.target.value})}>
                <option value="maternelle">Maternelle</option>
                <option value="primaire">Primaire</option>
                <option value="secondaire">Secondaire</option>
              </select>
            </>
          )}

          {modalType === 'matieres' && (
            <>
              <input type="text" placeholder="Nom de la matière" className="input-slb" value={formData.nom || ''} onChange={e => setFormData({...formData, nom: e.target.value})} />
              <select className="input-slb" value={formData.classe_id || ''} onChange={e => setFormData({...formData, classe_id: e.target.value})}>
                <option value="">Sélectionner une classe</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
              <input type="number" placeholder="Coefficient" className="input-slb" value={formData.coefficient || 1} onChange={e => setFormData({...formData, coefficient: parseInt(e.target.value)})} />
              <select className="input-slb" value={formData.category || 'ECRITE'} onChange={e => setFormData({...formData, category: e.target.value})}>
                <option value="ECRITE">Écrit</option>
                <option value="ORALE">Oral</option>
                <option value="PRATIQUE">Pratique</option>
              </select>
            </>
          )}

          {modalType === 'eleves' && (
            <>
              <input type="text" placeholder="Prénom" className="input-slb" value={formData.prenom || ''} onChange={e => setFormData({...formData, prenom: e.target.value})} />
              <input type="text" placeholder="Nom" className="input-slb" value={formData.nom || ''} onChange={e => setFormData({...formData, nom: e.target.value})} />
              <select className="input-slb" value={formData.classe_id || ''} onChange={e => setFormData({...formData, classe_id: e.target.value})}>
                <option value="">Sélectionner une classe</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
              <select className="input-slb" value={formData.sexe || 'M'} onChange={e => setFormData({...formData, sexe: e.target.value})}>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </>
          )}

          {modalType === 'professeurs' && (
            <>
              <input type="text" placeholder="Prénom" className="input-slb" value={formData.prenom || ''} onChange={e => setFormData({...formData, prenom: e.target.value})} />
              <input type="text" placeholder="Nom" className="input-slb" value={formData.nom || ''} onChange={e => setFormData({...formData, nom: e.target.value})} />
              <input type="email" placeholder="Email (pour connexion)" className="input-slb" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Matières enseignées (séparées par des virgules)</p>
              <input type="text" placeholder="Français, Mathématiques..." className="input-slb" value={Array.isArray(formData.matiere) ? formData.matiere.join(', ') : formData.matiere || ''} 
                onChange={e => setFormData({...formData, matiere: e.target.value.split(',').map(s => s.trim())})} />
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
