import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Shield, GraduationCap, Users, Loader2 } from 'lucide-react';

const Login = () => {
  const [mode, setMode] = useState('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [matricule, setMatricule] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [schoolAbbrev, setSchoolAbbrev] = useState(''); // For parent school abbreviation input
  const [detectedSchool, setDetectedSchool] = useState(null); // {nom, abreviation}
  const { login, loginParent } = useAuth();
  const navigate = useNavigate();

  const formatMatricule = (value) => {
    // Nettoyer tous les caractères spéciaux, garder seulement lettres et chiffres
    const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Si c'est trop court, rester tel quel
    if (clean.length <= 4) return clean;

    // Si c'est entre 5 et 7, ajouter l'espace après les 4 premiers chiffres
    if (clean.length <= 7) {
      const part1 = clean.substring(0, 4);
      const part2 = clean.substring(4);
      // Forcer "SLB" si les parents commencent à taper après les 4 chiffres
      if (part2.length > 0 && !'SLB'.startsWith(part2)) {
        return `${part1} SLB ${part2}`;
      }
      return `${part1} ${part2}`;
    }

    // Format complet: 0001 SLB 26
    const part1 = clean.substring(0, 4);
    // Extraire la fin après "SLB" si présent dans la chaîne nettoyée
    let part3 = '';
    if (clean.includes('SLB')) {
      part3 = clean.split('SLB')[1] || '';
    } else {
      part3 = clean.substring(4); // Fallback si SLB n'est pas tapé mais le reste oui
    }

    return `${part1} SLB ${part3.substring(0, 2)}`.trim();
  };

  // Detect school from matricule for parent login
  const detectSchoolFromMatricule = async () => {
    if (!matricule || matricule.length < 6) {
      setDetectedSchool(null);
      return;
    }

    const cleanMatricule = matricule.replace(/\s+/g, '').toUpperCase();

    // Extract potential abbreviation (letters between numbers)
    const abbrevMatch = cleanMatricule.match(/^0{0,4}\d{0,4}([A-Z]{2,5})/);
    if (!abbrevMatch) {
      setDetectedSchool(null);
      return;
    }

    const potentialAbbrev = abbrevMatch[1];

    try {
      const response = await fetch(`/api/schools/info/${potentialAbbrev}`);
      if (response.ok) {
        const schoolData = await response.json();
        setDetectedSchool(schoolData);
      } else {
        setDetectedSchool(null);
      }
    } catch (err) {
      console.error('Error detecting school:', err);
      setDetectedSchool(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'admin') {
        await login(email, password);
        // Utiliser la redirection racine pour laisser RoleRedirect gérer selon le profil chargé
        navigate('/');
      } else {
        // For parent login, we can use either:
        // 1. The auto-detected school from matricule
        // 2. The manually entered school abbreviation (if provided)
        // 3. Fallback to SLB for backward compatibility

        await loginParent(matricule, pin);
        navigate('/parent');
      }
    } catch (err) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const tabVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-primary-50/30 to-gold-50/40 flex items-center justify-center p-4">
      {/* Background decoration */}
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
          {/* Logo & Title */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <div className="w-20 h-20 mx-auto mb-4 bg-royal-gradient rounded-2xl flex items-center justify-center shadow-glass-lg">
              <GraduationCap className="w-10 h-10 text-gold-300" />
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold text-gradient-royal drop-shadow-sm">
              {detectedSchool ? detectedSchool.nom : 'Saint Lambert'}
            </h1>
            <p className="text-gray-500 mt-2 text-sm font-medium tracking-wide uppercase">
              Portail Sécurisé {detectedSchool ? detectedSchool.nom : 'SLB'}
            </p>
          </motion.div>

          {/* Tab Switcher */}
          <div className="flex bg-gray-100/80 rounded-2xl p-1 mb-6 relative">
            <button
              onClick={() => { setMode('admin'); setError(''); }}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${mode === 'admin'
                  ? 'bg-white shadow-md text-primary-500'
                  : 'text-gray-500 hover:text-primary-400'
                }`}
            >
              <Shield size={16} />
              Admin / Prof
            </button>
            <button
              onClick={() => { setMode('parent'); setError(''); }}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${mode === 'parent'
                  ? 'bg-white shadow-md text-gold-600'
                  : 'text-gray-500 hover:text-gold-500'
                }`}
            >
              <Users size={16} />
              Parent
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {mode === 'admin' ? (
                <motion.div
                  key="admin-form"
                  variants={tabVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-slb"
                      placeholder="admin@saintlambert.bj"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Mot de passe</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input-slb pr-12"
                        placeholder="••••••••"
                        required
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
                </motion.div>
              ) : (
                <motion.div
                  key="parent-form"
                  variants={tabVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-4"
                >
                  <div className="p-3 bg-gold-50 rounded-xl border border-gold-200/50">
                    <p className="text-xs text-gold-700 font-medium">
                      Entrez le matricule et le code PIN parent pour accéder au suivi scolaire.
                    </p>
                  </div>

                  {/* School Abbreviation Input (Optional) */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Abréviation de votre école (optionnel)
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="text"
                        value={schoolAbbrev}
                        onChange={(e) => {
                          setSchoolAbbrev(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 5));
                          // Auto-detect when abbreviation is entered
                          if (e.target.value.length >= 2) {
                            detectSchoolFromMatricule(); // We'll reuse this function but it needs the abbrev
                          }
                        }}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Ex: SLB, JDV"
                        maxLength="5"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (schoolAbbrev.length >= 2) {
                            // Manually trigger detection
                            const tempMatricule = `0001${schoolAbbrev}26`; // Dummy matricule for detection
                            setMatricule(tempMatricule);
                            detectSchoolFromMatricule();
                          }
                        }}
                        className="px-4 py-3 bg-gray-100 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                        disabled={schoolAbbrev.length < 2}
                      >
                        Vérifier
                      </button>
                    </div>
                    {schoolAbbrev && (
                      <p className={detectedSchool ? 'text-green-600 mt-1' : 'text-red-600 mt-1'}>
                        {detectedSchool
                          ? `École détectée : ${detectedSchool.nom} (${detectedSchool.abreviation})`
                          : `Aucune école trouvée avec l'abréviation "${schoolAbbrev}"`}
                      </p>
                    )}
                  </div>

                  <div className="p-3 bg-gold-50 rounded-xl border border-gold-200/50">
                    <p className="text-xs text-gold-700 font-medium">
                      Ou laissez vide pour utiliser la détection automatique depuis le matricule
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Matricule</label>
                    <input
                      type="text"
                      value={matricule}
                      onChange={(e) => {
                        setMatricule(formatMatricule(e.target.value));
                        // Auto-detect school when matricule changes
                        if (e.target.value.length >= 6) {
                          detectSchoolFromMatricule();
                        }
                      }}
                      className="input-slb font-mono tracking-widest text-center text-lg italic"
                      placeholder="0001 SLB 26"
                      required
                    />
                  </div>

                  {/* Detected School Info */}
                  {detectedSchool && (
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-3 rounded-r">
                      <p className="text-xs font-medium text-blue-800 flex items-center">
                        <svg className="w-4 h-4 mr-1 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 1118 0z" />
                        </svg>
                        École détectée : <strong>{detectedSchool.nom}</strong> ({detectedSchool.abreviation})
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Code PIN Parent</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        className="input-slb pr-12 font-mono text-center tracking-[0.2em]"
                        placeholder="••••••••••••"
                        required
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
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-red-600 text-sm text-center font-medium p-3 bg-red-50 rounded-xl border border-red-100"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className={`w-full py-4 px-6 rounded-2xl font-bold shadow-xl transition-all duration-300 flex items-center justify-center gap-2 ${mode === 'admin'
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white'
                  : 'bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Connexion...
                </>
              ) : mode === 'admin' ? (
                'Accéder au portail'
              ) : (
                'Voir mon enfant'
              )}
            </motion.button>
          </form>

          {/* Footer */}
          <p className="text-xs text-gray-400 text-center mt-6 flex items-center justify-center gap-1">
            <Shield size={12} />
            Sécurisé par SLB QR Vérification © 2026
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;