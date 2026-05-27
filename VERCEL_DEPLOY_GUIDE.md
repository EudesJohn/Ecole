# Guide de déploiement Vercel pour le projet École

## Problèmes courants et solutions

### 1. Erreur "API route not found" ou "Module not found"

**Cause probable** : Vercel ne trouve pas les fichiers API ou les dépendances.

**Solutions** :

#### a) Vérifiez la structure des fichiers
Assurez-vous que votre structure est :
```
Frontend/
├── api/
│   └── index.js       # Point d'entrée de l'API
├── src/
│   └── ...           # Code React
├── package.json
└── vercel.json
```

#### b) Mettez à jour vercel.json
```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index.js"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "framework": "vite",
  "installCommand": "npm install",
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

### 2. Erreur "Environment variables not found"

**Solution** :

1. Allez dans votre tableau de bord Vercel
2. Sélectionnez votre projet
3. Allez dans "Settings" > "Environment Variables"
4. Ajoutez toutes les variables d'environnement nécessaires :
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `JWT_SECRET`
   - `DATABASE_URL`
   - Toutes autres variables utilisées dans votre `.env`

### 3. Erreur "Build failed" avec Vite

**Solutions** :

#### a) Vérifiez votre package.json
Assurez-vous d'avoir ces scripts :
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
```

#### b) Mettez à jour les dépendances
```bash
npm install
npm update vite @vitejs/plugin-react
```

### 4. Problème avec les routes API Express

**Solution** :

Votre `api/index.js` doit exporter correctement pour Vercel :

```javascript
// Frontend/api/index.js
const express = require('express');
const app = express();

// ... votre configuration existante ...

// Export pour Vercel
module.exports = app;
```

### 5. Erreur "Module not found: bcryptjs"

**Solution** :

Vercel a des limitations avec certains modules natifs. Utilisez des alternatives ou configurez Vercel pour utiliser Node.js 18+ :

1. Créez un fichier `.nvmrc` dans le dossier Frontend :
```
18
```

2. Ou spécifiez dans vercel.json :
```json
{
  "nodeVersion": "18.x"
}
```

### 6. Problème de CORS

**Solution** :

Assurez-vous que votre API Express a CORS configuré :

```javascript
// Frontend/api/index.js
const cors = require('cors');
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://votre-domaine.vercel.app' 
    : 'http://localhost:5173'
}));
```

## Configuration recommandée pour Vercel

### 1. Fichier vercel.json complet

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/index.js",
      "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "nodeVersion": "18.x",
  "installCommand": "npm install",
  "buildCommand": "npm run build"
}
```

### 2. Fichier .vercelignore (optionnel)

Créez un fichier `.vercelignore` pour exclure les fichiers inutiles :

```
# .vercelignore
.node_modules
.DS_Store
*.log
*.env
*.env.local
*.env.development
*.env.test
```

### 3. Configuration de projet Vercel

Dans les paramètres du projet Vercel :

- **Build & Development Settings** :
  - Build Command: `npm run build`
  - Install Command: `npm install`
  - Output Directory: `dist`
  - Node.js Version: `18.x`

- **Environment Variables** :
  Ajoutez toutes vos variables d'environnement nécessaires

## Dépannage avancé

### Vérifier les logs de déploiement

1. Allez dans votre tableau de bord Vercel
2. Sélectionnez le déploiement qui a échoué
3. Cliquez sur l'onglet "Deployments"
4. Consultez les logs pour voir l'erreur exacte

### Problèmes courants et solutions

| Erreur | Solution |
|--------|----------|
| `Error: ENOENT: no such file or directory` | Vérifiez les chemins des fichiers dans vercel.json |
| `Module not found: can't resolve` | Exécutez `npm install` localement puis poussez node_modules (ou vérifiez package.json) |
| `API resolved without sending a response` | Vérifiez que toutes les routes Express envoient une réponse |
| `Build exceeded maximum allowed runtime` | Optimisez votre build ou contactez le support Vercel |

### Tester localement avant de déployer

```bash
# Testez la build localement
npm run build

# Servez la build localement
npm run preview

# Testez les API localement
node api/index.js
```

## Configuration pour les routes API Express

Assurez-vous que votre `api/index.js` est configuré pour Vercel :

```javascript
// Frontend/api/index.js
const express = require('express');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const adminRouter = require('./routes/admin');
app.use('/api', adminRouter);

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Export pour Vercel
module.exports = app;
```

## Variables d'environnement nécessaires

Assurez-vous d'avoir ces variables configurées dans Vercel :

```
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-key
JWT_SECRET=your-jwt-secret
DATABASE_URL=your-database-url
NODE_ENV=production
```

## Contact et support

Si vous continuez à rencontrer des problèmes :

1. Consultez la [documentation officielle de Vercel](https://vercel.com/docs)
2. Vérifiez les [guides de déploiement Vite](https://vitejs.dev/guide/static-deploy.html#vercel)
3. Contactez le support Vercel avec :
   - L'URL de votre projet
   - Le message d'erreur exact
   - Les logs de déploiement
   - Votre fichier vercel.json

---

*Dernière mise à jour : 27 mai 2026*
