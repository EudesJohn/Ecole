const express = require('express');
const { supabase, supabaseVerify } = require('../supabase');
const generateMatricule = require('../utils/generateMatricule');
const verifyToken = require('../middleware/verifyToken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { stripTags, sanitizeEmail, isValidEmail, sanitizeObject } = require('../middleware/sanitize');
const rateLimit = require('../middleware/rateLimit');
const safeError = require('../utils/safeError');
const router = express.Router();

// Anti email-bombing : max 5 demandes de récupération / heure / IP.
const recoverRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Trop de demandes de récupération. Réessayez plus tard.'
});

// Generate 12-char CSPRNG password (6 bytes)
const generateSecurePassword = () => crypto.randomBytes(6).toString('hex');

// Password recovery via email (forgot password) — MUST be before auth middleware
router.post('/recover-password', recoverRateLimit, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user exists with this email
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('email', email)
      .single();

    if (profileError || !profiles) {
      // Don't reveal whether email exists for security
      return res.json({
        success: true,
        message: 'If this email exists in our system, a recovery link has been sent'
      });
    }

    // Generate a recovery token (Supabase handles this automatically)
    const origin = req.headers.origin || req.headers.referer || 'https://ecole.vercel.app';
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`
    });

    if (error) throw error;

    res.json({ success: true, message: 'Password recovery email sent successfully' });
  } catch (error) {
safeError(res, error, 'admin/recover');
  }
});

// Admin middleware
router.use(verifyToken, (req, res, next) => {
  if (req.path === '/recover-password') return next();
  if (req.role !== 'admin' && req.role !== 'super_admin') return res.status(403).json({ error: 'Admin or Super Admin required' });
  next();
});

// Generate matricule
router.post('/matricule', async (req, res) => {
  try {
    const { data: school } = await supabase
      .from('schools')
      .select('abreviation')
      .eq('id', req.schoolId)
      .single();
    const schoolAbbrev = school?.abreviation || 'SLB';

    const matricule = await generateMatricule(req.schoolId, schoolAbbrev);
    res.json({ matricule });
  } catch (error) {
    safeError(res, error, 'admin/matricule');
  }
});

// Add student
router.post('/students', async (req, res) => {
  let createdUserId = null;
  try {
    let { nom, prenom, classe_id, date_naissance, sexe, telephone_parent } = req.body;
    const sanitized = sanitizeObject({ nom, prenom, telephone_parent }, ['nom', 'prenom', 'telephone_parent']);
    nom = sanitized.nom;
    prenom = sanitized.prenom;
    telephone_parent = sanitized.telephone_parent;

    if (!nom || !prenom) {
      return res.status(400).json({ error: 'Nom et prénom requis.' });
    }

    const { data: school } = await supabase
      .from('schools')
      .select('abreviation')
      .eq('id', req.schoolId)
      .single();
    const schoolAbbrev = school?.abreviation || 'SLB';

    const matricule = await generateMatricule(req.schoolId, schoolAbbrev);
    const pin = generateSecurePassword();

    // Phase 3 (faille #2) : le token de vérification publique du bulletin
    // N'EST PAS généré ici — le trigger SQL students_set_verify_token
    // (migration hardening_phase3.sql §2b) l'attribue à l'INSERT, quel que
    // soit le chemin de création (backend ou dashboard admin). Avantage :
    // le code fonctionne AVANT comme APRÈS l'exécution de la migration.
    // Sécurité (FIND-004) : le PIN est hashé en base (bcrypt). Le PIN en
    // clair reste retourné à l'admin dans la réponse ci-dessous — l'UX
    // est identique. Le login parent passe par Supabase Auth (mot de
    // passe), la colonne pin_code n'est jamais utilisée pour s'authentifier.
    const pin_hash = await bcrypt.hash(pin, 12);
    const email = `${matricule.replace(/\s+/g, '').toLowerCase()}@${schoolAbbrev.toLowerCase()}.bj`;
    
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
      user_metadata: { role: 'parent', prenom, nom, school_id: req.schoolId }
    });

    if (authError) throw authError;
    createdUserId = authUser.user.id;
    
    // 2. Force role in profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ role: 'parent', school_id: req.schoolId })
      .eq('id', createdUserId);
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
        pin_code: pin_hash,
        school_id: req.schoolId
      }]);

    if (studentError) throw studentError;
    
    res.json({ success: true, matricule, pin });
  } catch (error) {
    console.error('Student creation failed:', error);
    if (createdUserId) {
      await supabase.auth.admin.deleteUser(createdUserId).catch(e => console.error('Rollback failed:', e));
    }
    safeError(res, error, 'admin/students');
  }
});

// Get all students (admin)
// Sécurité (FIND-004) : pin_code n'est PLUS renvoyé dans la liste.
// Le PIN reste visible : à la création (POST /students) et à la
// réinitialisation (POST /students/reset-pin). Pour redonner un PIN
// à un parent, l'admin utilise "Réinitialiser le PIN".
router.get('/students', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('id, matricule, nom, prenom, classe_id, sexe, date_naissance, telephone_parent, parent_id, created_at, classes(nom)')
      .eq('school_id', req.schoolId);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    safeError(res, error, 'admin/students-list');
  }
});

// Create new teacher account.
router.post('/teachers', async (req, res) => {
  let createdUserId = null;
  try {
    let { email, prenom, nom, matiere, classe_assignee } = req.body;
    let { password } = req.body;

    const sanitized = sanitizeObject({ prenom, nom }, ['prenom', 'nom']);
    prenom = sanitized.prenom;
    nom = sanitized.nom;
    email = sanitizeEmail(email);

    if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Email valide requis.' });
    if (!prenom || !nom) return res.status(400).json({ error: 'Prénom et nom requis.' });
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
      user_metadata: { prenom, nom, role: 'teacher', school_id: req.schoolId }
    });

    if (authError) throw authError;
    createdUserId = authUser.user.id;

    // 2. Update profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        role: 'teacher', 
        matiere: matiereArray, 
        classe_assignee: classeArray,
        school_id: req.schoolId
      })
      .eq('id', createdUserId);

    if (profileError) throw profileError;

    res.json({ success: true, teacherId: createdUserId, password });
  } catch (error) {
    console.error('Teacher creation failed:', error);
    if (createdUserId) {
      await supabase.auth.admin.deleteUser(createdUserId).catch(e => console.error('Rollback failed:', e));
    }
    safeError(res, error, 'admin/teachers');
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

    // Verify the teacher belongs to this admin's school
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', id)
      .eq('role', 'teacher')
      .eq('school_id', req.schoolId)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({ error: 'Enseignant introuvable dans votre établissement.' });
    }

    const { error } = await supabase.auth.admin.updateUserById(id, {
      password: newPassword
    });

    if (error) throw error;
    res.json({ success: true, password: newPassword, message: 'Password reset successful' });
  } catch (error) {
    console.error('Password reset error:', error);
    safeError(res, error, 'admin/teacher-reset');
  }
});

// Reset student PIN (Parent password).
router.post('/students/reset-pin', async (req, res) => {
  try {
    const { id } = req.body;
    let { newPin } = req.body;

    if (!id) return res.status(400).json({ error: 'Student ID required' });
    if (!newPin) newPin = generateSecurePassword();
    // Sécurité (FIND-004) : hash du PIN avant stockage (voir /students).
    const newPinHash = await bcrypt.hash(newPin, 12);

    // Verify the student belongs to this admin's school
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, parent_id')
      .eq('id', id)
      .eq('school_id', req.schoolId)
      .single();

    if (studentError || !student) {
      return res.status(403).json({ error: 'Élève introuvable dans votre établissement.' });
    }

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

    // 2. Update students table
    const { error: studentUpdateError } = await supabase
      .from('students')
      .update({ pin_code: newPinHash })
      .eq('id', id)
      .eq('school_id', req.schoolId);

    if (studentUpdateError) throw studentUpdateError;

    res.json({ success: true, pin: newPin });
  } catch (error) {
    console.error('PIN reset error:', error);
    safeError(res, error, 'admin/pin-reset');
  }
});

// Admin password reset/recovery for their own account
router.post('/reset-own-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }

    // FIX (FIND-010) : l'ID vient de req.user (posé par verifyToken),
    // pas de req.userId qui n'a jamais existé.
    const adminId = req.user?.id;
    const adminEmail = req.user?.email;

    if (!adminId || !adminEmail) {
      return res.status(403).json({ error: 'Admin not authenticated' });
    }

    // Verify current password if provided
    if (currentPassword) {
      // On utilise le client anon (supabaseVerify) : signInWithPassword
      // vérifie réellement le mot de passe auprès de Supabase Auth.
      const { error: reauthError } = await supabaseVerify.auth.signInWithPassword({
        email: adminEmail,
        password: currentPassword
      });

      if (reauthError) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }

    // Update the password
    const { error } = await supabase.auth.admin.updateUserById(adminId, {
      password: newPassword
    });

    if (error) throw error;

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Admin password reset error:', error);
    safeError(res, error, 'admin/own-reset');
  }
});

module.exports = router;

