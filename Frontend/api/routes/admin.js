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
    const { nom, prenom, classe_id, date_naissance, sexe, telephone_parent } = req.body;
    const matricule = await generateMatricule();
    const pin = generateSecurePassword();
    const email = `${matricule.replace(/\s+/g, '').toLowerCase()}@slb.bj`;
    
    // 0. Vérifier si un orphelin existe déjà (email présent en Auth mais pas en SQL)
    const { data: existingProfiles } = await supabase.from('profiles').select('id').eq('email', email);
    if (existingProfiles && existingProfiles.length === 0) {
      // Si l'email est dans Auth mais pas Profile, on tente de supprimer l'orphelin d'abord
      const { data: users } = await supabase.auth.admin.listUsers();
      const existingAuthUser = users.users.find(u => u.email === email);
      if (existingAuthUser) {
        await supabase.auth.admin.deleteUser(existingAuthUser.id);
      }
    }

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
        telephone_parent,
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

    // 0. Vérifier si un orphelin existe déjà
    const { data: existingProfiles } = await supabase.from('profiles').select('id').eq('email', email);
    if (!existingProfiles || existingProfiles.length === 0) {
      const { data: users } = await supabase.auth.admin.listUsers();
      const existingAuthUser = users.users.find(u => u.email === email);
      if (existingAuthUser) {
        await supabase.auth.admin.deleteUser(existingAuthUser.id);
      }
    }

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
// Needs: id, optional newPassword
router.post('/teachers/reset-password', async (req, res) => {
  try {
    const { id } = req.body;
    let { newPassword } = req.body;

    if (!id) return res.status(400).json({ error: 'Teacher ID required' });
    if (!newPassword) newPassword = generateSecurePassword();

    const { error } = await supabase.auth.admin.updateUserById(id, {
      password: newPassword
    });

    if (error) throw error;
    res.json({ success: true, password: newPassword, message: 'Password reset successful' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset student PIN (Parent password).
router.post('/students/reset-pin', async (req, res) => {
  try {
    const { id } = req.body;
    let { newPin } = req.body;

    if (!id) return res.status(400).json({ error: 'Student ID required' });
    if (!newPin) newPin = generateSecurePassword();

    // 1. Update students table
    const { data: student, error: studentError } = await supabase
      .from('students')
      .update({ pin_code: newPin })
      .eq('id', id)
      .select('parent_id')
      .single();

    if (studentError) throw studentError;

    // 1. Update Auth password for parent FIRST
    if (student.parent_id) {
      const { error: authError } = await supabase.auth.admin.updateUserById(student.parent_id, {
        password: newPin
      });
      if (authError) {
        console.error('Auth update failed for parent:', authError.message);
        throw authError;
      }
    }

    // 2. Update students table (as fallback and for admin visibility)
    const { error: studentUpdateError } = await supabase
      .from('students')
      .update({ pin_code: newPin })
      .eq('id', id);

    if (studentUpdateError) throw studentUpdateError;

    res.json({ success: true, pin: newPin });
  } catch (error) {
    console.error('PIN reset error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

