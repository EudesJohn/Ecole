import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { motion } from 'framer-motion';
import { Shield, Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Supabase sends recovery token in URL hash: #access_token=xxx&type=recovery
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');

    if (type === 'recovery' && accessToken) {
      setValidSession(true);
    }
    setChecking(false);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password
      });

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.message || 'Erreur lors de la réinitialisation');
      if (err.message?.includes('session') || err.message?.includes('Session')) {
        setValidSession(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-primary-50/30 to-gold-50/40 flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative max-w-md w-full"
      >
        <div className="glass-card-lg p-8 md:p-10">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 bg-royal-gradient rounded-2xl flex items-center justify-center shadow-glass-lg">
              <Shield className="w-10 h-10 text-gold-300" />
            </div>
            <h1 className="text-3xl font-display font-bold text-gradient-royal">
              Réinitialisation
            </h1>
            <p className="text-gray-500 mt-2 text-sm font-medium">
              {success ? 'Mot de passe mis à jour' : 'Choisissez un nouveau mot de passe'}
            </p>
          </div>

          {checking ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
          ) : success ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="text-emerald-700 font-medium">
                Mot de passe réinitialisé avec succès !
              </p>
              <p className="text-sm text-gray-500">
                Redirection vers la page de connexion...
              </p>
            </div>
          ) : !validSession ? (
            <div className="text-center space-y-4">
              <p className="text-red-600 font-medium">
                Lien invalide ou expiré.
              </p>
              <p className="text-sm text-gray-500">
                Veuillez refaire une demande de réinitialisation depuis la page de connexion.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-4 px-6 rounded-2xl font-bold shadow-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 transition-all"
              >
                Retour à la connexion
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="text-red-600 text-sm text-center font-medium p-3 bg-red-50 rounded-xl border border-red-100"
                >
                  {error}
                </motion.p>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-slb pr-12"
                    placeholder="Minimum 6 caractères"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirmer le mot de passe
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-slb"
                  placeholder="Retapez le mot de passe"
                  required
                  minLength={6}
                />
              </div>

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.01 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                className="w-full py-4 px-6 rounded-2xl font-bold shadow-xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Mise à jour...</>
                ) : 'Réinitialiser le mot de passe'}
              </motion.button>
            </form>
          )}

          <p className="text-xs text-gray-400 text-center mt-6 flex items-center justify-center gap-1">
            <Shield size={12} />
            Plateforme ERP Scolaire Sécurisée © 2026
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
