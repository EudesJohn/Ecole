import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useSchool } from '../../contexts/SchoolContext';
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
  const { school } = useSchool(); // Get school info from context
  const navigate = useNavigate();
  const links = role === 'teacher' ? teacherLinks : adminLinks;

  // Default school info for fallback
  const schoolName = school?.nom || 'École Saint Lambert';
  const schoolShortName = school?.nom?.length > 15
    ? school?.nom.substring(0, 12) + '...'
    : school?.nom || 'ST LAMBERT';
  const schoolAcronym = school?.abreviation || 'SLB';

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
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/50 px-6 py-4 flex items-center justify-between shadow-glass-sm animate-fade-in">
        <button
          onClick={() => setMobileOpen(true)}
          className="w-12 h-12 bg-slate-50 text-slate-900 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm active:scale-95 transition-all"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-royal-gradient rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
            <GraduationCap className="w-5 h-5 text-gold-300" />
          </div>
          <span className="font-display font-black text-slate-900 text-sm tracking-tight">{schoolShortName}</span>
        </div>
        <button onClick={handleLogout} className="w-12 h-12 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all border border-transparent">
          <LogOut size={20} />
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
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[60] md:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-[85%] max-w-xs bg-white z-[70] md:hidden shadow-2xl rounded-r-[2.5rem] overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-royal-gradient rounded-[1.25rem] flex items-center justify-center shadow-xl shadow-blue-900/20 ring-4 ring-blue-50/50">
                    <GraduationCap className="w-6 h-6 text-gold-300" />
                  </div>
                  <div>
                    <p className="font-display font-black text-slate-900 text-base leading-none">{schoolShortName}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 opacity-70">{role === 'teacher' ? 'Enseignant' : 'Administrateur'}</p>
                  </div>
                </div>
                <button onClick={() => setMobileOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 bg-slate-50 rounded-xl transition-colors">
                  <X size={22} />
                </button>
              </div>
              <nav className="flex-1 p-6 space-y-2 overflow-y-auto custom-scrollbar">
                {links.map((link) => {
                  const parts = link.path.split('/');
                  const tab = parts.length <= 2 ? 'overview' : parts[parts.length - 1];
                  const isActive = activeTab === tab || (activeTab === 'overview' && parts.length <= 2);
                  return (
                    <button
                      key={link.path}
                      onClick={() => handleNav(link.path)}
                      className={`flex items-center gap-4 w-full px-5 py-4 rounded-2xl text-sm transition-all duration-300 ${
                        isActive
                          ? 'bg-royal-gradient text-white shadow-xl shadow-blue-900/20 font-bold'
                          : 'text-slate-500 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <link.icon size={20} className={isActive ? 'text-gold-300' : 'opacity-70'} />
                      {link.label}
                    </button>
                  );
                })}
              </nav>
              <div className="p-6 border-t border-slate-50 bg-slate-50/30">
                <div className="flex items-center gap-4 px-3 py-3 mb-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 text-sm font-black ring-2 ring-blue-50">
                    {(userProfile?.nom || user?.email || 'A')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate">{userProfile?.nom || user?.email?.split('@')[0]}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter opacity-80">{role}</p>
                  </div>
                </div>
                <button onClick={handleLogout} className="flex items-center gap-3 w-full px-5 py-4 rounded-2xl text-red-500 hover:bg-red-50 transition-all font-black text-xs uppercase tracking-widest border border-transparent hover:border-red-100">
                  <LogOut size={16} />
                  Déconnexion
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[280px] bg-white border-r border-slate-100 min-h-screen sticky top-0 shadow-glass-sm animate-fade-in-left">
        {/* Header */}
        <div className="p-8 pb-10">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-royal-gradient rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-blue-900/30 ring-[6px] ring-blue-50/50 hover:rotate-3 transition-transform cursor-pointer">
              <GraduationCap className="w-8 h-8 text-gold-300" />
            </div>
            <div>
              <h2 className="font-display font-black text-slate-900 text-xl tracking-tight leading-none">{schoolName}</h2>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5 opacity-60">School ERP Pro</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-5 pt-2 space-y-1 overflow-y-auto custom-scrollbar scroll-smooth">
          {links.map((link) => {
            const parts = link.path.split('/');
            const tab = parts.length <= 2 ? 'overview' : parts[parts.length - 1];
            const isActive = activeTab === tab || (activeTab === 'overview' && parts.length <= 2);
            return (
              <button
                key={link.path}
                onClick={() => handleNav(link.path)}
                className={`flex items-center gap-4 w-full px-5 py-3.5 rounded-[1.25rem] text-sm transition-all duration-300 group ${
                  isActive
                    ? 'bg-royal-gradient text-white shadow-xl shadow-blue-900/20 font-bold'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'
                }`}
              >
                <div className={`transition-transform duration-300 ${isActive ? '' : 'group-hover:scale-110'}`}>
                  <link.icon size={19} className={isActive ? 'text-gold-300' : 'opacity-60 text-slate-400'} />
                </div>
                {link.label}
                {isActive && (
                  <motion.div layoutId="sidebar-active" className="ml-auto w-1.5 h-1.5 bg-gold-400 rounded-full shadow-[0_0_8px_#fbbf24]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="p-6 mt-auto">
          <div className="bg-slate-50/80 rounded-[2rem] p-5 border border-slate-100 shadow-inner group hover:bg-white hover:shadow-glass-sm transition-all duration-500">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-11 h-11 bg-white rounded-2xl flex items-center justify-center text-blue-600 text-sm font-black border border-slate-100 shadow-sm group-hover:scale-110 transition-transform">
                {(userProfile?.nom || user?.email || 'A')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900 truncate tracking-tight">{userProfile?.prenom || userProfile?.nom || user?.email?.split('@')[0]}</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{role}</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-3 w-full py-4 rounded-[1.25rem] text-red-500 hover:text-white bg-white hover:bg-red-500 transition-all duration-300 text-[11px] font-black uppercase tracking-[0.1em] border border-red-50 shadow-sm hover:shadow-red-200"
            >
              <LogOut size={16} />
              Quitter
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;