# 🔒 Hardening Phase 3 — Fermeture des 4 failles résiduelles

> **Principe inchangé : le fonctionnement métier ne doit pas changer.**
> Chaque correctif préserve le flux existant (login, notes, bulletins,
> dashboards) et ferme uniquement le canal d'attaque.

---

## 📋 Résumé des 4 failles et des correctifs

| # | Faille | Correctif | Impact fonctionnel |
|---|--------|-----------|--------------------|
| 1 | Bypass « signups disabled » via `POST /api/schools/register` | Endpoint **fermé par défaut** (`SELF_SERVE_SIGNUP`). Les écoles sont créées par le **super-admin** (nouveau bouton « Ajouter une école » dans le panneau Écoles, `POST /api/super-admin/schools`). | Le funnel public `/register` affiche « Inscriptions fermées ». Pour le rouvrir : `SELF_SERVE_SIGNUP=true` dans Vercel + redéploiement (aucune modif code). |
| 2 | Bulletins consultables sans compte + matricules séquentiels | Nouvelle colonne `students.verify_token` (32 hex aléatoires) + RPC `verify_bulletin_by_token` + route `GET /api/parent/verify/:token`. Les QR codes des bulletins pointent vers `/verify/<token>/...`. L'ancienne route `/api/parent/student/:matricule` renvoie **410 Gone**. | La vérification publique par QR **fonctionne toujours** (même page, mêmes champs). Impossible à énumérer. ⚠️ Les **vieux QR imprimés** (au matricule) ne vérifient plus : réimprimer les bulletins courants. |
| 3 | Rate-limiter fail-open + par instance | `rateLimit.js` durci : clés **par route** (plus d'interférence global/routes) + mode **fail-closed ciblé** (`failClosed: true`) sur les limiteurs sensibles en production. | Si Upstash est configuré mais injoignable en prod : les endpoints sensibles (register, bulletins) renvoient 503 au lieu de laisser passer. Sans Upstash : fonctionnement in-memory identique à avant. |
| 4 | Énumération des écoles clientes | `check-abreviation` et `schools/info` rate-limités à **20 req / 5 min / IP**. | Aucun changement UX : 1 check au formulaire d'inscription, 1 détection au login parent. |

---

## 📦 Étape 1 — Migration SQL (OBLIGATOIRE pour la faille #2)

Dans **Supabase Dashboard → SQL Editor**, exécuter
`Frontend/server/migrations/hardening_phase3.sql` puis vérifier :

- [ ] Contrôle 1 : `SELECT count(*) FROM students WHERE verify_token IS NULL;` → **0**
      (le backfill + le trigger couvrent les élèves existants ET futurs)
- [ ] Contrôle 2 : `SELECT public.verify_bulletin_by_token(
        (SELECT verify_token FROM students LIMIT 1), 1,
        (SELECT value FROM school_config WHERE key='current_year' LIMIT 1));`
      → un JSON (ou NULL si pas de notes pour la période)
- [ ] Contrôle 3 : `SELECT proname FROM pg_proc WHERE proname='verify_bulletin';` → **0 ligne**
      (l'ancienne fonction par matricule est supprimée)

## ☁️ Étape 2 — Variables d'environnement Vercel

- [ ] `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (faille #3)
- [ ] `SELF_SERVE_SIGNUP` : **ne pas définir** (ou `false`) → inscriptions fermées
- [ ] Redéployer

## 🧪 Étape 3 — Régression fonctionnelle

### Auth & écoles
- [ ] Login admin / prof / parent → inchangé
- [ ] `/register` → écran « Inscriptions fermées »
- [ ] `POST /api/schools/register` → **403** avec `code: 'SIGNUP_CLOSED'`
- [ ] Super-admin → Onglet Écoles → « Ajouter une école » → école créée,
      login admin de la nouvelle école OK (config initiale présente)
- [ ] `GET /api/schools/register-status` → `{"selfServiceEnabled": false, ...}`

### Bulletins (faille #2)
- [ ] Générer un bulletin (admin, prof, parent) → PDF OK, QR présent
- [ ] Scanner le QR → `/verify/<token>/...` → page « BULLETIN AUTHENTIQUE »
      avec nom, classe, moyenne, rang — identique à avant
- [ ] Ancienne URL `/verify/0001%20SLB%2026/1/2025-2026` → page
      « Document Non Vérifié » avec le message « ancienne méthode »
- [ ] `GET /api/parent/student/0001%20SLB%2026` → **410**
- [ ] 31 vérifications rapides → **429** (rate-limit bulletin inchangé)

### Rate limiting (faille #3)
- [ ] Redis Upstash joignable → limiteurs globaux et par route indépendants
- [ ] (Optionnel) Simuler une panne Redis : les routes sensibles → 503,
      le reste du site continue de fonctionner

## ⏪ Rollback

| Problème | Action |
|---|---|
| QR codes ne vérifient plus (migration non exécutée) | Exécuter `hardening_phase3.sql` — les nouveaux bulletins fonctionnent immédiatement |
| Besoin urgent de l'ancienne vérification par matricule | Décommenter la § 6 de la migration (recrée `verify_bulletin`) + rétablir l'ancienne route `parent.js` (voir git) |
| Funnel public à réouvrir | `SELF_SERVE_SIGNUP=true` dans Vercel + redéploiement |
| Rate limit trop agressif sur les abréviations | Monter `max` (20) dans `schools.js` |

## 📝 Notes techniques

- `verify_token` : 128 bits d'entropie (`gen_random_bytes(16)`), index
  unique partiel. Le trigger `students_set_verify_token` garantit que
  **tout** nouvel élève en reçoit un, quel que soit le chemin d'insertion
  (backend ou insert direct du dashboard admin).
- La RPC `verify_bulletin_by_token` valide le format du token (32 hex)
  et ne révèle AUCUNE donnée si le token est inconnu (404 côté API).
- L'ancien endpoint `parent/student` renvoie 410 (pas 404) pour que la
  page `/verify` affiche un message pédagogique (« ancienne méthode »)
  aux détenteurs de vieux QR imprimés.
- La migration est **idempotente** et ne touche aucune donnée métier.
