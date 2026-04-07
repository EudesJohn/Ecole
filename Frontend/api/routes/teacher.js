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
    const { student_id, matiere_id, interro1, interro2, devoir, composition, trimestre } = req.body;

    if (!student_id || !matiere_id) {
      return res.status(400).json({ error: 'ID élève et ID matière requis' });
    }

    const { data, error } = await supabase
      .from('grades')
      .upsert({
        student_id,
        matiere_id,
        interro1: (interro1 !== undefined && interro1 !== '' && interro1 !== null) ? parseFloat(interro1) : null,
        interro2: (interro2 !== undefined && interro2 !== '' && interro2 !== null) ? parseFloat(interro2) : null,
        devoir: (devoir !== undefined && devoir !== '' && devoir !== null) ? parseFloat(devoir) : null,
        composition: (composition !== undefined && composition !== '' && composition !== null) ? parseFloat(composition) : null,
        trimestre: trimestre || 1,
        updated_at: new Date()
      }, { onConflict: 'student_id,matiere_id,trimestre' })
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
    const { student_id, classe_id, date, status } = req.body;

    const { data, error } = await supabase
      .from('absences')
      .upsert({
        student_id,
        classe_id,
        date: date || new Date().toISOString().split('T')[0],
        status: status || 'absent'
      }, { onConflict: 'student_id,date' })
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
