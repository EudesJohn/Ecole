const express = require('express');
const router = express.Router();
const { supabase } = require('../supabase');
const rateLimit = require('../middleware/rateLimit');
const safeError = require('../utils/safeError');

// Anti-énumération : max 30 vérifications de bulletin / 5 min / IP.
// (Limite douce : ne perturbe pas un parent qui vérifie quelques bulletins,
//  bloque les scripts qui scannent les matricules 0001, 0002, 0003...)
const bulletinRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: 'Trop de vérifications. Réessayez dans quelques minutes.'
});

/**
 * @route GET /api/parent/student/:matricule
 * @desc Public search for student (parents view)
 */
router.get('/student/:matricule', bulletinRateLimit, async (req, res) => {
  try {
    const { matricule } = req.params;

    // 1. Récupérer la configuration actuelle de l'école
    const { data: schoolConfig } = await supabase.from('school_config').select('*').limit(1).single();
    if (!schoolConfig) throw new Error('Configuration école introuvable');

    const trimestre = req.query.trimestre ? parseInt(req.query.trimestre) : parseInt(schoolConfig.current_trimestre);
    const schoolYear = req.query.school_year || schoolConfig.current_year;

    // 2. Utilisation de la fonction SQL sécurisée
    const { data: verificationData, error } = await supabase
      .rpc('verify_bulletin', {
        p_matricule: matricule.trim(),
        p_trimestre: trimestre,
        p_school_year: schoolYear
      });

    if (error || !verificationData) {
      return res.status(404).json({ error: 'Bulletin non trouvé ou non vérifié' });
    }

    res.json(verificationData);

  } catch (error) {
    safeError(res, error, 'parent/lookup');
  }
});

module.exports = router;
