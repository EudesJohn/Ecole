import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, BookOpen, FileText, Bell } from 'lucide-react';

const navItems = [
  { path: '/parent', icon: Home, label: 'Accueil', end: true },
  { path: '/parent/notes', icon: BookOpen, label: 'Notes' },
  { path: '/parent/bulletin', icon: FileText, label: 'Bulletin' },
  { path: '/parent/alertes', icon: Bell, label: 'Alertes' },
];

const BottomNav = () => {
  return (
    <nav className="bottom-nav md:hidden">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.end}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all duration-200 ${
              isActive
                ? 'text-primary-500'
                : 'text-gray-400 hover:text-gray-600'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <motion.div
                animate={{ scale: isActive ? 1.15 : 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <item.icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
              </motion.div>
              <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
                {item.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute -top-0.5 w-8 h-0.5 bg-primary-500 rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomNav;
