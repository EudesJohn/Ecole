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

    // Add student/teacher counts for each school
    const enriched = await Promise.all((schools || []).map(async (school) => {
      const { count: studentCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', school.id);

      const { count: teacherCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', school.id)
        .eq('role', 'teacher');

      return {
        ...school,
        student_count: studentCount || 0,
        teacher_count: teacherCount || 0
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
      'cahiers_texte',
      'bulletin_requests',
      'school_config_mt',
      'classes',
      'matieres',
    ];

    for (const table of tablesToClean) {
      const { error: cleanError } = await supabase.from(table).delete().eq('school_id', id);
      if (cleanError) console.warn(`Cleanup warning for ${table}:`, cleanError.message);
    }

    // Delete students
    const { error: studentsError } = await supabase.from('students').delete().eq('school_id', id);
    if (studentsError) console.warn('Cleanup warning for students:', studentsError.message);

    // Nullify school_id on profiles (so the school can be deleted without FK issues)
    const { error: profilesError } = await supabase
      .from('profiles')
      .update({ school_id: null })
      .eq('school_id', id);
    if (profilesError) console.warn('Cleanup warning for profiles:', profilesError.message);

    // Delete auth users for this school (parents + teachers + admins)
    const allUserIds = [...parentIds, ...profileIds];
    for (const userId of allUserIds) {
      const { error: delErr } = await supabase.auth.admin.deleteUser(userId);
      if (delErr) console.warn(`Failed to delete auth user ${userId}:`, delErr.message);
    }

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
