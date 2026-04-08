-- ==========================================
-- SAINT LAMBERT ERP - GRADES MERGE & CLEANUP
-- ==========================================

BEGIN;

-- 1. For entries where BOTH 'etape' and 'composition' exist for the same student/matiere/trimestre/year
-- We delete the 'etape' ones to avoid duplicates before updating.
DELETE FROM grades g1
USING grades g2
WHERE g1.evaluation_type = 'etape'
  AND g2.evaluation_type = 'composition'
  AND g1.student_id = g2.student_id
  AND g1.matiere_id = g2.matiere_id
  AND g1.trimestre = g2.trimestre
  AND g1.school_year = g2.school_year;

-- 2. For remaining 'etape' rows, update them to 'composition'
UPDATE grades
SET evaluation_type = 'composition'
WHERE evaluation_type = 'etape';

COMMIT;

-- 3. Verify consistency
SELECT student_id, matiere_id, trimestre, school_year, COUNT(*)
FROM grades
WHERE evaluation_type = 'composition'
GROUP BY student_id, matiere_id, trimestre, school_year
HAVING COUNT(*) > 1;
