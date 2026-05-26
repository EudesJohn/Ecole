-- ============================================================
-- MIGRATION MULTI-TENANT v1
-- Transforme le schéma mono-école en plateforme multi-écoles
-- À exécuter UNE SEULE FOIS dans Supabase SQL Editor
-- ============================================================

-- ==============================
-- ÉTAPE 1 : TABLE SCHOOLS
-- ==============================

CREATE TABLE IF NOT EXISTS schools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  abreviation TEXT NOT NULL,          -- ex: "SLB", "JDV" (3-5 lettres majuscules)
  ville TEXT DEFAULT '',
  pays TEXT DEFAULT 'Bénin',
  logo_url TEXT,
  admin_email TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT schools_abreviation_unique UNIQUE (abreviation),
  CONSTRAINT schools_admin_email_unique UNIQUE (admin_email)
);

-- RLS pour schools
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read schools" ON schools;
CREATE POLICY "Public can read schools" ON schools FOR SELECT USING (true);


-- ==============================
-- ÉTAPE 2 : INSÉRER SAINT LAMBERT
-- (l'école existante doit être créée EN PREMIER pour que les FK soient valides)
-- ==============================

INSERT INTO schools (nom, abreviation, ville, pays, admin_email, status)
VALUES ('École Saint Lambert', 'SLB', 'Cotonou', 'Bénin', 'eudesjohn650@gmail.com', 'active')
ON CONFLICT (abreviation) DO NOTHING;

-- ==============================
-- ÉTAPE 3 : AJOUTER school_id AUX TABLES EXISTANTES
-- ==============================

-- profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;

-- classes
ALTER TABLE classes ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- students
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- matieres
ALTER TABLE matieres ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- grades
ALTER TABLE grades ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- absences
ALTER TABLE absences ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- cahier_texte
ALTER TABLE cahier_texte ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- school_config : devient multi-école (clé composite)
-- On ne peut pas modifier la PK facilement, on garde key+school_id
ALTER TABLE school_config ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- ==============================
-- ÉTAPE 4 : REMPLIR school_id AVEC SAINT LAMBERT POUR LES DONNÉES EXISTANTES
-- ==============================

DO $$
DECLARE
  slb_id UUID;
BEGIN
  SELECT id INTO slb_id FROM schools WHERE abreviation = 'SLB';

  -- Remplir profiles (les admins/profs/parents existants appartiennent à SLB)
  UPDATE profiles SET school_id = slb_id WHERE school_id IS NULL;

  -- Remplir classes
  UPDATE classes SET school_id = slb_id WHERE school_id IS NULL;

  -- Remplir students
  UPDATE students SET school_id = slb_id WHERE school_id IS NULL;

  -- Remplir matieres
  UPDATE matieres SET school_id = slb_id WHERE school_id IS NULL;

  -- Remplir grades
  UPDATE grades SET school_id = slb_id WHERE school_id IS NULL;

  -- Remplir absences
  UPDATE absences SET school_id = slb_id WHERE school_id IS NULL;

  -- Remplir cahier_texte
  UPDATE cahier_texte SET school_id = slb_id WHERE school_id IS NULL;

  -- Remplir school_config
  UPDATE school_config SET school_id = slb_id WHERE school_id IS NULL;
END $$;

-- ==============================
-- ÉTAPE 5 : RENDRE school_id NOT NULL (après remplissage)
-- ==============================

ALTER TABLE classes ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE students ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE matieres ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE grades ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE absences ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE cahier_texte ALTER COLUMN school_id SET NOT NULL;

-- ==============================
-- ÉTAPE 6 : METTRE À JOUR LA CONTRAINTE UNIQUE DES CLASSES (par école)
-- ==============================

-- Avant : UNIQUE(nom) → Après : UNIQUE(nom, school_id)
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_nom_key;
ALTER TABLE classes ADD CONSTRAINT classes_nom_school_unique UNIQUE (nom, school_id);

-- Avant : UNIQUE(nom, classe_id) → pas de changement nécessaire car classe_id implique school_id

-- ==============================
-- ÉTAPE 7 : METTRE À JOUR school_config (contrainte PK)
-- La table school_config avait key TEXT PRIMARY KEY
-- Elle devient multi-tenant : PK composite (key, school_id)
-- ==============================

-- Créer une nouvelle table school_config multi-tenant
CREATE TABLE IF NOT EXISTS school_config_mt (
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (school_id, key)
);

-- Migrer les données existantes
INSERT INTO school_config_mt (school_id, key, value)
SELECT sc.school_id, sc.key, sc.value
FROM school_config sc
WHERE sc.school_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ==============================
-- ÉTAPE 8 : FONCTION HELPER get_my_school_id()
-- ==============================

DROP FUNCTION IF EXISTS get_my_school_id CASCADE;
CREATE OR REPLACE FUNCTION get_my_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ==============================
-- ÉTAPE 9 : METTRE À JOUR LES FONCTIONS RLS HELPERS
-- ==============================

DROP FUNCTION IF EXISTS check_is_admin CASCADE;
CREATE OR REPLACE FUNCTION check_is_admin() RETURNS boolean AS $$
  BEGIN RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ); END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS check_is_teacher CASCADE;
CREATE OR REPLACE FUNCTION check_is_teacher() RETURNS boolean AS $$
  BEGIN RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'teacher'
  ); END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================
-- ÉTAPE 10 : METTRE À JOUR LES POLITIQUES RLS (isolation par école)
-- ==============================

-- PROFILES
DROP POLICY IF EXISTS "Admins manage all" ON profiles;
DROP POLICY IF EXISTS "Profiles are readable" ON profiles;

CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Admins manage school profiles" ON profiles FOR ALL
  USING (check_is_admin() AND school_id = get_my_school_id());
CREATE POLICY "Own profile readable" ON profiles FOR SELECT USING (id = auth.uid());

-- CLASSES
DROP POLICY IF EXISTS "Everyone reads classes" ON classes;
DROP POLICY IF EXISTS "Admins manage classes" ON classes;
CREATE POLICY "School members read classes" ON classes FOR SELECT
  USING (school_id = get_my_school_id());
CREATE POLICY "Admins manage classes" ON classes FOR ALL
  USING (check_is_admin() AND school_id = get_my_school_id());

-- STUDENTS
DROP POLICY IF EXISTS "Students readable by authorized" ON students;
DROP POLICY IF EXISTS "Admins manage students" ON students;
CREATE POLICY "School students readable" ON students FOR SELECT
  USING (
    school_id = get_my_school_id()
    AND (check_is_admin() OR check_is_teacher() OR parent_id = auth.uid())
  );
CREATE POLICY "Admins manage students" ON students FOR ALL
  USING (check_is_admin() AND school_id = get_my_school_id());

-- MATIERES
DROP POLICY IF EXISTS "Everyone reads subjects" ON matieres;
DROP POLICY IF EXISTS "Admins manage subjects" ON matieres;
CREATE POLICY "School members read subjects" ON matieres FOR SELECT
  USING (school_id = get_my_school_id());
CREATE POLICY "Admins manage subjects" ON matieres FOR ALL
  USING (check_is_admin() AND school_id = get_my_school_id());

-- GRADES
DROP POLICY IF EXISTS "Grades manageable" ON grades;
DROP POLICY IF EXISTS "Grades readable by parents" ON grades;
CREATE POLICY "Staff manage school grades" ON grades FOR ALL
  USING ((check_is_admin() OR check_is_teacher()) AND school_id = get_my_school_id());
CREATE POLICY "Parents read child grades" ON grades FOR SELECT
  USING (
    school_id = get_my_school_id()
    AND EXISTS (SELECT 1 FROM students WHERE id = grades.student_id AND parent_id = auth.uid())
  );

-- ABSENCES
DROP POLICY IF EXISTS "Admins/Teachers view absences" ON absences;
DROP POLICY IF EXISTS "Admins/Teachers insert absences" ON absences;
DROP POLICY IF EXISTS "Admins delete/update absences" ON absences;
DROP POLICY IF EXISTS "Parents read student absences" ON absences;
CREATE POLICY "Staff view school absences" ON absences FOR SELECT
  USING ((check_is_admin() OR check_is_teacher()) AND school_id = get_my_school_id());
CREATE POLICY "Staff insert school absences" ON absences FOR INSERT
  WITH CHECK ((check_is_admin() OR check_is_teacher()) AND school_id = get_my_school_id());
CREATE POLICY "Admins manage absences" ON absences FOR ALL
  USING (check_is_admin() AND school_id = get_my_school_id());
CREATE POLICY "Parents read child absences" ON absences FOR SELECT
  USING (
    school_id = get_my_school_id()
    AND EXISTS (SELECT 1 FROM students WHERE id = absences.student_id AND parent_id = auth.uid())
  );

-- CAHIER DE TEXTE
DROP POLICY IF EXISTS "Everyone reads lessons" ON cahier_texte;
DROP POLICY IF EXISTS "Admins/Teachers insert lessons" ON cahier_texte;
DROP POLICY IF EXISTS "Teacher/Admin update/delete lessons within 12h" ON cahier_texte;
CREATE POLICY "School members read lessons" ON cahier_texte FOR SELECT
  USING (school_id = get_my_school_id());
CREATE POLICY "Staff insert lessons" ON cahier_texte FOR INSERT
  WITH CHECK ((check_is_admin() OR check_is_teacher()) AND school_id = get_my_school_id());
CREATE POLICY "Staff manage lessons 12h" ON cahier_texte FOR ALL
  USING (
    check_is_admin()
    OR (teacher_id = auth.uid() AND created_at > now() - interval '12 hours')
  );

-- SCHOOL_CONFIG (ancienne table - garder pour compatibilité)
DROP POLICY IF EXISTS "Everyone reads config" ON school_config;
DROP POLICY IF EXISTS "Admins manage config" ON school_config;
CREATE POLICY "School members read config" ON school_config FOR SELECT
  USING (school_id = get_my_school_id() OR school_id IS NULL);
CREATE POLICY "Admins manage config" ON school_config FOR ALL
  USING (check_is_admin() AND (school_id = get_my_school_id() OR school_id IS NULL));

-- school_config_mt RLS
ALTER TABLE school_config_mt ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members read config_mt" ON school_config_mt FOR SELECT
  USING (school_id = get_my_school_id());
CREATE POLICY "Admins manage config_mt" ON school_config_mt FOR ALL
  USING (check_is_admin() AND school_id = get_my_school_id());

-- SCHOOLS (Admin manages own school)
DROP POLICY IF EXISTS "Admin manages own school" ON schools;
CREATE POLICY "Admin manages own school" ON schools FOR ALL
  USING (id = get_my_school_id());


-- ==============================
-- ÉTAPE 11 : SÉQUENCE MATRICULE PAR ÉCOLE
-- La nouvelle fonction prend l'abréviation de l'école en paramètre
-- ==============================

DROP FUNCTION IF EXISTS get_next_matricule_for_school CASCADE;
CREATE OR REPLACE FUNCTION get_next_matricule_for_school(p_school_id UUID)
RETURNS TEXT AS $$
DECLARE
    next_val INTEGER;
    year_suffix TEXT;
    school_abrev TEXT;
    seq_name TEXT;
BEGIN
    SELECT abreviation INTO school_abrev FROM schools WHERE id = p_school_id;
    seq_name := 'matricule_seq_' || LOWER(school_abrev);

    -- Créer la séquence si elle n'existe pas
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START 1', seq_name);
    EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_val;

    SELECT TO_CHAR(CURRENT_DATE, 'YY') INTO year_suffix;
    RETURN LPAD(next_val::TEXT, 4, '0') || ' ' || school_abrev || ' ' || year_suffix;
END;
$$ LANGUAGE plpgsql;

-- Garder l'ancienne fonction pour compatibilité (pointe vers SLB)
CREATE OR REPLACE FUNCTION get_next_matricule() RETURNS TEXT AS $$
DECLARE
  slb_id UUID;
BEGIN
  SELECT id INTO slb_id FROM schools WHERE abreviation = 'SLB' LIMIT 1;
  RETURN get_next_matricule_for_school(slb_id);
END;
$$ LANGUAGE plpgsql;

-- ==============================
-- ÉTAPE 12 : INDEX DE PERFORMANCE
-- ==============================

CREATE INDEX IF NOT EXISTS idx_profiles_school ON profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_matieres_school ON matieres(school_id);
CREATE INDEX IF NOT EXISTS idx_grades_school ON grades(school_id);
CREATE INDEX IF NOT EXISTS idx_absences_school ON absences(school_id);

-- ==============================
-- ÉTAPE 13 : TRIGGER INSCRIPTION AUTH
-- (Copier le school_id des métadonnées vers profiles)
-- ==============================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, prenom, nom, role, school_id)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'prenom', ''), 
    COALESCE(new.raw_user_meta_data->>'nom', ''),
    COALESCE(new.raw_user_meta_data->>'role', 'parent'),
    (new.raw_user_meta_data->>'school_id')::UUID
  )
  ON CONFLICT (id) DO UPDATE SET 
    school_id = EXCLUDED.school_id,
    role = COALESCE(profiles.role, EXCLUDED.role);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================
-- VÉRIFICATION FINALE
-- ==============================

SELECT 'Migration multi-tenant terminée !' as status;
SELECT COUNT(*) as nb_schools FROM schools;
SELECT COUNT(*) as nb_profiles_migres FROM profiles WHERE school_id IS NOT NULL;
SELECT COUNT(*) as nb_classes_migrees FROM classes WHERE school_id IS NOT NULL;
SELECT COUNT(*) as nb_students_migres FROM students WHERE school_id IS NOT NULL;

