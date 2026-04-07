import { useState } from 'react';
import Sidebar from '../components/UI/Sidebar';
import Modal from '../components/UI/Modal';
import { Button } from '../components/UI/Button';
import SkeletonLoader from '../components/UI/SkeletonLoader';
import { AnimatePresence } from 'framer-motion';
import { useBulletin } from '../hooks/useBulletin';
import { useAdminData } from '../hooks/useAdminData';
import { supabase } from '../supabase';
import { Download, AlertCircle, CheckCircle } from 'lucide-react';
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
      const payload = { ...formData };
      const unwantedFields = ['id', 'classes', 'profiles', 'students', 'matieres', 'classe', 'full_name', 'created_at', 'updated_at'];
      unwantedFields.forEach(f => delete payload[f]);

      if (modalType !== 'classes' && formData.classe_id) {
        payload.classe_id = formData.classe_id;
      }

      let res;
      if (editItem) {
        res = await supabase.from(modalType === 'teachers' ? 'profiles' : modalType).update(payload).eq('id', editItem.id);
      } else {
        res = await supabase.from(modalType === 'teachers' ? 'profiles' : modalType).insert([payload]);
      }

      if (res.error) throw res.error;
      showNotif('Enregistré avec succès !');
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
    const { error } = await supabase.from(type === 'teachers' ? 'profiles' : type).delete().eq('id', id);
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
      <div className="flex-1 p-8"><SkeletonLoader type="card" count={3} /></div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <Sidebar role="admin" activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="flex-1 p-6 md:p-10 pt-20 md:pt-10 overflow-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-display font-black text-slate-900 tracking-tight">Espace Administration</h1>
          <p className="text-slate-400 font-medium text-sm mt-1">Gestion complète de l&apos;établissement Saint Lambert</p>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <OverviewTab data={{ classes, students, teachers, matieres, grades: [], schoolConfig }} setActiveTab={setActiveTab} />
          )}

          {activeTab === 'eleves' && (
            <EntityTable 
              items={students} 
              colName="students"
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onAdd={() => openModal('students')}
              onEdit={(item) => openModal('students', item)}
              onDelete={(id) => handleDelete('students', id)}
              onExtraAction={handleGenerateBulletin}
              extraActionIcon={Download}
              extraActionLabel="Bulletin PDF"
              generatingId={generatingPdf}
              columns={[
                { key: 'matricule', label: 'Matricule' },
                { key: 'full_name', label: 'Nom Complet', render: (s) => `${s.prenom} ${s.nom}` },
                { key: 'classe', label: 'Classe' }
              ]}
            />
          )}

          {activeTab === 'profs' && (
            <EntityTable 
              items={teachers}
              colName="teachers"
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onAdd={() => openModal('teachers')}
              onEdit={(item) => openModal('teachers', item)}
              onDelete={(id) => handleDelete('teachers', id)}
              columns={[
                { key: 'full_name', label: 'Nom' },
                { key: 'email', label: 'Email' },
                { key: 'matiere', label: 'Matières', render: (t) => Array.isArray(t.matiere) ? t.matiere.join(', ') : '—' }
              ]}
            />
          )}

          {activeTab === 'classes' && (
            <EntityTable 
              items={classes}
              colName="classes"
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onAdd={() => openModal('classes')}
              onEdit={(item) => openModal('classes', item)}
              onDelete={(id) => handleDelete('classes', id)}
              columns={[
                { key: 'nom', label: 'Nom' },
                { key: 'niveau', label: 'Niveau' },
                { key: 'cycle', label: 'Cycle' },
                { key: 'effectif', label: 'Effectif Max' }
              ]}
            />
          )}
        </AnimatePresence>
      </main>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`${editItem ? 'Modifier' : 'Ajouter'} ${modalType}`}>
        <div className="space-y-4 p-4">
          {modalType === 'classes' ? (
            <>
              <input type="text" placeholder="Nom de la classe" className="input-slb" value={formData.nom || ''} onChange={e => setFormData({...formData, nom: e.target.value})} />
              <select className="input-slb" value={formData.cycle || ''} onChange={e => setFormData({...formData, cycle: e.target.value})}>
                <option value="primaire">Primaire</option>
                <option value="secondaire">Secondaire</option>
              </select>
            </>
          ) : (
            <>
              <input type="text" placeholder="Prénom" className="input-slb" value={formData.prenom || ''} onChange={e => setFormData({...formData, prenom: e.target.value})} />
              <input type="text" placeholder="Nom" className="input-slb" value={formData.nom || ''} onChange={e => setFormData({...formData, nom: e.target.value})} />
              <select className="input-slb" value={formData.classe_id || ''} onChange={e => setFormData({...formData, classe_id: e.target.value})}>
                <option value="">Sélectionner une classe</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </>
          )}
          <Button variant="primary" onClick={handleSave} loading={saving} className="w-full">Enregistrer</Button>
        </div>
      </Modal>

      {notification && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-xl shadow-lg text-white flex items-center gap-2 z-50 ${notification.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
          {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          <span className="font-bold">{notification.message}</span>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
