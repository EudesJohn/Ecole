const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { supabase } = require('../supabase');

// Middleware to ensure user is a teacher
router.use(verifyToken, (req, res, next) => {
  if (req.role !== 'teacher' && req.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux enseignants' });
  }
  next();
});

/**
 * @route POST /api/teacher/grades
 * @desc Add or update a grade for a student
 */
router.post('/grades', async (req, res) => {
  try {
    const { student_id, matiere_id, interro1, interro2, dw, d1, d2, note_cm, note_cp, composition, trimestre, evaluation_type } = req.body;

    if (!student_id || !matiere_id) {
      return res.status(400).json({ error: 'ID élève et ID matière requis' });
    }

    // Verify the student belongs to this teacher's school
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('id', student_id)
      .eq('school_id', req.schoolId)
      .single();

    if (studentError || !student) {
      return res.status(403).json({ error: 'Élève introuvable dans votre établissement.' });
    }

    const { data, error } = await supabase
      .from('grades')
      .upsert({
        student_id,
        matiere_id,
        school_id: req.schoolId,
        interro1: parseFloat(interro1) || null,
        interro2: parseFloat(interro2) || null,
        dw: parseFloat(dw) || null,
        d1: parseFloat(d1) || null,
        d2: parseFloat(d2) || null,
        note_cm: parseFloat(note_cm) || null,
        note_cp: parseFloat(note_cp) || null,
        composition: parseFloat(composition) || null,
        trimestre: trimestre || 1,
        school_year: req.body.school_year || '2025-2026',
        evaluation_type: evaluation_type || 'etape',
        updated_at: new Date()
      }, { onConflict: 'student_id,matiere_id,trimestre,school_year,evaluation_type' })
      .select();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Grade Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/teacher/absences
 * @desc Mark a student as present or absent
 */
router.post('/absences', async (req, res) => {
  try {
    const { student_id, classe_id, matiere_id, date, status, school_year } = req.body;

    // Verify the student belongs to this teacher's school
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('id', student_id)
      .eq('school_id', req.schoolId)
      .single();

    if (studentError || !student) {
      return res.status(403).json({ error: 'Élève introuvable dans votre établissement.' });
    }

    const { data, error } = await supabase
      .from('absences')
      .upsert({
        student_id,
        classe_id,
        matiere_id,
        school_id: req.schoolId,
        date: date || new Date().toISOString().split('T')[0],
        status: status || 'absent',
        school_year: school_year || '2025-2026'
      }, { onConflict: 'student_id,date,matiere_id,school_year' })
      .select();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/teacher/class/:classe_id
 * @desc Get all students for a specific class
 */
router.get('/class/:classe_id', async (req, res) => {
  try {
    const { classe_id } = req.params;

    // Verify the class belongs to this teacher's school
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id')
      .eq('id', classe_id)
      .eq('school_id', req.schoolId)
      .single();

    if (classError || !classData) {
      return res.status(403).json({ error: 'Classe introuvable dans votre établissement.' });
    }

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('classe_id', classe_id)
      .order('nom');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
