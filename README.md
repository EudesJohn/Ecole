# Saint Lambert (SLB) - ERP Scolaire 🎓

[![CI - Frontend Build](https://github.com/EudesJohn/Ecole/actions/workflows/ci.yml/badge.svg)](https://github.com/EudesJohn/Ecole/actions/workflows/ci.yml)
[![Vercel Deployment](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com/)

Une solution de gestion scolaire moderne, sécurisée et mobile-first, conçue spécifiquement pour le système éducatif béninois.

## 🚀 Fonctionnalités Clés

### 🔐 Authentification & Rôles
- **Multi-portails** : Accès dédiés pour Admin, Enseignants et Parents.
- **Supabase Auth** : Authentification sécurisée avec gestion fine des permissions (RLS).
- **Profils** : Metadata enrichies pour gérer les rôles et affiliations.

### 📚 Gestion Pédagogique
- **Matricules Automatiques** : Génération séquentielle intelligente (ex: `0001 SLB 26`).
- **Calculateur de Moyennes Hybride** : Support natif du système Primaire et Secondaire béninois.
- **Appel Numérique** : Suivi des présences en temps réel par classe et par matière.

### 📄 Rapports & Sécurité
- **Bulletins PDF** : Génération instantanée de bulletins complets avec rangs, statistiques et moyennes de classe.
- **Vérification QR Code** : Chaque bulletin dispose d'un QR code unique permettant une vérification publique de son authenticité.
- **Portail Parent** : Consultation des notes et téléchargement des bulletins en temps réel.

## 🛠 Tech Stack

- **Frontend** : [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Styling** : [Tailwind CSS](https://tailwindcss.com/) + [Framer Motion](https://www.framer.com/motion/)
- **Backend & DB** : [Supabase](https://supabase.com/) (PostgreSQL + RLS)
- **Déploiement** : [Vercel](https://vercel.com/) (Frontend + Serverless Functions)
- **PDF** : [@react-pdf/renderer](https://react-pdf.org/)
- **QR Codes** : [qrcode.react](https://github.com/zpao/qrcode.react)

## 📦 Installation & Configuration

1. **Cloner le projet** :
   ```bash
   git clone https://github.com/EudesJohn/Ecole.git
   cd Ecole
   ```

2. **Installer les dépendances** :
   ```bash
   cd Frontend
   npm install
   ```

3. **Variables d'environnement** :
   Créez un fichier `.env` dans le dossier `Frontend/` :
   ```env
   VITE_SUPABASE_URL=votre_url_supabase
   VITE_SUPABASE_ANON_KEY=votre_cle_anon_supabase
   ```

4. **Lancer le développement** :
   ```bash
   npm run dev
   ```

## 🌍 Déploiement

Le projet est configuré pour un déploiement continu sur **Vercel**.
- Le dossier racine pour Vercel doit être réglé sur `Frontend`.
- Les fonctions API se trouvent dans `Frontend/api` et sont déployées en tant que Vercel Serverless Functions.

## 📝 Licence

Propriété de Saint Lambert (SLB). Tous droits réservés.
