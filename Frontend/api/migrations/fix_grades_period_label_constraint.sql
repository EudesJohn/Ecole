-- ============================================================
-- MIGRATION : Ajouter period_label à grades + mise à jour contrainte unique
-- À exécuter dans Supabase SQL Editor (une seule fois)
-- ============================================================

-- 1. Ajouter la colonne period_label si elle n'existe pas
ALTER TABLE grades ADD COLUMN IF NOT EXISTS period_label TEXT;

-- 2. Remplir les lignes existantes avec un fallback
UPDATE grades 
SET period_label = 'Trimestre ' || trimestre 
WHERE period_label IS NULL;

-- 3. Supprimer l'ancienne contrainte unique (sans period_label)
ALTER TABLE grades DROP CONSTRAINT IF EXISTS unique_grade_entry;
ALTER TABLE grades DROP CONSTRAINT IF EXISTS grades_student_id_matiere_id_trimestre_school_year_evaluati_key;

-- 4. Créer la nouvelle contrainte unique incluant period_label
ALTER TABLE grades 
ADD CONSTRAINT unique_grade_entry 
UNIQUE(student_id, matiere_id, trimestre, school_year, evaluation_type, period_label);

-- 5. Vérification
SELECT 'Contrainte unique grades mise à jour avec period_label !' as status;
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'grades'::regclass 
AND contype = 'u';
