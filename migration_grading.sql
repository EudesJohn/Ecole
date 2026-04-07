-- 1. Update Classes Table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS cycle TEXT CHECK (cycle IN ('maternelle', 'primaire', 'college', 'lycee')) DEFAULT 'college';
ALTER TABLE classes ADD COLUMN IF NOT EXISTS promotion_order INTEGER;

-- Populate existing classes with cycles
UPDATE classes SET cycle = 'college' WHERE nom LIKE '6ème%';
UPDATE classes SET cycle = 'college' WHERE nom LIKE '5ème%';
UPDATE classes SET cycle = 'college' WHERE nom LIKE '4ème%';
UPDATE classes SET cycle = 'college' WHERE nom LIKE '3ème%';
UPDATE classes SET cycle = 'lycee' WHERE nom LIKE '2nd%';
UPDATE classes SET cycle = 'lycee' WHERE nom LIKE '1ère%';
UPDATE classes SET cycle = 'lycee' WHERE nom LIKE 'Terminale%';

-- 2. Update Grades Table
ALTER TABLE grades ADD COLUMN IF NOT EXISTS interro3 NUMERIC(4,2);
ALTER TABLE grades ADD COLUMN IF NOT EXISTS comp1 NUMERIC(4,2);
ALTER TABLE grades ADD COLUMN IF NOT EXISTS comp2 NUMERIC(4,2);
ALTER TABLE grades ADD COLUMN IF NOT EXISTS comp3 NUMERIC(4,2);
ALTER TABLE grades ADD COLUMN IF NOT EXISTS comp4 NUMERIC(4,2);
ALTER TABLE grades ADD COLUMN IF NOT EXISTS comp5 NUMERIC(4,2);
ALTER TABLE grades ADD COLUMN IF NOT EXISTS comp6 NUMERIC(4,2);
ALTER TABLE grades ADD COLUMN IF NOT EXISTS examen_blanc NUMERIC(4,2);

-- 3. Function to get Annual Stats (Supports both cycles)
CREATE OR REPLACE FUNCTION get_annual_stats(p_student_id UUID, p_school_year TEXT)
RETURNS TABLE (
    moy_t1 NUMERIC,
    moy_t2 NUMERIC,
    moy_t3 NUMERIC,
    moy_annuelle NUMERIC,
    decision TEXT
) AS $$
DECLARE
    v_t1 NUMERIC; v_t2 NUMERIC; v_t3 NUMERIC;
    v_annuelle NUMERIC; v_decision TEXT; v_cycle TEXT;
BEGIN
    SELECT classes.cycle INTO v_cycle 
    FROM students JOIN classes ON students.classe_id = classes.id 
    WHERE students.id = p_student_id;

    IF v_cycle = 'primaire' OR v_cycle = 'maternelle' THEN
        SELECT AVG(val) INTO v_annuelle
        FROM (
            SELECT unnest(ARRAY[comp1, comp2, comp3, comp4, comp5, comp6]) as val
            FROM grades
            WHERE student_id = p_student_id AND school_year = p_school_year
        ) sub
        WHERE val IS NOT NULL;
        v_t1 := NULL; v_t2 := NULL; v_t3 := NULL;
    ELSE
        -- Secondary logic: New formula (AvgInterro + Devoir + Compo) / 3
        SELECT AVG(m) INTO v_t1 FROM (
            SELECT ( ( (COALESCE(interro1,0)+COALESCE(interro2,0)+COALESCE(interro3,0)) / 
                NULLIF((CASE WHEN interro1 IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN interro2 IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN interro3 IS NOT NULL THEN 1 ELSE 0 END), 0) ) 
                + COALESCE(devoir, 0) + COALESCE(composition, 0) ) / 3.0 as m 
            FROM grades WHERE student_id = p_student_id AND trimestre = 1 AND school_year = p_school_year
        ) s;

        SELECT AVG(m) INTO v_t2 FROM (
            SELECT ( ( (COALESCE(interro1,0)+COALESCE(interro2,0)+COALESCE(interro3,0)) / 
                NULLIF((CASE WHEN interro1 IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN interro2 IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN interro3 IS NOT NULL THEN 1 ELSE 0 END), 0) ) 
                + COALESCE(devoir, 0) + COALESCE(composition, 0) ) / 3.0 as m 
            FROM grades WHERE student_id = p_student_id AND trimestre = 2 AND school_year = p_school_year
        ) s;

        SELECT AVG(m) INTO v_t3 FROM (
            SELECT ( ( (COALESCE(interro1,0)+COALESCE(interro2,0)+COALESCE(interro3,0)) / 
                NULLIF((CASE WHEN interro1 IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN interro2 IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN interro3 IS NOT NULL THEN 1 ELSE 0 END), 0) ) 
                + COALESCE(devoir, 0) + COALESCE(composition, 0) ) / 3.0 as m 
            FROM grades WHERE student_id = p_student_id AND trimestre = 3 AND school_year = p_school_year
        ) s;
        
        v_annuelle := (COALESCE(v_t1, 0) + COALESCE(v_t2, 0) + (COALESCE(v_t3, 0) * 2)) / 4.0;
    END IF;

    IF v_annuelle >= 10 THEN v_decision := 'Promu'; ELSE v_decision := 'Redouble'; END IF;
    RETURN QUERY SELECT v_t1, v_t2, v_t3, ROUND(v_annuelle, 2), v_decision;
END;
$$ LANGUAGE plpgsql;

-- 4. Simple mapping table for levels (Optional, we can use order)
-- Maternel1 (1), Maternel2 (2), CI (3), CP (4), CE1 (5), CE2 (6), CM1 (7), CM2 (8), 6ème (9) ...
-- This can be set manually in classes table.
