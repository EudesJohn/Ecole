-- SCRIPT DE RÉPARATION ET DIAGNOSTIC DES CONTRAINTES
-- À exécuter dans l'éditeur SQL de Supabase

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- 1. NETTOYAGE DES DOUBLONS CRITIQUES
    DELETE FROM classes a USING classes b WHERE a.id < b.id AND a.nom = b.nom;
    DELETE FROM matieres a USING matieres b WHERE a.id < b.id AND a.nom = b.nom AND a.classe_id = b.classe_id;
    DELETE FROM grades a USING grades b WHERE a.id < b.id AND a.student_id = b.student_id AND a.matiere_id = b.matiere_id AND a.trimestre = b.trimestre AND a.school_year = b.school_year AND a.evaluation_type = b.evaluation_type;
    DELETE FROM school_config a USING school_config b WHERE a.key = b.key AND a.ctid < b.ctid;

    -- 2. SUPPRESSION FORCÉE DES ANCIENNES CONTRAINTES POUR RÉ-INITIALISATION
    -- Classes
    EXECUTE 'ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_nom_key';
    EXECUTE 'ALTER TABLE classes DROP CONSTRAINT IF EXISTS unique_class_nom';
    EXECUTE 'ALTER TABLE classes ADD CONSTRAINT unique_class_nom UNIQUE(nom)';

    -- Matieres
    EXECUTE 'ALTER TABLE matieres DROP CONSTRAINT IF EXISTS matieres_nom_classe_id_key';
    EXECUTE 'ALTER TABLE matieres DROP CONSTRAINT IF EXISTS unique_matiere_per_classe';
    EXECUTE 'ALTER TABLE matieres ADD CONSTRAINT unique_matiere_per_classe UNIQUE(nom, classe_id)';

    -- Grades
    EXECUTE 'ALTER TABLE grades DROP CONSTRAINT IF EXISTS unique_grade_entry';
    EXECUTE 'ALTER TABLE grades ADD CONSTRAINT unique_grade_entry UNIQUE(student_id, matiere_id, trimestre, school_year, evaluation_type)';

    -- School Config
    EXECUTE 'ALTER TABLE school_config DROP CONSTRAINT IF EXISTS school_config_key_key';
    IF NOT EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid WHERE c.relname = 'school_config' AND i.indisprimary) THEN
        EXECUTE 'ALTER TABLE school_config ADD PRIMARY KEY (key)';
    END IF;

    -- Profiles (Vérification PK)
    IF NOT EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid WHERE c.relname = 'profiles' AND i.indisprimary) THEN
        EXECUTE 'ALTER TABLE profiles ADD PRIMARY KEY (id)';
    END IF;

END $$;

-- 3. TEST D'INSERTION POUR VÉRIFIER
INSERT INTO school_config (key, value) VALUES ('current_year', '2025-2026') 
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

SELECT 'RÉPARATION TERMINÉE AVEC SUCCÈS' as status;
