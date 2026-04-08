const express = require('express');
const { supabase } = require('../supabase');
const generateMatricule = require('../utils/generateMatricule');
const verifyToken = require('../middleware/verifyToken');
const crypto = require('crypto');
const router = express.Router();

// Generate 12-char CSPRNG password (6 bytes)
const generateSecurePassword = () => crypto.randomBytes(6).toString('hex');

// Admin middleware
router.use(verifyToken, (req, res, next) => {
  if (req.role !== 'admin') return res.status(403).json({ error: 'Admin required' });
  next();
});

// Generate matricule
router.post('/matricule', async (req, res) => {
  try {
    const matricule = await generateMatricule();
    res.json({ matricule });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add student
router.post('/students', async (req, res) => {
  let createdUserId = null;
  try {
    const { nom, prenom, classe_id, date_naissance, sexe } = req.body;
    const matricule = await generateMatricule();
    const pin = generateSecurePassword();
    const email = `${matricule.replace(/\s+/g, '').toLowerCase()}@slb.bj`;
    
    // 1. Create Parent Auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
      user_metadata: { role: 'parent', prenom, nom }
    });

    if (authError) throw authError;
    createdUserId = authUser.user.id;
    
    // 2. Force role in profiles
    const { error: profileError } = await supabase.from('profiles').update({ role: 'parent' }).eq('id', createdUserId);
    if (profileError) throw profileError;
    
    // 3. Insert student record
    const { error: studentError } = await supabase
      .from('students')
      .insert([{
        matricule,
        nom,
        prenom,
        classe_id,
        date_naissance,
        sexe,
        parent_id: createdUserId,
        pin_code: pin
      }]);

    if (studentError) throw studentError;
    
    res.json({ success: true, matricule, pin });
  } catch (error) {
    console.error('Student creation failed:', error);
    if (createdUserId) {
      await supabase.auth.admin.deleteUser(createdUserId).catch(e => console.error('Rollback failed:', e));
    }
    res.status(500).json({ error: error.message });
  }
});

// Get all students (admin)
router.get('/students', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('*, classes(nom)');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new teacher account.
router.post('/teachers', async (req, res) => {
  let createdUserId = null;
  try {
    const { email, prenom, nom, matiere, classe_assignee } = req.body;
    let { password } = req.body;

    if (!email) return res.status(400).json({ error: 'Email required' });
    if (!password) password = generateSecurePassword();

    const matiereArray = Array.isArray(matiere) ? matiere : (matiere ? [matiere] : []);
    const classeArray = Array.isArray(classe_assignee) ? classe_assignee : (classe_assignee ? [classe_assignee] : []);

    // 1. Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { prenom, nom, role: 'teacher' }
    });

    if (authError) throw authError;
    createdUserId = authUser.user.id;

    // 2. Update profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        role: 'teacher', 
        matiere: matiereArray, 
        classe_assignee: classeArray 
      })
      .eq('id', createdUserId);

    if (profileError) throw profileError;

    res.json({ success: true, teacherId: createdUserId, password });
  } catch (error) {
    console.error('Teacher creation failed:', error);
    if (createdUserId) {
      await supabase.auth.admin.deleteUser(createdUserId).catch(e => console.error('Rollback failed:', e));
    }
    res.status(500).json({ error: error.message || 'Error during teacher creation' });
  }
});

// Reset teacher password.
// Needs: id, newPassword
router.post('/teachers/reset-password', async (req, res) => {
  try {
    const { id, newPassword } = req.body;

    if (!id || !newPassword) {
      return res.status(400).json({ error: 'ID and new password required' });
    }

    const { error } = await supabase.auth.admin.updateUserById(id, {
      password: newPassword
    });

    if (error) throw error;
    res.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

