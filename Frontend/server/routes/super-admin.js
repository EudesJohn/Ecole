const express = require('express');
const { supabase } = require('../supabase');
const verifyToken = require('../middleware/verifyToken');
const safeError = require('../utils/safeError');
const { sanitizeEmail, isValidEmail, sanitizeObject } = require('../middleware/sanitize');
const router = express.Router();

// All super-admin routes require auth + super_admin role
router.use(verifyToken);
router.use((req, res, next) => {
  if (req.role !== 'super_admin') {
    return res.status(403).json({ error: 'Accès super administrateur requis' });
  }
  next();
});

// GET / - List all schools with stats
router.get('/', async (req, res) => {
  try {
    const { data: schools, error } = await supabase
      .from('schools')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Add student/teacher counts for each school (queries in parallel per school)
    const enriched = await Promise.all((schools || []).map(async (school) => {
      const [studentResult, teacherResult] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', school.id),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('school_id', school.id).eq('role', 'teacher')
      ]);

      return {
        ...school,
        student_count: studentResult.count || 0,
        teacher_count: teacherResult.count || 0
      };
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Super admin list schools error:', error);
    safeError(res, error, 'super-admin/list');
  }
});

// POST /schools - Créer une école + son compte admin
// Phase 3 (faille #1) : remplace l'auto-inscription publique fermée
// (POST /api/schools/register). Le super-admin crée les écoles depuis
// son panneau — le compte admin Supabase est créé via service_role,
// exactement comme le faisait l'ancien endpoint. Même structure de
// réponse et mêmes écrans frontend derrière.
router.post('/schools', async (req, res) => {
  try {
    let { nom, abreviation, ville, pays, adminEmail, adminPassword, adminPrenom, adminNom } = req.body;

    const sanitized = sanitizeObject({ nom, ville, pays, adminPrenom, adminNom }, ['nom', 'ville', 'pays', 'adminPrenom', 'adminNom']);
    nom = sanitized.nom;
    ville = sanitized.ville;
    pays = sanitized.pays;
    adminPrenom = sanitized.adminPrenom;
    adminNom = sanitized.adminNom;
    adminEmail = sanitizeEmail(adminEmail);

    if (!nom || !abreviation || !adminEmail || !adminPassword) {
      return res.status(400).json({ error: 'Champs obligatoires manquants (nom, abreviation, adminEmail, adminPassword).' });
    }
    if (!isValidEmail(adminEmail)) {
      return res.status(400).json({ error: "Format d'email administrateur invalide." });
    }
    if (String(adminPassword).length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    const cleanAbrev = String(abreviation).toUpperCase().replace(/[^A-Z]/g, '').substring(0, 5);
    if (cleanAbrev.length < 2) {
      return res.status(400).json({ error: "L'abréviation doit contenir au moins 2 lettres." });
    }

    // Abréviation déjà prise ?
    const { data: existing } = await supabase
      .from('schools')
      .select('id')
      .eq('abreviation', cleanAbrev)
      .single();
    if (existing) {
      return res.status(409).json({ error: `L'abréviation "${cleanAbrev}" est déjà utilisée par une autre école.` });
    }

    // 1. Créer l'école
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

    // 2. Créer le compte admin Supabase Auth
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
      await supabase.from('schools').delete().eq('id', school.id);
      throw authError;
    }

    // 3. Profil admin
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
    if (profileError) console.error('Profile upsert error:', profileError);

    // 4. Config initiale (identique à l'ancien endpoint public)
    const now = new Date();
    const defaultConfig = [
      { school_id: school.id, key: 'current_trimestre', value: '1' },
      { school_id: school.id, key: 'current_year', value: now.getFullYear() + '-' + (now.getFullYear() + 1) },
      { school_id: school.id, key: 'primaire_compo_count', value: '3' },
      { school_id: school.id, key: 'maternelle_compo_count', value: '3' }
    ];
    await supabase.from('school_config').insert(defaultConfig);

    return res.status(201).json({
      success: true,
      school: { id: school.id, nom: school.nom, abreviation: school.abreviation },
      message: `École "${school.nom}" créée. L'admin se connecte avec ${adminEmail}.`
    });
  } catch (error) {
    safeError(res, error, 'super-admin/create-school');
  }
});

// DELETE /schools/:id - Delete a school and all its data
router.delete('/schools/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get school info first
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id, nom, abreviation')
      .eq('id', id)
      .single();

    if (schoolError || !school) {
      return res.status(404).json({ error: 'École non trouvée' });
    }

    // Get all students to find parent user IDs
    const { data: students } = await supabase
      .from('students')
      .select('parent_id')
      .eq('school_id', id);

    const parentIds = (students || []).map(s => s.parent_id).filter(Boolean);

    // Get all profiles for this school (teachers, admins)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('school_id', id);

    const profileIds = (profiles || []).map(p => p.id);

    // Delete in order: grades, absences, cahiers, student records, then school data
    const tablesToClean = [
      'grades',
      'absences',
      'cahier_texte',
      'bulletin_requests',
      'school_config',  // principal table used by all frontend hooks
      'classes',
      'matieres',
    ];

    // Combine all auth user IDs to delete (parents + teachers/admins)
    const allUserIds = [...new Set([...parentIds, ...profileIds])];

    // Run all cleanup operations in parallel — they are independent (all filter on school_id)
    const cleanupTables = tablesToClean.map(table =>
      supabase.from(table).delete().eq('school_id', id)
    );

    const results = await Promise.all([
      ...cleanupTables,
      supabase.from('students').delete().eq('school_id', id),
      supabase.from('profiles').update({ school_id: null }).eq('school_id', id),
      ...allUserIds.map(userId => supabase.auth.admin.deleteUser(userId))
    ]);

    // Log any cleanup warnings
    results.forEach((result, i) => {
      if (result.error) {
        const label = i < tablesToClean.length ? tablesToClean[i]
          : i === tablesToClean.length ? 'students'
          : i === tablesToClean.length + 1 ? 'profiles'
          : `auth user ${allUserIds[i - tablesToClean.length - 2]}`;
        console.warn(`Cleanup warning for ${label}:`, result.error.message);
      }
    });

    // Finally delete the school
    const { error: deleteError } = await supabase
      .from('schools')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    res.json({
      success: true,
      message: `École "${school.nom}" supprimée avec succès`
    });
  } catch (error) {
safeError(res, error, 'super-admin/delete');
  }
});

// PATCH /schools/:id/restrict - Restrict a school for a period
router.patch('/schools/:id/restrict', async (req, res) => {
  try {
    const { id } = req.params;
    const { days, reason } = req.body;

    if (!days || days < 1) {
      return res.status(400).json({ error: 'Le nombre de jours doit être supérieur à 0' });
    }

    const restrictedUntil = new Date();
    restrictedUntil.setDate(restrictedUntil.getDate() + days);

    const { data, error } = await supabase
      .from('schools')
      .update({
        status: 'restricted',
        restricted_until: restrictedUntil.toISOString(),
        restriction_reason: reason || 'Non spécifié',
        restricted_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: `École "${data.nom}" restreinte jusqu'au ${restrictedUntil.toLocaleDateString('fr-FR')}`,
      school: data
    });
  } catch (error) {
safeError(res, error, 'super-admin/restrict');
  }
});

// PATCH /schools/:id/activate - Reactivate a restricted school
router.patch('/schools/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('schools')
      .update({
        status: 'active',
        restricted_until: null,
        restriction_reason: null,
        restricted_at: null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: `École "${data.nom}" réactivée avec succès`,
      school: data
    });
  } catch (error) {
safeError(res, error, 'super-admin/activate');
  }
});

module.exports = router;
