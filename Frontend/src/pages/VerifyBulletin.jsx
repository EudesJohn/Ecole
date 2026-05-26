import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
// Firebase removed, implement custom backend fetch logic here
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Shield, GraduationCap, Loader2 } from 'lucide-react';

const VerifyBulletin = () => {
  const { matricule, trimestre, year } = useParams();
  const [bulletin, setBulletin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const verify = async () => {
      try {
        const { supabase } = await import('../supabase');
        // Decode matricule from the URL.
        const decodedMatricule = decodeURIComponent(matricule);

        // Use an RPC function that verifies the bulletin via backend to bypass RLS safely
        const { data: result, error } = await supabase.rpc('verify_bulletin', {
          p_matricule: decodedMatricule,
          p_trimestre: parseInt(trimestre),
          p_school_year: year
        });

        if (error || !result) {
          console.error(error);
          setError(true);
        } else {
          setBulletin(result);
        }
      } catch (err) {
        console.error(err);
        setError(true);
      }
      setLoading(false);
    };
    if (matricule) verify();
  }, [matricule, trimestre, year]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-gold-50">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
          <p className="text-gray-500 font-medium">Vérification en cours...</p>
        </motion.div>
      </div>
    );
  }

  if (error || !bulletin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center"
        >
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-display font-bold text-gray-900 mb-2">
            Document Non Vérifié
          </h1>
          <p className="text-gray-500 mb-4">
            Ce bulletin n'a pas pu être authentifié. Il est possible qu'il soit falsifié ou que le lien soit invalide.
          </p>
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
            <p className="text-sm text-red-600 font-medium">
              &nbsp; Contactez l'établissement pour confirmer l'authenticité.
            </p>
          </div>
          <p className="text-xs text-gray-400 mt-6">Réf: {matricule}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-gold-50 p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20"
      >
        {/* Verified Header */}
        <div className="bg-royal-gradient p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="relative z-10"
          >
            <div className="w-20 h-20 bg-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-900/20 rotate-3">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
          </motion.div>

          <h1 className="text-2xl font-display font-black text-white relative z-10 tracking-tight">
            BULLETIN AUTHENTIQUE
          </h1>
          <div className="flex items-center justify-center gap-2 mt-2 relative z-10">
            <Shield className="w-3 h-3 text-gold-300" />
            <p className="text-primary-200 text-[10px] font-bold uppercase tracking-widest">Certifié par l'établissement</p>
          </div>
        </div>

        {/* Student Info */}
        <div className="p-8 space-y-6">
          <div className="flex items-center gap-4 p-5 bg-primary-50/50 rounded-3xl border border-primary-100/50">
            <div className="w-14 h-14 bg-royal-gradient rounded-2xl flex items-center justify-center shadow-lg">
              <GraduationCap className="w-7 h-7 text-gold-300" />
            </div>
            <div>
              <p className="text-[10px] text-primary-500 font-bold uppercase tracking-wider mb-0.5">Élève</p>
              <p className="text-lg font-display font-black text-gray-900 leading-tight">
                {bulletin.studentNom} {bulletin.studentPrenom}
              </p>
              <p className="text-[11px] text-gray-400 font-mono font-bold mt-0.5 tracking-tighter">
                {bulletin.matricule}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1">Classe</p>
              <p className="font-black text-gray-800 text-sm italic">{bulletin.classe || '—'}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1">Période</p>
              <p className="font-black text-gray-800 text-sm">
                T{bulletin.trimestre} • {bulletin.schoolYear || '2025-26'}
              </p>
            </div>

            <div className="p-5 bg-royal-gradient rounded-[2rem] text-center shadow-xl shadow-blue-900/10 col-span-2 sm:col-span-1 border border-white/10">
              <p className="text-[9px] text-blue-200 font-bold uppercase tracking-widest mb-1">Moyenne Générale</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-3xl font-display font-black text-white">{bulletin.moyenne}</span>
                <span className="text-xs text-blue-300 font-bold">/20</span>
              </div>
            </div>

            <div className="p-5 bg-white rounded-[2rem] text-center shadow-xl shadow-gold-900/5 col-span-2 sm:col-span-1 border border-gold-100">
              <p className="text-[9px] text-gold-500 font-bold uppercase tracking-widest mb-1">Rang de classe</p>
              <p className="text-3xl font-display font-black text-gold-600">{bulletin.rang}</p>
            </div>
          </div>

          <div className="p-5 bg-emerald-50 border-l-4 border-emerald-400 rounded-2xl flex items-center gap-4">
             <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-emerald-500 font-black">
                {bulletin.moyenne >= 10 ? 'A' : 'R'}
             </div>
             <div>
                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mb-0.5">Décision</p>
                <p className="text-sm font-black text-emerald-700 uppercase italic">
                  {bulletin.appreciation}
                </p>
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-8">
          <div className="pt-6 border-top border-gray-100 flex flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium">
              <Shield size={12} className="text-gold-400" />
              <span>SYSTÈME DE VÉRIFICATION CERTIFIÉ</span>
            </div>
            <p className="text-[8px] text-gray-300 uppercase tracking-[0.2em] font-bold">Vérifiez l'authenticité de ce document directement avec l'établissement concerné</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default VerifyBulletin;