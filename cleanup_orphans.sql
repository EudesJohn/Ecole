-- ==========================================
-- SAINT LAMBERT ERP - MAINTENANCE & CLEANUP
-- ==========================================

-- 1. RESYNC MATRICULE SEQUENCE
-- Run this if you get "Duplicate Email" or "Duplicate Matricule" errors.
-- It resets the counter to the next available number.
SELECT setval('matricule_seq', (
  SELECT COALESCE(MAX(SUBSTRING(matricule FROM '^[0-9]+')::INTEGER), 0) + 1 
  FROM students
));

-- 2. IDENTIFY ORPHANED STUDENT RECORDS
-- Records in the students table that point to a non-existent parent profile.
SELECT id, matricule, prenom, nom 
FROM students 
WHERE parent_id NOT IN (SELECT id FROM profiles);

-- 3. INSTRUCTIONS FOR AUTH CLEANUP
-- If you still get "Email already registered" errors after running the resync above:
-- 1. Open your Supabase Dashboard -> Authentication.
-- 2. Search for the email mentioned in the error (e.g., 0001slb26@slb.bj).
-- 3. If that user exists but is NOT in your "students" table, delete them manually.
-- 4. These are "orphans" from previous failed registration attempts.
