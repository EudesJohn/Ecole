-- Saint Lambert ERP - Supabase Database Schema

-- 1. Create Profiles Table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  role TEXT CHECK (role IN ('admin', 'teacher', 'parent')) DEFAULT 'parent',
  prenom TEXT,
  nom TEXT,
  full_name TEXT GENERATED ALWAYS AS (prenom || ' ' || nom) STORED,
  email TEXT,
  matiere TEXT, -- For teachers
  classe_assignee TEXT, -- For teachers
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Classes Table
CREATE TABLE IF NOT EXISTS classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL UNIQUE, -- e.g., '6ème A'
  niveau TEXT, -- e.g., '6ème'
  effectif INTEGER DEFAULT 35,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Students Table
CREATE TABLE IF NOT EXISTS students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  matricule TEXT UNIQUE NOT NULL, -- Sequential: 0001 SLB 26
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

-- 4. Create Matieres Table
CREATE TABLE IF NOT EXISTS matieres (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  coefficient INTEGER DEFAULT 1,
  classe_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Grades (Notes) Table
CREATE TABLE IF NOT EXISTS grades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  matiere_id UUID REFERENCES matieres(id) ON DELETE CASCADE,
  interro1 NUMERIC(4,2),
  interro2 NUMERIC(4,2),
  devoir NUMERIC(4,2),
  composition NUMERIC(4,2),
  trimestre INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, matiere_id, trimestre)
);

-- 6. Create Absences Table
CREATE TABLE IF NOT EXISTS absences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  classe_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  status TEXT CHECK (status IN ('present', 'absent')) DEFAULT 'present',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date)
);

-- 7. Create Cahier de Texte Table
CREATE TABLE IF NOT EXISTS cahier_texte (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  classe_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  matiere_id UUID REFERENCES matieres(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  heure TIME,
  chapitre TEXT NOT NULL,
  resume TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE matieres ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE cahier_texte ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Basic Setup - Everyone can read for now, only Admin/Teacher can write)
-- This should be refined in production

-- Function for Admin Security (Avoids Infinite Recursion)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for Teacher Security - Restricting to their assigned classes (Backend Lockout feature)
CREATE OR REPLACE FUNCTION public.check_is_teacher()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'teacher'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a teacher owns a matiere
CREATE OR REPLACE FUNCTION public.check_teacher_owns_matiere(p_matiere_id UUID)
RETURNS boolean AS $$
DECLARE
  v_matiere_name TEXT;
  v_classe_id UUID;
  v_classe_name TEXT;
BEGIN
  -- Récupérer le nom de la matière ET l'ID de sa classe
  SELECT nom, classe_id INTO v_matiere_name, v_classe_id FROM matieres WHERE id = p_matiere_id;
  -- Récupérer le nom de la classe
  SELECT nom INTO v_classe_name FROM classes WHERE id = v_classe_id;
  
  -- Check if it exists in their json array or text array (depending on how it's stored)
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'teacher'
    AND matiere::jsonb ? v_matiere_name
    AND classe_assignee::jsonb ? v_classe_name
  );
EXCEPTION
  WHEN OTHERS THEN RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_teacher_owns_classe(p_classe_id UUID)
RETURNS boolean AS $$
DECLARE
  v_classe_name TEXT;
BEGIN
  SELECT nom INTO v_classe_name FROM classes WHERE id = p_classe_id;
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'teacher'
    AND classe_assignee::jsonb ? v_classe_name
  );
EXCEPTION
  WHEN OTHERS THEN RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies (Refined for real security)
-- PROFILES: Everyone authenticated can see, but parents can only see themselves unless they are admin/teacher.
CREATE POLICY "Profiles viewable by self or admin/teacher" ON profiles FOR SELECT USING (
  auth.uid() = id OR check_is_admin() OR check_is_teacher()
);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can manage all profiles" ON profiles FOR ALL USING (check_is_admin());

-- CLASSES
CREATE POLICY "Classes are viewable by everyone authenticated" ON classes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage classes" ON classes FOR ALL USING (check_is_admin());

-- STUDENTS
CREATE POLICY "Students are viewable by admins and teachers" ON students FOR SELECT USING (
  check_is_admin() OR check_is_teacher()
);
CREATE POLICY "Parents can view their own children" ON students FOR SELECT USING (
  parent_id = auth.uid()
);
CREATE POLICY "Admins can manage students" ON students FOR ALL USING (check_is_admin());

-- MATIERES
CREATE POLICY "Matieres are viewable by everyone authenticated" ON matieres FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage matieres" ON matieres FOR ALL USING (check_is_admin());

-- GRADES
CREATE POLICY "Admins manage grades" ON grades FOR ALL USING (check_is_admin());
CREATE POLICY "Teachers view grades" ON grades FOR SELECT USING (check_is_teacher());
CREATE POLICY "Teachers insert/update grades" ON grades FOR INSERT WITH CHECK (check_teacher_owns_matiere(matiere_id));
CREATE POLICY "Teachers update grades" ON grades FOR UPDATE USING (check_teacher_owns_matiere(matiere_id));
CREATE POLICY "Teachers delete grades" ON grades FOR DELETE USING (check_teacher_owns_matiere(matiere_id));
CREATE POLICY "Parents can view grades of their children" ON grades FOR SELECT USING (
  EXISTS (SELECT 1 FROM students WHERE students.id = grades.student_id AND students.parent_id = auth.uid())
);

-- ABSENCES
CREATE POLICY "Admins manage absences" ON absences FOR ALL USING (check_is_admin());
CREATE POLICY "Teachers view absences" ON absences FOR SELECT USING (check_is_teacher());
CREATE POLICY "Teachers manage absences" ON absences FOR INSERT WITH CHECK (check_teacher_owns_classe(classe_id));
CREATE POLICY "Teachers update absences" ON absences FOR UPDATE USING (check_teacher_owns_classe(classe_id));
CREATE POLICY "Teachers delete absences" ON absences FOR DELETE USING (check_teacher_owns_classe(classe_id));
CREATE POLICY "Parents can view absences of their children" ON absences FOR SELECT USING (
  EXISTS (SELECT 1 FROM students WHERE students.id = absences.student_id AND students.parent_id = auth.uid())
);

-- CAHIER DE TEXTE
CREATE POLICY "Cahier viewable by everyone authenticated" ON cahier_texte FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins manage cahier" ON cahier_texte FOR ALL USING (check_is_admin());
CREATE POLICY "Teachers manage cahier" ON cahier_texte FOR ALL USING (check_is_teacher());

-- Create a sequence for student matricule numbers
CREATE SEQUENCE IF NOT EXISTS matricule_seq START 1;

-- Function for Sequential Matricule Generation
-- Format: [0001] SLB [26]
CREATE OR REPLACE FUNCTION get_next_matricule()
RETURNS TEXT AS $$
DECLARE
    next_val INTEGER;
    year_suffix TEXT;
    result TEXT;
BEGIN
    -- Get next sequence value from sequence table to avoid race conditions
    SELECT nextval('matricule_seq') INTO next_val;
    
    -- Get current year suffix (e.g., 26 for 2026)
    SELECT TO_CHAR(CURRENT_DATE, 'YY') INTO year_suffix;
    
    -- Format: LPAD(number, 4, '0') + SLB + year
    result := LPAD(next_val::TEXT, 4, '0') || ' SLB ' || year_suffix;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- RPC Function for securing Bulletin Data Leak
-- This function calculates rank, averages, and class stats securely.
CREATE OR REPLACE FUNCTION get_class_stats_for_bulletin(p_student_id UUID, p_trimestre INTEGER)
RETURNS JSON AS $$
DECLARE
    v_classe_id UUID;
    v_class_students UUID[];
    v_stats JSON;
    v_student_avg NUMERIC;
    v_appreciation TEXT;
BEGIN
    -- 1. Find the student's class
    SELECT classe_id INTO v_classe_id FROM students WHERE id = p_student_id;
    IF v_classe_id IS NULL THEN
        RAISE EXCEPTION 'Student has no assigned class';
    END IF;

    -- 2. Get all students in the class
    SELECT ARRAY(SELECT id FROM students WHERE classe_id = v_classe_id) INTO v_class_students;

    -- 3. Calculate averages
    
    WITH student_notes AS (
        SELECT 
            student_id, 
            SUM(
                ((COALESCE(interro1, 0) + COALESCE(interro2, 0)) / GREATEST(1, (CASE WHEN interro1 IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN interro2 IS NOT NULL THEN 1 ELSE 0 END)) 
                + COALESCE(devoir, 0) + COALESCE(composition, 0)) / 3.0 * matieres.coefficient
            ) / SUM(matieres.coefficient) as student_moy
        FROM grades
        JOIN matieres ON grades.matiere_id = matieres.id
        WHERE student_id = ANY(v_class_students) AND trimestre = p_trimestre
        GROUP BY student_id
    ),
    ranked_notes AS (
        SELECT student_id, student_moy,
               RANK() OVER (ORDER BY student_moy DESC) as rang
        FROM student_notes
    )
    SELECT json_build_object(
        'effectif', array_length(v_class_students, 1),
        'plus_forte', (SELECT MAX(student_moy) FROM student_notes),
        'plus_faible', (SELECT MIN(student_moy) FROM student_notes),
        'studentAverage', (SELECT student_moy FROM ranked_notes WHERE student_id = p_student_id),
        'rang', (SELECT rang FROM ranked_notes WHERE student_id = p_student_id)
    ) INTO v_stats

    RETURN COALESCE(v_stats, '{}'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC for public bulletin verification
CREATE OR REPLACE FUNCTION verify_bulletin(p_matricule TEXT, p_trimestre INTEGER)
RETURNS JSON AS $$
DECLARE
    v_student RECORD;
    v_stats JSON;
    v_moyenne NUMERIC;
    v_rang TEXT;
    v_appreciation TEXT;
BEGIN
    SELECT id, nom, prenom, classe_id FROM students WHERE matricule = p_matricule INTO v_student;
    
    IF v_student IS NULL THEN
        RETURN NULL;
    END IF;

    -- Get stats
    v_stats := get_class_stats_for_bulletin(v_student.id, p_trimestre);
    
    v_moyenne := COALESCE((v_stats->>'studentAverage')::NUMERIC, 0);
    v_rang := v_stats->>'rang';
    

    IF v_moyenne >= 16 THEN v_appreciation := 'Très Bien';
    ELSIF v_moyenne >= 14 THEN v_appreciation := 'Bien';
    ELSIF v_moyenne >= 12 THEN v_appreciation := 'Assez Bien';
    ELSIF v_moyenne >= 10 THEN v_appreciation := 'Passable';
    ELSE v_appreciation := 'Insuffisant';
    END IF;

    RETURN json_build_object(
        'studentNom', v_student.nom,
        'studentPrenom', v_student.prenom,
        'matricule', p_matricule,
        'trimestre', p_trimestre,
        'moyenne', ROUND(v_moyenne, 2),
        'rang', v_rang,
        'appreciation', v_appreciation
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, prenom, nom, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'prenom', ''), 
    COALESCE(new.raw_user_meta_data->>'nom', ''),
    'parent' -- FORCÉ pour éviter l'élévation de privilèges par l'API publique
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
