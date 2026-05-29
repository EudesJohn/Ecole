-- ==========================================
-- SAINT LAMBERT SCHOOL ERP - FINAL UNIFIED SCHEMA (v3)
-- Fully consolidated, idempotent, and consistent with JS logic
-- ==========================================

-- 1. EXTENSIONS & BASICS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function to handle updated_at
DROP FUNCTION IF EXISTS handle_updated_at CASCADE;
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- SEQUENCES & FUNCTIONS (Must be defined before tables)
-- ==========================================
CREATE SEQUENCE IF NOT EXISTS matricule_seq START 1;
DROP FUNCTION IF EXISTS get_next_matricule CASCADE;
CREATE OR REPLACE FUNCTION get_next_matricule() RETURNS TEXT AS $$
DECLARE
    next_val INTEGER;
    year_suffix TEXT;
BEGIN
    SELECT nextval('matricule_seq') INTO next_val;
    SELECT TO_CHAR(CURRENT_DATE, 'YY') INTO year_suffix;
    RETURN LPAD(next_val::TEXT, 4, '0') || ' SLB ' || year_suffix;
END;
$$ LANGUAGE plpgsql;

-- 2. TABLES

-- PROFILES (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE,
  role TEXT CHECK (role IN ('admin', 'teacher', 'parent')) DEFAULT 'parent',
  prenom TEXT,
  nom TEXT,
  full_name TEXT GENERATED ALWAYS AS (prenom || ' ' || nom) STORED,
  email TEXT,
  matiere JSONB DEFAULT '[]',
  classe_assignee JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

-- CLASSES
CREATE TABLE IF NOT EXISTS classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL UNIQUE, -- Added UNIQUE here
  niveau TEXT,
  effectif INTEGER DEFAULT 35,
  cycle TEXT DEFAULT 'secondaire',
  promotion_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- STUDENTS
CREATE TABLE IF NOT EXISTS students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  matricule TEXT UNIQUE NOT NULL DEFAULT get_next_matricule(),
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  classe_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  date_naissance DATE,
  sexe TEXT CHECK (sexe IN ('M', 'F')),
  parent_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  pin_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MATIERES
CREATE TABLE IF NOT EXISTS matieres (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  coefficient INTEGER DEFAULT 1,
  category TEXT DEFAULT 'ECRITE',
  classe_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nom, classe_id) -- Added UNIQUE here
);

-- GRADES
CREATE TABLE IF NOT EXISTS grades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  matiere_id UUID NOT NULL REFERENCES matieres(id) ON DELETE CASCADE,
  interro1 NUMERIC(4,2),
  interro2 NUMERIC(4,2),
  interro3 NUMERIC(4,2),
  dw NUMERIC(4,2), -- Previously 'devoir'
  d1 NUMERIC(4,2),
  d2 NUMERIC(4,2),
  note_cm NUMERIC(4,2),
  note_cp NUMERIC(4,2),
  composition NUMERIC(4,2),
  note_orale NUMERIC(4,2),
  note_pratique NUMERIC(4,2),
  trimestre INTEGER NOT NULL DEFAULT 1,
  school_year TEXT NOT NULL DEFAULT '2025-2026',
  evaluation_type TEXT NOT NULL DEFAULT 'etape',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_grade_entry UNIQUE(student_id, matiere_id, trimestre, school_year, evaluation_type)
);

-- ABSENCES
CREATE TABLE IF NOT EXISTS absences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  classe_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  matiere_id UUID REFERENCES matieres(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  status TEXT CHECK (status IN ('present', 'absent')) DEFAULT 'present',
  school_year TEXT DEFAULT '2025-2026',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date, matiere_id, school_year)
);

-- CAHIER DE TEXTE
CREATE TABLE IF NOT EXISTS cahier_texte (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  classe_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  matiere_id UUID REFERENCES matieres(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  heure TEXT,
  chapitre TEXT NOT NULL,
  resume TEXT,
  school_year TEXT DEFAULT '2025-2026',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SCHOOL CONFIG
CREATE TABLE IF NOT EXISTS school_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO public.school_config (key, value) VALUES 
('current_trimestre', '1'),
('current_year', '2025-2026'),
('primaire_compo_count', '3'),
('maternelle_compo_count', '3')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 3. TRIGGERS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trig_updated_at_profiles') THEN
        CREATE TRIGGER trig_updated_at_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trig_updated_at_students') THEN
        CREATE TRIGGER trig_updated_at_students BEFORE UPDATE ON students FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trig_updated_at_grades') THEN
        CREATE TRIGGER trig_updated_at_grades BEFORE UPDATE ON grades FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
    END IF;
END $$;

-- 5. INDEXES
CREATE INDEX IF NOT EXISTS idx_students_classe ON students(classe_id);
CREATE INDEX IF NOT EXISTS idx_grades_student_trimestre ON grades(student_id, trimestre, school_year);
CREATE INDEX IF NOT EXISTS idx_matieres_classe ON matieres(classe_id);
CREATE INDEX IF NOT EXISTS idx_absences_student_date ON absences(student_id, date);

-- 6. SECURITY (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE matieres ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE cahier_texte ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_config ENABLE ROW LEVEL SECURITY;

-- Security Helpers
DROP FUNCTION IF EXISTS check_is_admin CASCADE;
CREATE OR REPLACE FUNCTION check_is_admin() RETURNS boolean AS $$
  BEGIN RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'); END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS check_is_teacher CASCADE;
CREATE OR REPLACE FUNCTION check_is_teacher() RETURNS boolean AS $$
  BEGIN RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher'); END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies
DROP POLICY IF EXISTS "Admins manage all" ON profiles;
CREATE POLICY "Admins manage all" ON profiles FOR ALL USING (check_is_admin());
DROP POLICY IF EXISTS "Profiles are readable" ON profiles;
CREATE POLICY "Profiles are readable" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Everyone reads subjects" ON matieres;
CREATE POLICY "Everyone reads subjects" ON matieres FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage subjects" ON matieres;
CREATE POLICY "Admins manage subjects" ON matieres FOR ALL USING (check_is_admin());
DROP POLICY IF EXISTS "Everyone reads classes" ON classes;
CREATE POLICY "Everyone reads classes" ON classes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage classes" ON classes;
CREATE POLICY "Admins manage classes" ON classes FOR ALL USING (check_is_admin());
DROP POLICY IF EXISTS "Students readable by authorized" ON students;
CREATE POLICY "Students readable by authorized" ON students FOR SELECT 
USING (parent_id = auth.uid() OR check_is_admin() OR check_is_teacher());
DROP POLICY IF EXISTS "Admins manage students" ON students;
CREATE POLICY "Admins manage students" ON students FOR ALL USING (check_is_admin());
DROP POLICY IF EXISTS "Everyone reads config" ON school_config;
CREATE POLICY "Everyone reads config" ON school_config FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage config" ON school_config;
CREATE POLICY "Admins manage config" ON school_config FOR ALL USING (check_is_admin());
DROP POLICY IF EXISTS "Grades manageable" ON grades;
CREATE POLICY "Grades manageable" ON grades FOR ALL USING (check_is_admin() OR check_is_teacher());
DROP POLICY IF EXISTS "Grades readable by parents" ON grades;
CREATE POLICY "Grades readable by parents" ON grades FOR SELECT USING (
  EXISTS (SELECT 1 FROM students WHERE id = grades.student_id AND parent_id = auth.uid())
);

-- ABSENCES Policies
DROP POLICY IF EXISTS "Admins/Teachers manage absences" ON absences;
CREATE POLICY "Admins/Teachers view absences" ON absences FOR SELECT USING (check_is_admin() OR check_is_teacher());
CREATE POLICY "Admins/Teachers insert absences" ON absences FOR INSERT WITH CHECK (check_is_admin() OR check_is_teacher());
CREATE POLICY "Admins delete/update absences" ON absences FOR ALL USING (check_is_admin());

DROP POLICY IF EXISTS "Parents read student absences" ON absences;
CREATE POLICY "Parents read student absences" ON absences FOR SELECT USING (
  EXISTS (SELECT 1 FROM students WHERE id = absences.student_id AND parent_id = auth.uid())
);

-- CAHIER DE TEXTE Policies
DROP POLICY IF EXISTS "Admins/Teachers manage lessons" ON cahier_texte;
DROP POLICY IF EXISTS "Everyone reads lessons" ON cahier_texte;
CREATE POLICY "Everyone reads lessons" ON cahier_texte FOR SELECT USING (true);
CREATE POLICY "Admins/Teachers insert lessons" ON cahier_texte FOR INSERT WITH CHECK (check_is_admin() OR check_is_teacher());
CREATE POLICY "Teacher/Admin update/delete lessons within 12h" ON cahier_texte FOR ALL USING (
    check_is_admin() OR (teacher_id = auth.uid() AND created_at > now() - interval '12 hours')
);

-- 7. ANALYTICS & STATS (RPC)

-- Unified subject average calculation helper (DYNAMIC DIVISOR)
DROP FUNCTION IF EXISTS calc_subject_avg(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) CASCADE;
DROP FUNCTION IF EXISTS calc_subject_avg(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) CASCADE;
CREATE OR REPLACE FUNCTION calc_subject_avg(
    p_cycle TEXT,
    p_interro1 NUMERIC, p_interro2 NUMERIC, p_interro3 NUMERIC,
    p_dw NUMERIC, p_d1 NUMERIC, p_d2 NUMERIC,
    p_note_cm NUMERIC, p_note_cp NUMERIC, p_composition NUMERIC,
    p_eval_type TEXT
) RETURNS NUMERIC AS $$
DECLARE
    v_moy_interro NUMERIC;
    v_count_interro INT := 0;
    v_part1 NUMERIC;
    v_count_final INT := 1;
BEGIN
    IF p_cycle IN ('maternelle', 'primaire') THEN
        IF p_eval_type = 'etape' THEN
            -- Sum Note CM + Note CP
            RETURN COALESCE(p_note_cm, 0) + COALESCE(p_note_cp, 0);
        ELSE
            -- Composition
            RETURN COALESCE(p_composition, 0);
        END IF;
    ELSE
        -- Secondary Formula: (( (AvgInterros + DW)/2 ) + D1 + D2) / DynamicDivisor
        
        -- 1. Average of Interros
        IF p_interro1 IS NOT NULL THEN v_count_interro := v_count_interro + 1; END IF;
        IF p_interro2 IS NOT NULL THEN v_count_interro := v_count_interro + 1; END IF;
        IF p_interro3 IS NOT NULL THEN v_count_interro := v_count_interro + 1; END IF;
        
        IF v_count_interro > 0 THEN
            v_moy_interro := (COALESCE(p_interro1,0)+COALESCE(p_interro2,0)+COALESCE(p_interro3,0)) / v_count_interro;
        ELSE
            v_moy_interro := 0;
        END IF;
        
        -- 2. First part (AvgInterro + DW) / 2
        IF p_dw IS NOT NULL THEN
            v_part1 := (v_moy_interro + p_dw) / 2;
        ELSE
            v_part1 := v_moy_interro;
        END IF;
        
        -- 3. Add D1, D2 and calculate dynamic divisor
        IF p_d1 IS NOT NULL THEN v_count_final := v_count_final + 1; END IF;
        IF p_d2 IS NOT NULL THEN v_count_final := v_count_final + 1; END IF;
        
        RETURN ROUND((v_part1 + COALESCE(p_d1,0) + COALESCE(p_d2,0)) / v_count_final, 2);
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- get_class_stats_for_bulletin (Aggregated logic)
DROP FUNCTION IF EXISTS get_class_stats_for_bulletin(UUID, INT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_class_stats_for_bulletin(UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS get_class_stats_for_bulletin(UUID, INT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION get_class_stats_for_bulletin(
    p_student_id UUID,
    p_trimestre INT,
    p_school_year TEXT,
    p_period_label TEXT DEFAULT NULL
)
RETURNS TABLE (
    effectif INT,
    plus_forte NUMERIC,
    plus_faible NUMERIC,
    moyenne_generale NUMERIC,
    rang INT
) AS $$
DECLARE
    v_classe_id UUID;
    v_cycle TEXT;
BEGIN
    SELECT s.classe_id, c.cycle INTO v_classe_id, v_cycle 
    FROM students s JOIN classes c ON s.classe_id = c.id 
    WHERE s.id = p_student_id;

    RETURN QUERY
    WITH raw_subject_averages AS (
        SELECT 
            g.student_id,
            g.matiere_id,
            calc_subject_avg(
                v_cycle, 
                g.interro1, g.interro2, g.interro3, g.dw, g.d1, g.d2,
                g.note_cm, g.note_cp, g.composition, g.evaluation_type
            ) as avg_val
        FROM grades g
        JOIN students s ON g.student_id = s.id
        WHERE s.classe_id = v_classe_id 
          AND g.school_year = p_school_year
          AND g.evaluation_type = 'composition'
          AND (
              (p_period_label IS NOT NULL AND g.period_label = p_period_label)
              OR 
              (p_period_label IS NULL AND g.trimestre = p_trimestre)
          )
    ),
    aggregated_subject_averages AS (
        -- Grouping handles (Etape + Composition) / 2 for Primary
        SELECT 
            rsa.student_id,
            rsa.matiere_id,
            AVG(rsa.avg_val) as final_subject_avg
        FROM raw_subject_averages rsa
        GROUP BY rsa.student_id, rsa.matiere_id
    ),
    student_total_averages AS (
        SELECT 
            asa.student_id,
            SUM(asa.final_subject_avg * m.coefficient) / NULLIF(SUM(m.coefficient), 0) as total_avg
        FROM aggregated_subject_averages asa
        JOIN matieres m ON asa.matiere_id = m.id
        GROUP BY asa.student_id
    ),
    class_meta AS (
        SELECT 
            COUNT(*)::INT as total_students,
            MAX(total_avg)::NUMERIC as max_avg,
            MIN(total_avg)::NUMERIC as min_avg
        FROM student_total_averages
    ),
    ranked AS (
        SELECT 
            student_id,
            total_avg,
            RANK() OVER (ORDER BY total_avg DESC) as position
        FROM student_total_averages
    )
    SELECT 
        cm.total_students,
        ROUND(cm.max_avg, 2),
        ROUND(cm.min_avg, 2),
        ROUND(r.total_avg::NUMERIC, 2),
        r.position::INT
    FROM class_meta cm, ranked r
    WHERE r.student_id = p_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_detailed_stats (Unified)
DROP FUNCTION IF EXISTS get_detailed_stats(UUID, INT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_detailed_stats(UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS get_detailed_stats(UUID, INT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION get_detailed_stats(
    p_student_id UUID,
    p_trimestre INT,
    p_school_year TEXT,
    p_period_label TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_classe_id UUID;
    v_cycle TEXT;
    v_result JSONB;
    v_general RECORD;
BEGIN
    SELECT s.classe_id, c.cycle INTO v_classe_id, v_cycle 
    FROM students s JOIN classes c ON s.classe_id = c.id 
    WHERE s.id = p_student_id;

    SELECT * INTO v_general FROM get_class_stats_for_bulletin(p_student_id, p_trimestre, p_school_year, p_period_label);

    WITH raw_subject_averages AS (
        SELECT 
            g.student_id,
            g.matiere_id,
            calc_subject_avg(
                v_cycle, 
                g.interro1, g.interro2, g.interro3, g.dw, g.d1, g.d2,
                g.note_cm, g.note_cp, g.composition, g.evaluation_type
            ) as avg_val
        FROM grades g
        JOIN students s ON g.student_id = s.id
        WHERE s.classe_id = v_classe_id 
          AND g.school_year = p_school_year
          AND g.evaluation_type = 'composition'
          AND (
              (p_period_label IS NOT NULL AND g.period_label = p_period_label)
              OR 
              (p_period_label IS NULL AND g.trimestre = p_trimestre)
          )
    ),
    aggregated_subject_averages AS (
        SELECT student_id, matiere_id, AVG(avg_val) as final_avg
        FROM raw_subject_averages
        GROUP BY student_id, matiere_id
    ),
    subj_stats AS (
        SELECT matiere_id, MAX(final_avg) as mat_max, MIN(final_avg) as mat_min
        FROM aggregated_subject_averages
        GROUP BY matiere_id
    )
    SELECT jsonb_build_object(
        'general_stats', jsonb_build_object(
            'effectif', COALESCE(v_general.effectif, 0),
            'max_moyenne', COALESCE(v_general.plus_forte, 0),
            'min_moyenne', COALESCE(v_general.plus_faible, 0),
            'moyenne_generale', COALESCE(v_general.moyenne_generale, 0),
            'rang', COALESCE(v_general.rang, 0)
        ),
        'subject_stats', COALESCE((SELECT jsonb_agg(jsonb_build_object('matiere_id', matiere_id, 'max', ROUND(mat_max, 2), 'min', ROUND(mat_min, 2))) FROM subj_stats), '[]'::jsonb)
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- verify_bulletin (Public search)
DROP FUNCTION IF EXISTS verify_bulletin(TEXT, INTEGER, TEXT) CASCADE;
DROP FUNCTION IF EXISTS verify_bulletin(TEXT, INTEGER) CASCADE;
CREATE OR REPLACE FUNCTION verify_bulletin(
    p_matricule TEXT, 
    p_trimestre INTEGER,
    p_school_year TEXT
)
RETURNS JSON AS $$
DECLARE
    v_student RECORD;
    v_stats JSONB;
    v_moyenne NUMERIC;
    v_appreciation TEXT;
BEGIN
    SELECT s.id, s.nom, s.prenom, c.nom as classe_nom 
    FROM students s JOIN classes c ON s.classe_id = c.id
    WHERE s.matricule = p_matricule INTO v_student;
    
    IF v_student IS NULL THEN RETURN NULL; END IF;

    v_stats := get_detailed_stats(v_student.id, p_trimestre, p_school_year);
    v_moyenne := (v_stats->'general_stats'->>'moyenne_generale')::NUMERIC;

    CASE 
        WHEN v_moyenne >= 18 THEN v_appreciation := 'Excellent';
        WHEN v_moyenne >= 16 THEN v_appreciation := 'Très Bien';
        WHEN v_moyenne >= 14 THEN v_appreciation := 'Bien';
        WHEN v_moyenne >= 12 THEN v_appreciation := 'Assez Bien';
        WHEN v_moyenne >= 10 THEN v_appreciation := 'Passable';
        ELSE v_appreciation := 'Insuffisant';
    END CASE;

    RETURN json_build_object(
        'studentNom', v_student.nom,
        'studentPrenom', v_student.prenom,
        'classe', v_student.classe_nom,
        'matricule', p_matricule,
        'trimestre', p_trimestre,
        'schoolYear', p_school_year,
        'moyenne', v_moyenne,
        'rang', (v_stats->'general_stats'->>'rang') || '/' || (v_stats->'general_stats'->>'effectif'),
        'appreciation', v_appreciation
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_annual_stats (Promotion logic)
DROP FUNCTION IF EXISTS get_annual_stats(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_annual_stats(UUID) CASCADE;
CREATE OR REPLACE FUNCTION get_annual_stats(
    p_student_id UUID, 
    p_school_year TEXT
)
RETURNS TABLE (
    moy_t1 NUMERIC,
    moy_t2 NUMERIC,
    moy_t3 NUMERIC,
    moy_annuelle NUMERIC,
    decision TEXT
) AS $$
DECLARE
    v_t1 NUMERIC; v_t2 NUMERIC; v_t3 NUMERIC;
    v_annuelle NUMERIC; v_decision TEXT;
BEGIN
    SELECT moyenne_generale INTO v_t1 FROM get_class_stats_for_bulletin(p_student_id, 1, p_school_year);
    SELECT moyenne_generale INTO v_t2 FROM get_class_stats_for_bulletin(p_student_id, 2, p_school_year);
    SELECT moyenne_generale INTO v_t3 FROM get_class_stats_for_bulletin(p_student_id, 3, p_school_year);

    v_annuelle := (COALESCE(v_t1, 0) + COALESCE(v_t2, 0) + COALESCE(v_t3, 0)) / 
                 NULLIF((CASE WHEN v_t1 IS NOT NULL AND v_t1 > 0 THEN 1 ELSE 0 END + 
                         CASE WHEN v_t2 IS NOT NULL AND v_t2 > 0 THEN 1 ELSE 0 END + 
                         CASE WHEN v_t3 IS NOT NULL AND v_t3 > 0 THEN 1 ELSE 0 END), 0);

    IF v_annuelle >= 10 THEN v_decision := 'Admis'; ELSE v_decision := 'Redouble'; END IF;

    RETURN QUERY SELECT 
        ROUND(COALESCE(v_t1, 0), 2), 
        ROUND(COALESCE(v_t2, 0), 2), 
        ROUND(COALESCE(v_t3, 0), 2), 
        ROUND(COALESCE(v_annuelle, 0), 2), 
        v_decision;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. AUTH TRIGGER
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, prenom, nom, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'prenom', ''), 
    COALESCE(new.raw_user_meta_data->>'nom', ''),
    COALESCE(new.raw_user_meta_data->>'role', 'parent')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
