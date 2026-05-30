-- ============================================================
-- MIGRATION : Isolation multi-tenant RLS par school_id
-- Empêche les admins/professeurs de voir les données des
-- autres écoles via le client Supabase direct.
-- À exécuter dans Supabase SQL Editor (une seule fois)
-- ============================================================

-- ============================================================
-- 1. S'assurer que school_id existe sur toutes les tables
-- ============================================================
ALTER TABLE profiles     ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
ALTER TABLE classes      ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
ALTER TABLE students     ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
ALTER TABLE matieres     ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
ALTER TABLE school_config ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

-- Ces colonnes ont été ajoutées par le commit 4496e08 (vérification douce)
ALTER TABLE grades        ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
ALTER TABLE absences      ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
ALTER TABLE cahier_texte  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

-- ============================================================
-- 2. Helpers RLS
-- ============================================================

-- Retourne le school_id du profil de l'utilisateur connecté
CREATE OR REPLACE FUNCTION current_user_school_id() RETURNS UUID AS $$
  BEGIN
    RETURN (SELECT school_id FROM profiles WHERE id = auth.uid());
  END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vérifie si l'utilisateur est super_admin (peut tout voir)
CREATE OR REPLACE FUNCTION check_is_super_admin() RETURNS boolean AS $$
  BEGIN RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'); END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. Mise à jour des politiques RLS
-- ============================================================

-- ---- PROFILES ----
-- (inchangé : trop risqué, pourrait bloquer la connexion)

-- ---- CLASSES ----
-- Lecture publique : inchangé (USING true)
DROP POLICY IF EXISTS "Admins manage classes" ON classes;
CREATE POLICY "Admins manage classes" ON classes FOR ALL
USING (
  (check_is_admin() AND school_id = current_user_school_id())
  OR check_is_super_admin()
);

-- ---- MATIERES ----
-- Lecture publique : inchangé (USING true)
DROP POLICY IF EXISTS "Admins manage subjects" ON matieres;
CREATE POLICY "Admins manage subjects" ON matieres FOR ALL
USING (
  (check_is_admin() AND school_id = current_user_school_id())
  OR check_is_super_admin()
);

-- ---- STUDENTS ----
DROP POLICY IF EXISTS "Students readable by authorized" ON students;
CREATE POLICY "Students readable by authorized" ON students FOR SELECT
USING (
  parent_id = auth.uid()
  OR (check_is_admin() AND school_id = current_user_school_id())
  OR (check_is_teacher() AND school_id = current_user_school_id())
);

DROP POLICY IF EXISTS "Admins manage students" ON students;
CREATE POLICY "Admins manage students" ON students FOR ALL
USING (
  (check_is_admin() AND school_id = current_user_school_id())
  OR check_is_super_admin()
);

-- ---- GRADES ----
DROP POLICY IF EXISTS "Grades manageable" ON grades;
CREATE POLICY "Grades manageable" ON grades FOR ALL
USING (
  ((check_is_admin() OR check_is_teacher()) AND school_id = current_user_school_id())
  OR check_is_super_admin()
);

-- Parent policy : inchangé (déjà isolé via student_id -> parent_id)

-- ---- ABSENCES ----
DROP POLICY IF EXISTS "Admins/Teachers view absences" ON absences;
CREATE POLICY "Admins/Teachers view absences" ON absences FOR SELECT
USING (
  ((check_is_admin() OR check_is_teacher()) AND school_id = current_user_school_id())
  OR check_is_super_admin()
);

DROP POLICY IF EXISTS "Admins/Teachers insert absences" ON absences;
CREATE POLICY "Admins/Teachers insert absences" ON absences FOR INSERT
WITH CHECK (
  ((check_is_admin() OR check_is_teacher()) AND school_id = current_user_school_id())
  OR check_is_super_admin()
);

DROP POLICY IF EXISTS "Admins delete/update absences" ON absences;
CREATE POLICY "Admins delete/update absences" ON absences FOR ALL
USING (
  (check_is_admin() AND school_id = current_user_school_id())
  OR check_is_super_admin()
);

-- Parent policy : inchangé (déjà isolé)

-- ---- CAHIER DE TEXTE ----
-- Lecture publique : inchangé (USING true)
DROP POLICY IF EXISTS "Admins/Teachers insert lessons" ON cahier_texte;
CREATE POLICY "Admins/Teachers insert lessons" ON cahier_texte FOR INSERT
WITH CHECK (
  ((check_is_admin() OR check_is_teacher()) AND school_id = current_user_school_id())
  OR check_is_super_admin()
);

DROP POLICY IF EXISTS "Teacher/Admin update/delete lessons within 12h" ON cahier_texte;
CREATE POLICY "Teacher/Admin update/delete lessons within 12h" ON cahier_texte FOR ALL
USING (
  (check_is_admin() AND school_id = current_user_school_id())
  OR check_is_super_admin()
  OR (teacher_id = auth.uid() AND created_at > now() - interval '12 hours')
);

-- ---- SCHOOL CONFIG ----
-- Lecture publique : inchangé (USING true)
DROP POLICY IF EXISTS "Admins manage config" ON school_config;
CREATE POLICY "Admins manage config" ON school_config FOR ALL
USING (
  (check_is_admin() AND school_id = current_user_school_id())
  OR check_is_super_admin()
);

-- ============================================================
-- 4. Vérification
-- ============================================================
SELECT 'Migration RLS multi-tenant terminée !' as status;
