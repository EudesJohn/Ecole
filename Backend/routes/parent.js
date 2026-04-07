const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { supabase } = require('../server');

/**
 * @route GET /api/parent/student/:matricule
 * @desc Public search for student (parents view)
 */
router.get('/student/:matricule', async (req, res) => {
  try {
    const { matricule } = req.params;

    // Utilisation de la fonction SQL sécurisée pour ne renvoyer que l'essentiel
    const { data: verificationData, error } = await supabase
      .rpc('verify_bulletin', {
        p_matricule: matricule.trim(),
        p_trimestre: 1
      });

    if (error || !verificationData) {
      return res.status(404).json({ error: 'Bulletin non trouvé ou non vérifié' });
    }

    res.json(verificationData);

  } catch (error) {
    console.error('Parent Lookup Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
