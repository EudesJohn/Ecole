const express = require('express');
const router = express.Router();
const { supabase } = require('../supabase');

/**
 * POST /api/schools/register
 * Inscription d'une nouvelle école sur la plateforme.
 * Crée l'école + un compte admin Supabase Auth automatiquement.
 */
router.post('/register', async (req, res) => {
  const { nom, abreviation, ville, pays, adminEmail, adminPassword, adminPrenom, adminNom } = req.body;

  if (!nom || !abreviation || !adminEmail || !adminPassword) {
    return res.status(400).json({ error: 'Champs obligatoires manquants (nom, abreviation, adminEmail, adminPassword).' });
  }

  const cleanAbrev = abreviation.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 5);
  if (cleanAbrev.length < 2) {
    return res.status(400).json({ error: "L'abréviation doit contenir au moins 2 lettres." });
  }

  try {
    // 1. Vérifier que l'abréviation n'est pas déjà prise
    const { data: existing } = await supabase
      .from('schools')
      .select('id')
      .eq('abreviation', cleanAbrev)
      .single();

    if (existing) {
      return res.status(409).json({ error: `L'abréviation "${cleanAbrev}" est déjà utilisée par une autre école.` });
    }

    // 2. Créer l'école dans la table schools
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .insert([{
        nom: nom.trim(),
        abreviation: cleanAbrev,
        ville: (ville || '').trim(),
        pays: (pays || 'Bénin').trim(),
        admin_email: adminEmail.trim().toLowerCase(),
        status: 'active'
      }])
      .select()
      .single();

    if (schoolError) {
      if (schoolError.code === '23505') {
        return res.status(409).json({ error: 'Cette adresse email est déjà utilisée.' });
      }
      throw schoolError;
    }

    // 3. Créer le compte admin dans Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail.trim().toLowerCase(),
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        role: 'admin',
        prenom: adminPrenom || 'Admin',
        nom: adminNom || nom,
        school_id: school.id
      }
    });

    if (authError) {
      // Rollback: supprimer l'école si la création de l'utilisateur échoue
      await supabase.from('schools').delete().eq('id', school.id);
      throw authError;
    }

    // 4. Mettre à jour le profil avec le school_id
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email: adminEmail.trim().toLowerCase(),
        prenom: adminPrenom || 'Admin',
        nom: adminNom || nom,
        role: 'admin',
        school_id: school.id
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('Profile upsert error:', profileError);
      // Non-fatal: le trigger handle_new_user l'a peut-être déjà créé
    }

    // 5. Créer la config initiale de l'école
    const defaultConfig = [
      { school_id: school.id, key: 'current_trimestre', value: '1' },
      { school_id: school.id, key: 'current_year', value: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1) },
      { school_id: school.id, key: 'primaire_compo_count', value: '3' },
      { school_id: school.id, key: 'maternelle_compo_count', value: '3' }
    ];

    await supabase.from('school_config_mt').insert(defaultConfig).select();

    return res.status(201).json({
      success: true,
      school: {
        id: school.id,
        nom: school.nom,
        abreviation: school.abreviation
      },
      message: `École "${school.nom}" créée avec succès ! Connectez-vous avec ${adminEmail}.`
    });

  } catch (err) {
    console.error('School registration error:', err);
    return res.status(500).json({ error: err.message || 'Erreur lors de la création de l\'école.' });
  }
});

/**
 * GET /api/schools/check-abreviation/:code
 * Vérifie si une abréviation est disponible.
 */
router.get('/check-abreviation/:code', async (req, res) => {
  const code = (req.params.code || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!code || code.length < 2) {
    return res.json({ available: false, message: 'Code trop court.' });
  }

  try {
    const { data } = await supabase
      .from('schools')
      .select('id, nom')
      .eq('abreviation', code)
      .single();

    if (data) {
      return res.json({ available: false, message: `"${code}" est déjà utilisé.` });
    }
    return res.json({ available: true, message: `"${code}" est disponible !` });
  } catch {
    return res.json({ available: true, message: `"${code}" est disponible !` });
  }
});

/**
 * GET /api/schools/info/:abreviation
 * Retourne les informations publiques d'une école par abréviation.
 * Utilisé par la page de login pour afficher le nom de l'école.
 */
router.get('/info/:abreviation', async (req, res) => {
  const code = (req.params.abreviation || '').toUpperCase().replace(/[^A-Z]/g, '');
  try {
    const { data, error } = await supabase
      .from('schools')
      .select('id, nom, abreviation, ville, pays, logo_url')
      .eq('abreviation', code)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'École non trouvée.' });
    }
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/schools/my-school
 * Retourne les infos de l'école de l'admin connecté.
 * (Nécessite un header Authorization avec le JWT Supabase)
 */
router.get('/my-school', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorisé.' });

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Token invalide.' });

    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id, role')
      .eq('id', user.id)
      .single();

    if (!profile?.school_id) return res.status(404).json({ error: 'Profil sans école.' });

    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('*')
      .eq('id', profile.school_id)
      .single();

    if (schoolError) throw schoolError;
    return res.json(school);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/schools/my-school
 * Permet à l'admin de modifier les infos de son école.
 */
router.patch('/my-school', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorisé.' });

  const { nom, ville, pays, logo_url } = req.body;

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Token invalide.' });

    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id, role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }

    const updates = {};
    if (nom !== undefined) updates.nom = nom.trim();
    if (ville !== undefined) updates.ville = ville.trim();
    if (pays !== undefined) updates.pays = pays.trim();
    if (logo_url !== undefined) updates.logo_url = logo_url;

    const { data: updated, error: updateError } = await supabase
      .from('schools')
      .update(updates)
      .eq('id', profile.school_id)
      .select()
      .single();

    if (updateError) throw updateError;
    return res.json({ success: true, school: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
