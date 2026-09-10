# 🚀 Checklist de déploiement & régression — Hardening Phase 2

> **Principe absolu : le fonctionnement ne doit pas changer d'1 mm.**
> Cette checklist valide chaque écran et chaque flux métier après le déploiement
> des correctifs de sécurité. Cocher chaque case — en cas d'échec, voir § Rollback.

---

## 📦 Pré-déploiement

- [ ] **Backup complet Supabase** (Dashboard → Database → Backups, ou `pg_dump`)
- [ ] Variables d'environnement Vercel présentes : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- [ ] (Optionnel mais recommandé) `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` → rate limits partagés entre toutes les instances serverless

---

## 🗄️ Étape 1 — Migration SQL (`hardening_phase2.sql`)

Dans **Supabase Dashboard → SQL Editor**, exécuter `Frontend/server/migrations/hardening_phase2.sql` puis les contrôles :

- [ ] Requête contrôle 1 : `admin_email` **absent** des grants anon/authenticated (0 ligne)
- [ ] Requête contrôle 2 : lecture publique `SELECT id, nom, abreviation FROM schools` fonctionne
- [ ] Requête contrôle 3 : policy `Profiles readable by school members` active, l'ancienne absente
- [ ] Requête contrôle 4 : rôles des profils **inchangés** (`SELECT role, count(*) FROM profiles GROUP BY role` identique à avant)

## 🔐 Étape 2 — Configuration Dashboard Supabase

- [ ] **Auth → Providers → Email → désactiver « Allow new users to sign up »**
      (l'app n'appelle jamais `signUp` — tous les comptes sont créés par le backend)
- [ ] Vérifier que les invitations/ créations backend fonctionnent toujours
      (elles passent par `auth.admin.createUser` = service_role, non affectées)

## 🔑 Étape 3 — Hash des PINs existants

Depuis `Frontend/`, avec les variables d'env chargées :

```bash
node server/utils/hashExistingPins.js           # 1) DRY-RUN — vérifier l'aperçu
node server/utils/hashExistingPins.js --apply   # 2) Application réelle
```

- [ ] Dry-run : nombre d'élèves en clair cohérent avec la réalité
- [ ] `--apply` : 0 échec dans le résumé (sinon relancer — le script est ré-exécutable)
- [ ] Vérification : `SELECT count(*) FROM students WHERE pin_code NOT LIKE '$2%' AND pin_code IS NOT NULL;` → **0**

## ☁️ Étape 4 — Déploiement Vercel

- [ ] `vercel.json` validé (headers via route `continue: true` — le build doit passer)
- [ ] Déployer et attendre le build OK

---

## 🧪 Étape 5 — Régression fonctionnelle (le cœur du contrôle)

### 5.1 Authentification

- [ ] **Login admin** (email + mot de passe) → connexion OK, tableau de bord affiché
- [ ] **Login parent** (matricule `0001 SLB 26` + PIN) → connexion OK, dashboard parent affiché
- [ ] **Login parent mauvais PIN** → message « Identifiants incorrects » (comme avant)
- [ ] **Matricule avec abréviation inconnue** → message « Aucune école trouvée avec l'abréviation »
- [ ] **Login admin d'une école restreinte** → blocage avec message de date (inchangé)
- [ ] **Récupération de mot de passe admin** → email envoyé, rate-limit 5/h toujours actif

### 5.2 Admin (gestion de l'école)

- [ ] **Ajouter un élève** → matricule + PIN reçus en notification (comme avant)
      → le nouveau PIN en base est hashé (`$2a$...`) mais l'affichage admin montre le PIN clair
- [ ] **Réinitialiser le PIN d'un parent** → nouveau PIN affiché à l'admin, parent peut se connecter avec
- [ ] **Ajouter un professeur** → mot de passe provisoire affiché, prof visible dans la liste
- [ ] **Liste des professeurs** → noms/matières/classes affichés (policy profiles OK)
- [ ] **Classes, matières, élèves, absences, cahier de texte, notes** → toutes les listes se chargent
- [ ] **Config école** (trimestre courant, année) → lisible et modifiable
- [ ] **Modifier les infos de l'école** (PATCH /api/schools/my-school) → OK
- [ ] **Temps réel** (Realtime) → ajouter un élève dans un autre onglet rafraîchit la liste

### 5.3 Professeur

- [ ] **Login prof** → dashboard prof OK
- [ ] **Liste de classe** → élèves affichés, **SANS colonne PIN** (correction FIND-015)
- [ ] **Saisie de notes** → upsert OK (interros, DW, devoirs, composition)
- [ ] **Pointage des absences** → OK
- [ ] **Cahier de texte** → ajout de leçon OK ; modification possible dans les 12h (policy inchangée)

### 5.4 Parent

- [ ] **Dashboard parent** → notes, absences, moyenne de l'enfant affichées
- [ ] **Cahier de texte** → nom du professeur visible (jointure profiles toujours OK)
- [ ] **Génération de bulletin PDF + QR code** → OK

### 5.5 Vérification publique de bulletin (QR code)

- [ ] **URL du QR code** (`/verify/<matricule>/<trimestre>/<année>`) → bulletin affiché
- [ ] Sur une installation **multi-écoles** : vérifier que le trimestre/année vient de
      **l'école de l'élève** (correctif FIND-017), pas d'une autre école
- [ ] **Rate-limit bulletin** → 30 requêtes/5 min puis 429 (inchangé)

### 5.6 Super-admin

- [ ] **Sélecteur d'écoles** (Mode Super Admin) → toutes les écoles listées, bascule OK
- [ ] **Onglet Écoles** → statistiques élèves/profs, **email admin toujours affiché**
      (il vient du backend `/api/super-admin` — service_role, non affecté par les grants)
- [ ] **Restreindre / Réactiver une école** → OK, statuts et dates affichés
- [ ] **Supprimer une école** → nettoyage complet OK *(à tester en dernier, destructif)*
- [ ] **`x-school-id`** : les actions admin en mode super-admin ciblent bien l'école active

---

## 🔍 Étape 6 — Vérifications de sécurité (post-déploiement, en ligne)

```bash
# 1) Les headers de sécurité sont présents (X-Frame-Options, CSP, nosniff...)
curl -sI https://ecole-eosin.vercel.app/ | grep -iE "x-frame|content-security|x-content"

# 2) admin_email n'est plus exposé via l'API REST publique
curl -s "https://<projet>.supabase.co/rest/v1/schools?select=*" \
  -H "apikey: <ANON_KEY>" | grep -c admin_email   # attendu : 0 occurrence de valeur

# 3) L'inscription publique est bien fermée (compte créé → erreur)
curl -s -X POST "https://<projet>.supabase.co/auth/v1/signup" \
  -H "apikey: <ANON_KEY>" -H "Content-Type: application/json" \
  -d '{"email":"test_audit_x@proton.me","password":"Test123456!"}'
# attendu : erreur "Signups not allowed"

# 4) Rate limit global : 130 requêtes rapides → au moins une 429
```

- [ ] Headers présents sur `/` **et** sur une route API
- [ ] `admin_email` absent de la réponse publique (2)
- [ ] Signup public rejeté (3)
- [ ] RLS toujours actives : INSERT anon sur `students` → « permission denied » (inchangé)

---

## ⏪ Rollback (si un échec bloquant est détecté)

| Problème | Action |
|---|---|
| Un écran ne charge plus ses données (grant `schools`) | Décommenter § 5 de `hardening_phase2.sql` → `GRANT SELECT ON schools TO anon, authenticated;` puis ré-exécuter |
| Profils illisibles (jointures cassées) | § 5 : recréer la policy `USING (auth.role() = 'authenticated')` |
| CSP bloque une ressource frontend | Retirer la première route de `vercel.json` (headers) et redéployer ; ajuster le CSP ensuite |
| Rate limit trop agressif | Monter `max` (120) dans `api/index.js` ou retirer le middleware global |
| Inscription publique | Réactiver « Allow new users to sign up » (comportement d'avant) |
| PINs | Le hash est irréversible mais **sans impact** : les parents utilisent Auth, pas `pin_code`. Aucun rollback nécessaire. |

---

## 📝 Notes

- La migration SQL est **idempotente** : ré-exécution sans risque.
- Le script PINs est **ré-exécutable** : les PINs déjà hashés sont ignorés.
- Les PINs « manuellement définis » par l'admin (`AdminDashboard` → `pin_code`) sont
  désormais hashés eux aussi au reset (`POST /students/reset-pin`).
