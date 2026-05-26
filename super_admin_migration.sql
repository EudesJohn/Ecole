-- ============================================================
-- MIGRATION SUPER-ADMIN
-- Permet au rôle 'super_admin' d'accéder à toutes les données
-- À exécuter dans le SQL Editor de Supabase
-- ============================================================

-- 0. Modifier la contrainte de rôle dans la table profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'teacher', 'parent', 'super_admin'));

-- 1. Nouvelle fonction helper check_is_super_admin
CREATE OR REPLACE FUNCTION check_is_super_admin() RETURNS boolean AS $$
  BEGIN RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  ); END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Mise à jour des politiques RLS

-- PROFILES
DROP POLICY IF EXISTS "Admins manage school profiles" ON profiles;
CREATE POLICY "Admins manage school profiles" ON profiles FOR ALL
  USING ((check_is_admin() AND school_id = get_my_school_id()) OR check_is_super_admin());

DROP POLICY IF EXISTS "Own profile readable" ON profiles;
CREATE POLICY "Own profile readable" ON profiles FOR SELECT 
  USING (id = auth.uid() OR check_is_super_admin());

-- CLASSES
DROP POLICY IF EXISTS "School members read classes" ON classes;
CREATE POLICY "School members read classes" ON classes FOR SELECT
  USING (school_id = get_my_school_id() OR check_is_super_admin());

DROP POLICY IF EXISTS "Admins manage classes" ON classes;
CREATE POLICY "Admins manage classes" ON classes FOR ALL
  USING ((check_is_admin() AND school_id = get_my_school_id()) OR check_is_super_admin());

-- STUDENTS
DROP POLICY IF EXISTS "School students readable" ON students;
CREATE POLICY "School students readable" ON students FOR SELECT
  USING (
    (school_id = get_my_school_id() AND (check_is_admin() OR check_is_teacher() OR parent_id = auth.uid()))
    OR check_is_super_admin()
  );

DROP POLICY IF EXISTS "Admins manage students" ON students;
CREATE POLICY "Admins manage students" ON students FOR ALL
  USING ((check_is_admin() AND school_id = get_my_school_id()) OR check_is_super_admin());

-- MATIERES
DROP POLICY IF EXISTS "School members read subjects" ON matieres;
CREATE POLICY "School members read subjects" ON matieres FOR SELECT
  USING (school_id = get_my_school_id() OR check_is_super_admin());

DROP POLICY IF EXISTS "Admins manage subjects" ON matieres;
CREATE POLICY "Admins manage subjects" ON matieres FOR ALL
  USING ((check_is_admin() AND school_id = get_my_school_id()) OR check_is_super_admin());

-- GRADES
DROP POLICY IF EXISTS "Staff manage school grades" ON grades;
CREATE POLICY "Staff manage school grades" ON grades FOR ALL
  USING (((check_is_admin() OR check_is_teacher()) AND school_id = get_my_school_id()) OR check_is_super_admin());

DROP POLICY IF EXISTS "Parents read child grades" ON grades;
CREATE POLICY "Parents read child grades" ON grades FOR SELECT
  USING (
    (school_id = get_my_school_id() AND EXISTS (SELECT 1 FROM students WHERE id = grades.student_id AND parent_id = auth.uid()))
    OR check_is_super_admin()
  );

-- ABSENCES
DROP POLICY IF EXISTS "Staff view school absences" ON absences;
CREATE POLICY "Staff view school absences" ON absences FOR SELECT
  USING (((check_is_admin() OR check_is_teacher()) AND school_id = get_my_school_id()) OR check_is_super_admin());

DROP POLICY IF EXISTS "Staff insert school absences" ON absences;
CREATE POLICY "Staff insert school absences" ON absences FOR INSERT
  WITH CHECK (((check_is_admin() OR check_is_teacher()) AND school_id = get_my_school_id()) OR check_is_super_admin());

DROP POLICY IF EXISTS "Admins manage absences" ON absences;
CREATE POLICY "Admins manage absences" ON absences FOR ALL
  USING ((check_is_admin() AND school_id = get_my_school_id()) OR check_is_super_admin());

DROP POLICY IF EXISTS "Parents read child absences" ON absences;
CREATE POLICY "Parents read child absences" ON absences FOR SELECT
  USING (
    (school_id = get_my_school_id() AND EXISTS (SELECT 1 FROM students WHERE id = absences.student_id AND parent_id = auth.uid()))
    OR check_is_super_admin()
  );

-- CAHIER DE TEXTE
DROP POLICY IF EXISTS "School members read lessons" ON cahier_texte;
CREATE POLICY "School members read lessons" ON cahier_texte FOR SELECT
  USING (school_id = get_my_school_id() OR check_is_super_admin());

DROP POLICY IF EXISTS "Staff insert lessons" ON cahier_texte;
CREATE POLICY "Staff insert lessons" ON cahier_texte FOR INSERT
  WITH CHECK (((check_is_admin() OR check_is_teacher()) AND school_id = get_my_school_id()) OR check_is_super_admin());

DROP POLICY IF EXISTS "Staff manage lessons 12h" ON cahier_texte;
CREATE POLICY "Staff manage lessons 12h" ON cahier_texte FOR ALL
  USING (
    check_is_admin()
    OR check_is_super_admin()
    OR (teacher_id = auth.uid() AND created_at > now() - interval '12 hours')
  );

-- SCHOOL_CONFIG
DROP POLICY IF EXISTS "School members read config" ON school_config;
CREATE POLICY "School members read config" ON school_config FOR SELECT
  USING (school_id = get_my_school_id() OR school_id IS NULL OR check_is_super_admin());

DROP POLICY IF EXISTS "Admins manage config" ON school_config;
CREATE POLICY "Admins manage config" ON school_config FOR ALL
  USING ((check_is_admin() AND (school_id = get_my_school_id() OR school_id IS NULL)) OR check_is_super_admin());

-- school_config_mt
DROP POLICY IF EXISTS "School members read config_mt" ON school_config_mt;
CREATE POLICY "School members read config_mt" ON school_config_mt FOR SELECT
  USING (school_id = get_my_school_id() OR check_is_super_admin());

DROP POLICY IF EXISTS "Admins manage config_mt" ON school_config_mt;
CREATE POLICY "Admins manage config_mt" ON school_config_mt FOR ALL
  USING ((check_is_admin() AND school_id = get_my_school_id()) OR check_is_super_admin());

-- SCHOOLS
DROP POLICY IF EXISTS "Admin manages own school" ON schools;
CREATE POLICY "Admin manages own school" ON schools FOR ALL
  USING (id = get_my_school_id() OR check_is_super_admin());

SELECT 'Mise à jour des politiques RLS terminée !' as status;
