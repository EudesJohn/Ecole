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

    // 1. Récupérer la configuration de l'école de l'élève (FIND-017 :
    //    multi-tenant — le matricule est unique, on déduit SON école,
    //    au lieu de lire la première config de la table).
    let schoolConfig = null;
    const { data: studentRef } = await supabase
      .from('students')
      .select('school_id')
      .eq('matricule', matricule.trim())
      .maybeSingle();

    if (studentRef?.school_id) {
      const { data: configRows } = await supabase
        .from('school_config')
        .select('key, value')
        .eq('school_id', studentRef.school_id);
      if (configRows && configRows.length > 0) {
        schoolConfig = Object.fromEntries(configRows.map(r => [r.key, r.value]));
      }
    }

    // Fallback compatibilité mono-école (comportement historique)
    if (!schoolConfig) {
      const { data: legacyConfig } = await supabase.from('school_config').select('*').limit(1).single();
      schoolConfig = legacyConfig;
    }
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
