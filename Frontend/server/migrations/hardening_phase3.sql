-- ============================================================
-- HARDENING PHASE 3 — 2026-09-10
-- Faille #1 : fermeture du bypass de signup (côté app: SELF_SERVE_SIGNUP)
-- Faille #2 : bulletins vérifiables par TOKEN aléatoire (plus de
--             matricules énumérables via /verify et /api/parent/student)
-- Faille #3 : rate limiting durable via Upstash (côté app, pas de SQL)
-- Faille #4 : /check-abreviation + /info rate-limités côté app (pas de SQL)
--
-- Cette migration ne touche AUCUNE donnée métier (students, grades...).
-- Idempotente : ré-exécution sans risque.
-- À exécuter dans Supabase Dashboard → SQL Editor.
-- ============================================================

-- ============================================================
-- SECTION 1 — Colonne token de vérification sur `students`
-- ============================================================
-- POURQUOI : le matricule est séquentiel (0001 SLB 26 → 9999...) par
-- besoin métier (numérotation officielle). Il ne doit donc JAMAIS servir
-- de secret. Le QR des bulletins et l'API publique de vérification
-- utilisent désormais un token aléatoire 32 hex (128 bits d'entropie).
--
-- FONCTIONNEMENT PRÉSERVÉ : le matricule reste affiché, imprimé,
-- utilisé pour le login parent et toute la gestion scolaire. Seul le
-- canal "vérification publique de bulletin" change d'identifiant.
-- ============================================================

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS verify_token TEXT;

-- Un seul token par élève
CREATE UNIQUE INDEX IF NOT EXISTS students_verify_token_key
  ON public.students (verify_token)
  WHERE verify_token IS NOT NULL;

-- ============================================================
-- SECTION 2 — Backfill des tokens pour les élèves existants
-- ============================================================
-- Un seul passage grâce au prédicat "verify_token IS NULL" (idempotent).
-- L'extension pgcrypto fournit gen_random_bytes (dispo par défaut sur
-- les projets Supabase).
-- ============================================================

UPDATE public.students
SET verify_token = encode(gen_random_bytes(16), 'hex')
WHERE verify_token IS NULL;

-- ============================================================
-- SECTION 2b — Trigger : tout NOUVEL élève reçoit un token
-- ============================================================
-- POURQUOI : l'app crée des élèves par DEUX chemins — le backend
-- (POST /api/admin/students) ET un insert direct depuis le dashboard
-- admin (AdminDashboard → supabase.from('students').insert). Un trigger
-- BEFORE INSERT garantit qu'aucun élève ne naît sans token, quel que
-- soit le chemin. Idempotent : si l'app fournit déjà un token, on le
-- garde.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_verify_token()
RETURNS trigger AS $$
BEGIN
  IF NEW.verify_token IS NULL OR NEW.verify_token = '' THEN
    NEW.verify_token := encode(gen_random_bytes(16), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS students_set_verify_token ON public.students;
CREATE TRIGGER students_set_verify_token
  BEFORE INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.set_verify_token();

-- ============================================================
-- SECTION 3 — Nouvelle RPC : vérification par TOKEN
-- ============================================================
-- Remplace verify_bulletin(matricule, ...) pour le canal PUBLIC.
-- Exécutée uniquement par le backend (service_role) via
-- /api/parent/verify/:token. Elle reste SECURITY DEFINER pour lire
-- students/classes/grades sans exposer de grants supplémentaires.
-- La sortie est IDENTIQUE à l'ancienne fonction → la page
-- VerifyBulletin affiche exactement les mêmes champs qu'avant.
-- ============================================================

CREATE OR REPLACE FUNCTION public.verify_bulletin_by_token(
    p_token TEXT,
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
    IF p_token IS NULL OR length(p_token) <> 32 THEN
        RETURN NULL;
    END IF;

    SELECT s.id, s.nom, s.prenom, s.matricule, c.nom AS classe_nom
    FROM students s JOIN classes c ON s.classe_id = c.id
    WHERE s.verify_token = p_token
    INTO v_student;

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
        'matricule', v_student.matricule,
        'trimestre', p_trimestre,
        'schoolYear', p_school_year,
        'moyenne', v_moyenne,
        'rang', (v_stats->'general_stats'->>'rang') || '/' || (v_stats->'general_stats'->>'effectif'),
        'appreciation', v_appreciation
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Le backend (service_role) est le seul exécutant.
-- La fonction vérifie elle-même les entrées (token 32 hex).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'verify_bulletin_by_token'
      AND n.nspname = 'public'
      AND p.proacl::text LIKE '%service_role%'
  ) THEN
    GRANT EXECUTE ON FUNCTION public.verify_bulletin_by_token(TEXT, INTEGER, TEXT)
      TO service_role;
  END IF;
END $$;

-- ============================================================
-- SECTION 4 — Retirer verify_bulletin(matricule, ...)
-- ============================================================
-- POURQUOI SUPPRIMER : c'est la porte d'entrée de la faille #2. Tant
-- qu'elle existe, un matricule deviné + trimestre + année donne les
-- nom, prénom, classe, moyenne et rang d'un mineur. La page
-- VerifyBulletin utilise désormais /api/parent/verify/:token.
--
-- FONCTIONNEMENT PRÉSERVÉ : aucun écran ne l'appelle plus (vérifié dans
-- le code : seul le backend /api/parent/student l'utilisait, remplacé).
-- On supprime AUSSI la surcharge (TEXT, INTEGER) au cas où un vieux
-- projet l'aurait gardée.
-- ============================================================

DROP FUNCTION IF EXISTS public.verify_bulletin(TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.verify_bulletin(TEXT, INTEGER);

-- ============================================================
-- SECTION 5 — Contrôles post-migration
-- ============================================================
-- 1) Tous les élèves ont un token :
--    SELECT count(*) FROM students WHERE verify_token IS NULL;
--    → 0
--
-- 2) La RPC par token répond :
--    SELECT public.verify_bulletin_by_token(
--      (SELECT verify_token FROM students LIMIT 1),
--      1, (SELECT value FROM school_config WHERE key='current_year' LIMIT 1));
--    → un JSON (ou NULL si pas de notes pour la période)
--
-- 3) L'ancienne fonction par matricule est absente :
--    SELECT proname FROM pg_proc WHERE proname = 'verify_bulletin';
--    → 0 ligne
-- ============================================================

-- ============================================================
-- SECTION 6 — ROLLBACK (à décommenter seulement si nécessaire)
-- ============================================================
-- ALTER TABLE public.students DROP COLUMN IF EXISTS verify_token;
-- CREATE OR REPLACE FUNCTION public.verify_bulletin(...) ... -- voir fix_get_detailed_stats_overloading.sql §4
-- DROP FUNCTION IF EXISTS public.verify_bulletin_by_token(TEXT, INTEGER, TEXT);
-- ============================================================
