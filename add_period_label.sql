-- ==========================================
-- ADD PERIOD_LABEL AND UPDATE UNIQUE KEY
-- ==========================================

-- 1. Add the column
ALTER TABLE grades ADD COLUMN IF NOT EXISTS period_label TEXT;

-- 2. Populate fallback for existing rows
UPDATE grades 
SET period_label = 'Trimestre ' || trimestre 
WHERE period_label IS NULL;

-- 3. Update the unique constraint
-- We need to drop the old one first
ALTER TABLE grades DROP CONSTRAINT IF EXISTS unique_grade_entry;

-- Create the new, more flexible constraint
ALTER TABLE grades ADD CONSTRAINT unique_grade_entry 
UNIQUE(student_id, matiere_id, trimestre, school_year, evaluation_type, period_label);

-- Comment for docs
COMMENT ON COLUMN grades.period_label IS 'Custom label for evaluations (e.g., Janvier, Février) mainly for primary cycle.';
