import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, Users, BookOpen, GraduationCap, UserCog,
  FileText, Settings, LogOut, Menu, X, ClipboardCheck, Award
} from 'lucide-react';

const adminLinks = [
  { path: '/admin', icon: LayoutDashboard, label: 'Tableau de bord' },
  { path: '/admin/classes', icon: BookOpen, label: 'Classes' },
  { path: '/admin/matieres', icon: Settings, label: 'Matières' },
  { path: '/admin/eleves', icon: GraduationCap, label: 'Élèves' },
  { path: '/admin/professeurs', icon: UserCog, label: 'Professeurs' },
  { path: '/admin/bulletins', icon: FileText, label: 'Bulletins' },
  { path: '/admin/presences', icon: ClipboardCheck, label: 'Présences' },
  { path: '/admin/cahiers', icon: BookOpen, label: 'Cahiers de texte' },
  { path: '/admin/settings', icon: Settings, label: 'Paramètres' },
];

const teacherLinks = [
  { path: '/teacher', icon: LayoutDashboard, label: 'Mes Classes' },
  { path: '/teacher/notes', icon: BookOpen, label: 'Saisie Notes' },
  { path: '/teacher/cahier', icon: FileText, label: 'Cahier de Texte' },
  { path: '/teacher/appel', icon: Users, label: 'Appel' },
  { path: '/teacher/moyennes', icon: Award, label: 'Moyennes' },
  { path: '/teacher/bulletins', icon: FileText, label: 'Bulletins' },
];

const Sidebar = ({ role = 'admin', activeTab, onTabChange }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout, user, userProfile } = useAuth();
  const navigate = useNavigate();
  const links = role === 'teacher' ? teacherLinks : adminLinks;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleNav = (tabId) => {
    if (onTabChange) {
      // Extract tab id from path
      const parts = tabId.split('/');
      const tab = parts[parts.length - 1] || 'overview';
      onTabChange(tab === role ? 'overview' : tab);
    }
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setMobileOpen(true)}
          className="w-10 h-10 bg-primary-50 text-primary-500 rounded-xl flex items-center justify-center"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-gold-500" />
          <span className="font-display font-bold text-primary-500 text-sm">Saint Lambert</span>
        </div>
        <button onClick={handleLogout} className="w-10 h-10 text-gray-400 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition">
          <LogOut size={18} />
        </button>
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-white z-[70] md:hidden shadow-2xl"
            >
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-royal-gradient rounded-xl flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-gold-300" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-gray-900 text-sm">Saint Lambert</p>
                    <p className="text-[10px] text-gray-400 uppercase">{role === 'teacher' ? 'Professeur' : 'Administration'}</p>
                  </div>
                </div>
                <button onClick={() => setMobileOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <nav className="p-3 space-y-1">
                {links.map((link) => {
                  const parts = link.path.split('/');
                  const tab = parts.length <= 2 ? 'overview' : parts[parts.length - 1];
                  const isActive = activeTab === tab || (activeTab === 'overview' && parts.length <= 2);
                  return (
                    <button
                      key={link.path}
                      onClick={() => handleNav(link.path)}
                      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-primary-50 text-primary-600 font-semibold'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <link.icon size={18} />
                      {link.label}
                    </button>
                  );
                })}
              </nav>
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
                <div className="flex items-center gap-3 px-3 py-2 mb-2">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 text-xs font-bold">
                    {(userProfile?.nom || user?.email || 'A')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 truncate">{userProfile?.nom || user?.email?.split('@')[0]}</p>
                    <p className="text-xs text-gray-400 capitalize">{role}</p>
                  </div>
                </div>
                <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-red-500 hover:bg-red-50 transition text-sm font-medium">
                  <LogOut size={16} />
                  Déconnexion
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-gray-100 min-h-screen sticky top-0">
        {/* Header */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-royal-gradient rounded-xl flex items-center justify-center shadow-md">
              <GraduationCap className="w-5 h-5 text-gold-300" />
            </div>
            <div>
              <h2 className="font-display font-bold text-gray-900">SLB</h2>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">{role === 'teacher' ? 'Professeur' : 'Administration'}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {links.map((link) => {
            const parts = link.path.split('/');
            const tab = parts.length <= 2 ? 'overview' : parts[parts.length - 1];
            const isActive = activeTab === tab || (activeTab === 'overview' && parts.length <= 2);
            return (
              <button
                key={link.path}
                onClick={() => handleNav(link.path)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition-all ${
                  isActive
                    ? 'bg-primary-50 text-primary-600 font-semibold shadow-sm'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 font-medium'
                }`}
              >
                <link.icon size={18} />
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 text-xs font-bold">
              {(userProfile?.nom || user?.email || 'A')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-700 truncate">{userProfile?.nom || user?.email?.split('@')[0]}</p>
              <p className="text-xs text-gray-400 capitalize">{role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-gray-500 hover:text-red-500 hover:bg-red-50 transition text-sm font-medium"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
