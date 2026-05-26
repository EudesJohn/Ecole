import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const { loginWithEmail, loading, error } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nom: '',
    abreviation: '',
    ville: '',
    pays: 'Bénin',
    adminEmail: '',
    adminPassword: '',
    adminPrenom: '',
    adminNom: ''
  });

  const [step, setStep] = useState(1); // 1: école info, 2: admin info
  const [abrevCheck, setAbrevCheck] = useState(null); // null: not checked, true: available, false: taken

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Reset abrev check when abbreviation changes
    if (name === 'abreviation') {
      setAbrevCheck(null);
    }
  };

  const handleCheckAbreviation = async () => {
    if (!formData.abreviation || formData.abreviation.length < 2) {
      setAbrevCheck(false);
      return;
    }

    try {
      const response = await fetch(`/api/schools/check-abreviation/${formData.abreviation}`);
      const data = await response.json();
      setAbrevCheck(data.available);
    } catch (err) {
      console.error('Error checking abbreviation:', err);
      setAbrevCheck(false);
    }
  };

  const handlePreviousStep = () => {
    setStep(prev => Math.max(1, prev - 1));
  };

  const handleNextStep = () => {
    if (step === 1) {
      // Validate school info before proceeding
      if (!formData.nom || !formData.abreviation || formData.abreviation.length < 2) {
        alert('Veuillez remplir le nom de l\'école et une abréviation valide (minimum 2 lettres).');
        return;
      }

      // Check abbreviation availability
      handleCheckAbreviation();
    } else {
      setStep(prev => Math.min(3, prev + 1));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Final validation
    if (!formData.nom || !formData.abreviation || !formData.adminEmail || !formData.adminPassword) {
      alert('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    if (formData.abreviation.length < 2) {
      alert('L\'abréviation doit contenir au moins 2 lettres.');
      return;
    }

    if (abrevCheck !== true) {
      alert('Veuillez vérifier la disponibilité de l\'abréviation.');
      return;
    }

    try {
      const response = await fetch('/api/schools/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création de l\'école');
      }

      // Auto-login the newly created admin
      await loginWithEmail(formData.adminEmail, formData.adminPassword);
      navigate('/admin');
    } catch (err) {
      console.error('Registration error:', err);
      alert(err.message || 'Erreur lors de la création de l\'école. Veuillez réessayer.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-gold-50/20">
      <div className="flex min-h-screen">
        {/* Left Side - Hero */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-12 lg:px-20 bg-white/50 backdrop-blur-sm">
          <div className="text-center max-w-md">
            <h1 className="text-4xl font-display font-bold text-gray-900 mb-6">
              La plateforme ERP pour les écoles du Bénin
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              Transformez la gestion de votre école avec notre solution complète : notes, absences, cahier de texte, et bien plus encore.
            </p>

            {/* Features */}
            <div className="space-y-4 text-left w-full max-w-xl">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 1118 0z" />
                </svg>
                <span className="font-medium">Gestion complète des notes et bulletins</span>
              </div>
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 1118 0z" />
                </svg>
                <span className="font-medium">Suivi des absences en temps réel</span>
              </div>
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 1118 0z" />
                </svg>
                <span className="font-medium">Cahier de texte numérique</span>
              </div>
            </div>

            <div className="mt-10">
              <a href="#" className="inline-block bg-royal-gradient text-white px-6 py-3 rounded-lg font-semibold hover:bg-opacity-90 transition-colors transform hover:scale-[1.02]">
                Créer mon école gratuitement
              </a>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-1/2 bg-white flex flex-col justify-center px-8 sm:px-12 lg:px-16">
          <div className="w-full max-w-md mx-auto space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 text-center">
              {step === 1 ? 'Créer votre école' : 'Créer votre compte administrateur'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {step === 1 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nom de l'école *</label>
                    <input
                      type="text"
                      name="nom"
                      value={formData.nom}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Ex: École Jean De La Ville"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Abréviation de l'école *</label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="text"
                        name="abreviation"
                        value={formData.abreviation}
                        onChange={handleChange}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Ex: SLB, JDV"
                        maxLength="5"
                        required
                      />
                      <button
                        type="button"
                        onClick={handleCheckAbreviation}
                        disabled={!formData.abreviation || formData.abreviation.length < 2}
                        className="px-4 py-3 bg-gray-100 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Vérifier
                      </button>
                    </div>

                    {abrevCheck !== null && (
                      <p className={abrevCheck ? 'text-green-600 mt-1' : 'text-red-600 mt-1'}>
                        {abrevCheck === true
                          ? `L'abréviation "${formData.abreviation.toUpperCase()}" est disponible !`
                          : `L'abréviation "${formData.abreviation.toUpperCase()}" est déjà utilisée.`}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ville</label>
                    <input
                      type="text"
                      name="ville"
                      value={formData.ville}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Ex: Cotonou, Porto-Novo, Parakou"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Pays</label>
                    <input
                      type="text"
                      name="pays"
                      value={formData.pays}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      defaultValue="Bénin"
                    />
                  </div>
                </>
              )}

              {step >= 1 && step <= 2 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email de l'administrateur *</label>
                    <input
                      type="email"
                      name="adminEmail"
                      value={formData.adminEmail}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="admin@ecolejdlv.bj"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Mot de passe *</label>
                    <input
                      type="password"
                      name="adminPassword"
                      value={formData.adminPassword}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="••••••••"
                      minLength="6"
                      required
                    />
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Prénom (optionnel)</label>
                      <input
                        type="text"
                        name="adminPrenom"
                        value={formData.adminPrenom}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Ex: Jean"
                      />
                    </div>

                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nom (optionnel)</label>
                      <input
                        type="text"
                        name="adminNom"
                        value={formData.adminNom}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Ex: De La Ville"
                      />
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="text-center text-sm text-gray-500">
                    Les champs prénom et nom sont optionnels. Si laissés vides, ils seront définis par défaut.
                  </div>
                </>
              )}

              <div className="flex justify-between items-center">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={handlePreviousStep}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Retour
                  </button>
                )}

                <button
                  type={step === 2 ? 'submit' : 'button'}
                  onClick={step === 2 ? undefined : handleNextStep}
                  disabled={loading}
                  className="px-6 py-3 bg-royal-gradient text-white rounded-lg font-semibold hover:bg-opacity-90 transition-colors disabled:opacity-50"
                >
                  {step === 2 ? 'Créer mon école' : 'Étape suivante'}
                </button>
              </div>
            </form>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            <div className="mt-8 text-center text-sm text-gray-500">
              Vous avez déjà une école ? <a href="/login" className="text-primary-600 hover:text-primary-500">Connectez-vous ici</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;