-- ==========================================================
-- RESOLVE FUNCTION OVERLOADING FOR get_detailed_stats AND get_class_stats_for_bulletin
-- ==========================================================

-- 1. Drop ALL older overloaded versions with CASCADE to clean up the schema.
-- This will also temporarily drop dependent functions: verify_bulletin, get_annual_stats.
DROP FUNCTION IF EXISTS public.get_class_stats_for_bulletin(UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_class_stats_for_bulletin(UUID, INT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_class_stats_for_bulletin(UUID, INT, TEXT, TEXT) CASCADE;

DROP FUNCTION IF EXISTS public.get_detailed_stats(UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_detailed_stats(UUID, INT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_detailed_stats(UUID, INT, TEXT, TEXT) CASCADE;

DROP FUNCTION IF EXISTS public.verify_bulletin(TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.verify_bulletin(TEXT, INTEGER, TEXT) CASCADE;

DROP FUNCTION IF EXISTS public.get_annual_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_annual_stats(UUID, TEXT) CASCADE;


-- 2. Re-create get_class_stats_for_bulletin with a single unified signature
CREATE OR REPLACE FUNCTION public.get_class_stats_for_bulletin(
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


-- 3. Re-create get_detailed_stats with a single unified signature and return subject_stats
CREATE OR REPLACE FUNCTION public.get_detailed_stats(
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

    SELECT * INTO v_general FROM public.get_class_stats_for_bulletin(p_student_id, p_trimestre, p_school_year, p_period_label);

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


-- 4. Re-create verify_bulletin
CREATE OR REPLACE FUNCTION public.verify_bulletin(
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

    v_stats := public.get_detailed_stats(v_student.id, p_trimestre, p_school_year);
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


-- 5. Re-create get_annual_stats
CREATE OR REPLACE FUNCTION public.get_annual_stats(
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
    SELECT moyenne_generale INTO v_t1 FROM public.get_class_stats_for_bulletin(p_student_id, 1, p_school_year);
    SELECT moyenne_generale INTO v_t2 FROM public.get_class_stats_for_bulletin(p_student_id, 2, p_school_year);
    SELECT moyenne_generale INTO v_t3 FROM public.get_class_stats_for_bulletin(p_student_id, 3, p_school_year);

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
