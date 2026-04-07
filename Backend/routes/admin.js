const express = require('express');
const { supabase } = require('../server');
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
  try {
    const { nom, prenom, classe_id, date_naissance, sexe } = req.body;
    const matricule = await generateMatricule();
    
    // Générer Mot de passe sécurisé (8 caractères)
    const pin = generateSecurePassword();
    const email = `${matricule.replace(/\s+/g, '').toLowerCase()}@slb.bj`; // e.g., 0001slb26@slb.bj
    
    // Create Parent Auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
      user_metadata: { role: 'parent', prenom, nom }
    });

    if (authError) throw authError;
    
    // Force role in profiles explicitly (if trigger didn't handle it well)
    await supabase.from('profiles').update({ role: 'parent' }).eq('id', authUser.user.id);
    
    const { error } = await supabase
      .from('students')
      .insert([{
        matricule,
        nom,
        prenom,
        classe_id,
        date_naissance,
        sexe,
        parent_id: authUser.user.id,
        pin_code: pin
      }]);

    if (error) {
       // Rollback user if student insert fails
       await supabase.auth.admin.deleteUser(authUser.user.id);
       throw error;
    }
    
    res.json({ success: true, matricule, pin });
  } catch (error) {
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
// Needs: email, prenom, nom, matiere, classe_assignee
router.post('/teachers', async (req, res) => {
  try {
    const { email, prenom, nom, matiere, classe_assignee } = req.body;
    let { password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }
    
    // Si pas de password fourni (venant du Frontend), on génère en Backend
    if (!password) {
       password = generateSecurePassword();
    }

    // 1. Create user in Supabase Auth using admin privileges
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { prenom, nom, role: 'teacher' }
    });

    if (authError) throw authError;

    // 2. The trigger "handle_new_user" in Postgres created the profile.
    // Now we update the extra fields (matiere, classe_assignee, and force role).
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ role: 'teacher', matiere, classe_assignee })
      .eq('id', authUser.user.id);

    if (profileError) throw profileError;

    res.json({ success: true, teacherId: authUser.user.id, password });
  } catch (error) {
    console.error('Teacher creation error:', error);
    res.status(500).json({ error: error.message });
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

