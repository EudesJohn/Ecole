-- ============================================================
-- HARDENING PHASE 2 — Réduction d'exposition SANS changement
-- de fonctionnement. Complète hardening_phase1.sql.
--
-- Principe : tout ce qui existe reste. On ne fait que réduire
-- CE QUE VOIENT les clients (anon/authenticated), jamais ce
-- que font les routes backend (service_role = unaffected).
--
-- Idempotent : peut être ré-exécuté sans risque.
-- À exécuter dans Supabase SQL Editor.
-- ============================================================

-- ============================================================
-- SECTION 1 — FIND-001 : admin_email masqué dans `schools`
-- ============================================================
-- POURQUOI ÇA EXISTE : les lectures publiques de `schools`
-- sont volontaires (login parent par abréviation, vérif du
-- statut "restricted", page de login qui affiche le nom de
-- l'école). On les GARDE toutes.
--
-- LA FAILLE : la colonne admin_email voyageait avec chaque
-- lecture publique → accessible avec la clé anon.
--
-- LA SOLUTION : grants au niveau COLONNE. Toutes les lectures
-- existantes passent déjà (elles ne sélectionnent que id, nom,
-- abreviation, ville, pays, logo_url, status, restricted_until).
-- Le backend (service_role) garde un accès TOTAL : aucune
-- route, aucun écran super-admin ne change.
-- ============================================================

REVOKE ALL ON public.schools FROM anon, authenticated;

GRANT SELECT (
  id, nom, abreviation, ville, pays, logo_url,
  status, restricted_until, restricted_at, restriction_reason,
  created_at
) ON public.schools TO anon, authenticated;

-- ============================================================
-- SECTION 2 — FIND-015 : profils lisibles par école
-- ============================================================
-- POURQUOI ÇA EXISTE : chaque utilisateur lit son propre
-- profil (fetchProfile), les admins listent les professeurs
-- de LEUR école, et les parents voient le nom du professeur
-- dans le Cahier de texte (jointure profiles).
--
-- LA FAILLE : la policy "authenticated" permettait à N'IMPORTE
-- QUEL compte connecté de lire TOUS les profils de TOUTES les
-- écoles (emails, téléphones, rôles).
--
-- LA SOLUTION : les 3 usages légitimes ci-dessus passent tous
-- par (soi-même) OU (sa propre école) OU (super_admin).
-- Aucun écran ne change ; la fuite inter-écoles disparaît.
-- ============================================================

DROP POLICY IF EXISTS "Profiles readable by authenticated users" ON public.profiles;

CREATE POLICY "Profiles readable by school members"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR school_id = current_user_school_id()
    OR check_is_super_admin()
  );

-- ============================================================
-- SECTION 3 — FIND-016 : rôle non injectable à l'inscription
-- ============================================================
-- POURQUOI ÇA EXISTE : handle_new_user copie le rôle depuis
-- user_metadata car les comptes créés PAR LE BACKEND
-- (admins d'école, professeurs, parents) passent leur rôle
-- dans les métadonnées (admin.js, schools.js). C'est
-- nécessaire au fonctionnement.
--
-- LA FAILLE : si l'inscription publique est réactivée un jour,
-- n'importe qui peut POSTer user_metadata {role: 'admin'}.
--
-- LA SOLUTION : le rôle des métadonnées n'est honoré QUE si
-- school_id est présent dans les métadonnées. Or seuls les
-- comptes créés par le backend passent school_id (vérifié :
-- createUser de schools/register, admin/students,
-- admin/teachers). Donc : fonctionnement identique pour tous
-- les comptes légitimes, injection impossible pour les autres.
-- ============================================================

DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, prenom, nom, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'prenom', ''),
    COALESCE(new.raw_user_meta_data->>'nom', ''),
    -- Rôle des métadonnées honoré UNIQUEMENT pour les comptes
    -- créés par le backend (school_id présent). Sinon 'parent'.
    CASE
      WHEN NULLIF(new.raw_user_meta_data->>'school_id', '') IS NOT NULL
        THEN COALESCE(new.raw_user_meta_data->>'role', 'parent')
      ELSE 'parent'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- SECTION 4 — CONTRÔLES (à exécuter pour vérification)
-- ============================================================
-- 1) L'email admin ne doit plus être lisible par les clients :
--    SELECT column_name, privilege_type
--    FROM information_schema.column_privileges
--    WHERE table_name = 'schools'
--      AND column_name = 'admin_email'
--      AND grantee IN ('anon', 'authenticated');
--    → 0 ligne attendue.
--
-- 2) La lecture publique des écoles fonctionne toujours :
--    SELECT id, nom, abreviation FROM public.schools;
--    → doit fonctionner (colonnes granted).
--
-- 3) Policy profiles active :
--    SELECT policyname FROM pg_policies
--    WHERE tablename = 'profiles';
--    → "Profiles readable by school members" présente,
--      "Profiles readable by authenticated users" absente.
--
-- 4) Rôles existants INCHANGÉS :
--    SELECT role, count(*) FROM public.profiles GROUP BY role;
--    → identique à avant la migration.
--
-- ============================================================
-- SECTION 5 — ROLLBACK (annulation complète, à décommenter)
-- ============================================================
-- GRANT SELECT ON public.schools TO anon, authenticated;
-- DROP POLICY IF EXISTS "Profiles readable by school members" ON public.profiles;
-- CREATE POLICY "Profiles readable by authenticated users"
--   ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
-- (le trigger d'origine est dans schema_final.sql section 8)
-- ============================================================
