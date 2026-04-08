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
ALTER TABLE grades DROP CONSTRAINT IF EXISTS unique_grade_entry;
ALTER TABLE grades ADD CONSTRAINT unique_grade_entry 
UNIQUE(student_id, matiere_id, trimestre, school_year, evaluation_type, period_label);

-- ==========================================
-- UPDATE STATS FUNCTIONS FOR PERIOD_LABEL
-- ==========================================

-- Update get_class_stats_for_bulletin
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

-- Update get_detailed_stats (add p_period_label)
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

    v_result := jsonb_build_object(
        'general_stats', jsonb_build_object(
            'effectif', v_general.effectif,
            'max_moyenne', v_general.plus_forte,
            'min_moyenne', v_general.plus_faible,
            'moyenne_generale', v_general.moyenne_generale,
            'rang', v_general.rang
        )
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
