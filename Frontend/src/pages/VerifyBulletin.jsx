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
    if (id) verify();
  }, [id]);

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
            Ce bulletin n&apos;a pas pu &ecirc;tre authentifi&eacute;. Il est possible qu&apos;il soit falsifi&eacute; ou que le lien soit invalide.
          </p>
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
            <p className="text-sm text-red-600 font-medium">
              &nbsp; Contactez l&apos;&eacute;tablissement pour confirmer l&apos;authenticit&eacute;.
            </p>
          </div>
          <p className="text-xs text-gray-400 mt-6">Réf: {matricule}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-gold-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Verified Header */}
        <div className="bg-royal-gradient p-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-5 right-5 w-20 h-20 border border-white/30 rounded-full"></div>
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="relative z-10"
          >
            <div className="w-16 h-16 bg-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
          </motion.div>
          <h1 className="text-xl font-display font-bold text-white relative z-10">
            ✅ Bulletin Authentique
          </h1>
          <p className="text-primary-200 text-xs mt-1 relative z-10">Vérifié par le système SLB</p>
        </div>

        {/* Student Info */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-primary-50 rounded-xl">
            <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-gold-300" />
            </div>
            <div>
              <p className="font-display font-bold text-gray-900">{bulletin.studentNom} {bulletin.studentPrenom}</p>
              <p className="text-xs text-primary-600 font-mono">{bulletin.matricule}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-xl text-center">
              <p className="text-xs text-gray-500">Classe</p>
              <p className="font-bold text-gray-800">{bulletin.classe || '—'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl text-center">
              <p className="text-xs text-gray-500">Trimestre</p>
              <p className="font-bold text-gray-800">{bulletin.trimestre || '—'}</p>
            </div>
            <div className="p-3 bg-primary-50 rounded-xl text-center">
              <p className="text-xs text-primary-500">Moyenne Générale</p>
              <p className="text-xl font-display font-bold text-primary-600">{bulletin.moyenne}/20</p>
            </div>
            <div className="p-3 bg-gold-50 rounded-xl text-center">
              <p className="text-xs text-gold-600">Rang</p>
              <p className="text-xl font-display font-bold text-gold-600">{bulletin.rang}</p>
            </div>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
            <p className="text-sm font-semibold text-emerald-700">{bulletin.appreciation}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
            <Shield size={12} />
            <span>Vérifié via SLB QR — École Saint Lambert Bénin</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default VerifyBulletin;
