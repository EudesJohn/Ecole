const express = require('express');
const { supabase } = require('../supabase');
const verifyToken = require('../middleware/verifyToken');
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
    res.status(500).json({ error: error.message });
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
    console.error('Super admin delete school error:', error);
    res.status(500).json({ error: error.message });
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
    console.error('Super admin restrict school error:', error);
    res.status(500).json({ error: error.message });
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
    console.error('Super admin activate school error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
