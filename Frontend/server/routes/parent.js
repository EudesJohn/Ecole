const express = require('express');
const router = express.Router();
const { supabase } = require('../supabase');
const rateLimit = require('../middleware/rateLimit');
const safeError = require('../utils/safeError');

// Anti-énumération : max 30 vérifications de bulletin / 5 min / IP.
// (Limite douce : ne perturbe pas un parent qui vérifie quelques bulletins,
//  bloque les scripts qui scannent les matricules 0001, 0002, 0003...)
// Phase 3 (faille #3) : failClosed en production si Upstash tombe.
const bulletinRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: 'Trop de vérifications. Réessayez dans quelques minutes.',
  failClosed: true
});

/**
 * @route GET /api/parent/student/:matricule
 * @desc [OBSOLÈTE — faille #2] Ancienne recherche publique par matricule.
 *       Le matricule étant séquentiel (0001 SLB 26...), ce endpoint
 *       permettait d'énumérer noms, classes et résultats de mineurs.
 *       La vérification publique passe désormais par /verify/:token.
 *       Le endpoint renvoie 410 (Gone) pour que les vieux QR imprimés
 *       affichent une erreur explicite côté VerifyBulletin au lieu d'un
 *       404 générique.
 */
router.get('/student/:matricule', bulletinRateLimit, async (req, res) => {
  return res.status(410).json({
    error: 'Cette méthode de vérification n\'est plus disponible. Scannez le QR code du bulletin le plus récent.',
    code: 'VERIFY_BY_MATRICULE_REMOVED'
  });
});

/**
 * @route GET /api/parent/verify/:token?trimestre=&school_year=
 * @desc Vérification publique de bulletin par TOKEN aléatoire (faille #2).
 *       Le token (32 hex) est imprimé dans le QR code de chaque bulletin.
 *       Imposible à énumérer (128 bits d'entropie) contrairement au
 *       matricule séquentiel.
 */
router.get('/verify/:token', bulletinRateLimit, async (req, res) => {
  try {
    const { token } = req.params;

    // Format strict : 32 caractères hexadécimaux (générés par gen_random_bytes)
    if (!/^[a-f0-9]{32}$/i.test(token)) {
      return res.status(400).json({ error: 'Jeton de vérification invalide.' });
    }

    // 1. Résoudre l'élève via le token pour déduire SON école
    //    (FIND-017 : multi-tenant — on ne lit jamais la première
    //    config de la table, on lit celle de l'école de l'élève).
    const { data: studentRef, error: tokenError } = await supabase
      .from('students')
      .select('school_id')
      .eq('verify_token', token)
      .maybeSingle();

    if (tokenError) throw tokenError;

    if (!studentRef?.school_id) {
      return res.status(404).json({ error: 'Bulletin non trouvé ou non vérifié' });
    }

    const { data: configRows } = await supabase
      .from('school_config')
      .select('key, value')
      .eq('school_id', studentRef.school_id);

    let schoolConfig = null;
    if (configRows && configRows.length > 0) {
      schoolConfig = Object.fromEntries(configRows.map(r => [r.key, r.value]));
    }
    if (!schoolConfig) throw new Error('Configuration école introuvable');

    const trimestre = req.query.trimestre ? parseInt(req.query.trimestre) : parseInt(schoolConfig.current_trimestre);
    const schoolYear = req.query.school_year || schoolConfig.current_year;

    // 2. RPC sécurisée par token (voir hardening_phase3.sql section 3)
    const { data: verificationData, error } = await supabase
      .rpc('verify_bulletin_by_token', {
        p_token: token,
        p_trimestre: trimestre,
        p_school_year: schoolYear
      });

    if (error || !verificationData) {
      return res.status(404).json({ error: 'Bulletin non trouvé ou non vérifié' });
    }

    res.json(verificationData);

  } catch (error) {
    safeError(res, error, 'parent/verify');
  }
});

module.exports = router;
