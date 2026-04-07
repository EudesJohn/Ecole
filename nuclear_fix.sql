-- ==========================================
-- SCRIPT DE RÉPARATION NUCLÉAIRE INTELLIGENT (v5)
-- Force le nettoyage des contraintes et index, même dépendants
-- ==========================================

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- 1. NETTOYAGE ABSOLU DES DOUBLONS (garde le plus ancien pour préserver les relations)
    DELETE FROM public.classes a USING public.classes b WHERE a.nom = b.nom AND a.ctid > b.ctid;
    DELETE FROM public.matieres a USING public.matieres b WHERE a.nom = b.nom AND a.classe_id = b.classe_id AND a.ctid > b.ctid;
    DELETE FROM public.grades a USING public.grades b WHERE a.student_id = b.student_id AND a.matiere_id = b.matiere_id AND a.trimestre = b.trimestre AND a.school_year = b.school_year AND a.evaluation_type = b.evaluation_type AND a.ctid > b.ctid;
    DELETE FROM public.school_config a USING public.school_config b WHERE a.key = b.key AND a.ctid > b.ctid;

    -- 2. NETTOYAGE DYNAMIQUE ET SÉCURISÉ DES CONTRAINTES
    
    -- Classes
    FOR r IN (SELECT conname FROM pg_constraint WHERE conrelid = 'public.classes'::regclass AND contype = 'u') LOOP
        EXECUTE 'ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname) || ' CASCADE';
    END LOOP;

    -- Matieres
    FOR r IN (SELECT conname FROM pg_constraint WHERE conrelid = 'public.matieres'::regclass AND contype = 'u') LOOP
        EXECUTE 'ALTER TABLE public.matieres DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname) || ' CASCADE';
    END LOOP;

    -- Grades
    FOR r IN (SELECT conname FROM pg_constraint WHERE conrelid = 'public.grades'::regclass AND contype = 'u') LOOP
        EXECUTE 'ALTER TABLE public.grades DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname) || ' CASCADE';
    END LOOP;

    -- School Config (Supprime Primary Key et Unique)
    FOR r IN (SELECT conname FROM pg_constraint WHERE conrelid = 'public.school_config'::regclass AND contype IN ('u', 'p')) LOOP
        EXECUTE 'ALTER TABLE public.school_config DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname) || ' CASCADE';
    END LOOP;

    -- 3. RE-CRÉATION PROPRE
    ALTER TABLE public.classes ADD CONSTRAINT unique_class_nom UNIQUE(nom);
    ALTER TABLE public.matieres ADD CONSTRAINT unique_matiere_per_classe UNIQUE(nom, classe_id);
    ALTER TABLE public.grades ADD CONSTRAINT unique_grade_entry UNIQUE(student_id, matiere_id, trimestre, school_year, evaluation_type);
    
    -- Recréation PK ou Unique pour school_config
    BEGIN
        ALTER TABLE public.school_config ADD PRIMARY KEY (key);
    EXCEPTION WHEN OTHERS THEN
        ALTER TABLE public.school_config ADD CONSTRAINT unique_school_config_key UNIQUE(key);
    END;

END $$;

-- 5. TEST FINAL
INSERT INTO public.school_config (key, value) VALUES ('current_year', '2025-2026') 
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

SELECT 'RÉPARATION NUCLÉAIRE v5 RÉUSSIE' as status;
