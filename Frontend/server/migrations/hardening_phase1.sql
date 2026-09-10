-- ============================================================
-- HARDENING PHASE 1 — Corrections de sécurité (2026-09-10)
-- ============================================================
-- Corrige 3 failles de l'audit, SANS changer le fonctionnement :
--
--   FIND-002 (critique) : un admin d'école pouvait se promouvoir
--                         lui-même (ou un professeur) en super_admin.
--   FIND-003 (élevée)   : verify_bulletin appelable par des
--                         inconnus non connectés → énumération des
--                         résultats de tous les élèves.
--   FIND-005 (élevée)   : tous les profils (emails, noms, rôles)
--                         lisibles par des inconnus non connectés.
--
-- Fonctionnement préservé :
--   ✔ Connexion admin / professeur / parent : inchangée
--   ✔ Création d'élèves/profs par l'admin : passe par le backend
--     (service_role) → inchangée
--   ✔ Cahier de texte : le parent voit toujours le nom du prof
--     (les utilisateurs CONNECTÉS peuvent lire les profils)
--   ✔ Vérification de bulletin par QR : passe désormais par le
--     backend (/api/parent/student/...) → même affichage
--   ✔ Le super_admin garde tous ses pouvoirs
--
-- ROLLBACK complet : voir la section 5 en bas du fichier.
-- ============================================================

-- ============================================================
-- SECTION 1 — FIND-002 : bloquer le changement de rôle
-- ============================================================
-- Postgres permet de révoquer UPDATE colonne par colonne.
-- On interdit aux clients (anon + authenticated) de modifier la
-- colonne `role`. Les vrais changements de rôle continuent de
-- fonctionner car ils passent par :
--   - le trigger handle_new_user (SECURITY DEFINER) à l'inscription
--   - le backend (clé service_role) pour créer profs/parents
--   - le SQL Editor pour le super_admin
-- ============================================================

REVOKE UPDATE (role) ON public.profiles FROM anon, authenticated;

-- ============================================================
-- SECTION 2 — FIND-003 : fermer verify_bulletin aux anonymes
-- ============================================================
-- La fonction était exécutable par `anon` (défaut Supabase).
-- Désormais : uniquement les utilisateurs connectés (authenticated)
-- et le backend (service_role), qui l'expose via
-- /api/parent/student/:matricule (avec rate limiting possible).
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.verify_bulletin(TEXT, INTEGER, TEXT)
  FROM anon, public;

GRANT EXECUTE ON FUNCTION public.verify_bulletin(TEXT, INTEGER, TEXT)
  TO authenticated, service_role;

-- ============================================================
-- SECTION 3 — FIND-005 : profils non lisibles par les anonymes
-- ============================================================
-- Avant : USING (true) → n'importe qui avec la clé anon pouvait
-- lister tous les emails de toutes les écoles.
-- Après : seuls les utilisateurs CONNECTÉS lisent les profils.
-- C'est nécessaire pour que le parent voie le nom du professeur
-- dans le Cahier de texte (jointure profiles), sans rien changer
-- d'autre. Les inconnus non connectés ne voient plus rien.
-- ============================================================

DROP POLICY IF EXISTS "Profiles are readable" ON public.profiles;
DROP POLICY IF EXISTS "Profiles readable" ON public.profiles;
DROP POLICY IF EXISTS "Everyone reads profiles" ON public.profiles;

CREATE POLICY "Profiles readable by authenticated users"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================
-- SECTION 4 — Vérification (à exécuter pour contrôle)
-- ============================================================
-- 1) Les politiques actives sur profiles :
--    SELECT policyname, cmd FROM pg_policies
--    WHERE tablename = 'profiles' ORDER BY policyname;
--    → on doit voir "Profiles readable by authenticated users"
--
-- 2) Le rôle n'est plus modifiable par les clients :
--    SELECT privilege_type, column_name FROM information_schema.column_privileges
--    WHERE table_name='profiles' AND column_name='role'
--      AND grantee IN ('anon','authenticated');
--    → aucune ligne ne doit montrer 'UPDATE' pour anon/authenticated
--
-- 3) verify_bulletin :
--    SELECT grantee, privilege_type FROM information_schema.role_routine_grants
--    WHERE routine_name='verify_bulletin';
--    → EXECUTE présent pour authenticated et service_role, absent pour anon
-- ============================================================

-- ============================================================
-- SECTION 5 — ROLLBACK (annulation complète, à décommenter)
-- ============================================================
-- GRANT UPDATE (role) ON public.profiles TO anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.verify_bulletin(TEXT, INTEGER, TEXT) TO anon, public;
-- DROP POLICY IF EXISTS "Profiles readable by authenticated users" ON public.profiles;
-- CREATE POLICY "Profiles are readable" ON public.profiles FOR SELECT USING (true);
-- ============================================================
