import { motion } from 'framer-motion';

export const StatCard = ({ icon: Icon, label, value, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 30, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    className="bento-item border-tl-4 border-white group"
  >
    <div className={`absolute -right-4 -top-4 w-24 h-24 ${color} rounded-full opacity-5 blur-2xl group-hover:opacity-10 transition-opacity`} />
    <div className="flex items-start justify-between relative z-10">
      <div>
        <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] mb-1">{label}</p>
        <p className="text-4xl font-display font-black text-slate-900 tracking-tight">{value}</p>
      </div>
      <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center shadow-lg shadow-gray-200 group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
    <div className="mt-4 flex items-center gap-2">
      <span className="w-2 h-0.5 bg-gray-200 rounded-full" />
      <span className="text-[10px] text-gray-400 font-medium">Vue d&apos;ensemble</span>
    </div>
  </motion.div>
);
