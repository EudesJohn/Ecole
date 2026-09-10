const express = require('express');
const cors = require('cors');
// const { supabase } = require('./supabase'); // Suppressed if not needed here

const app = express();

// Confiance dans le proxy Vercel (IP réelles pour le rate limiting)
app.set('trust proxy', true);

// Security headers (FIND-012) — appliqués à toutes les réponses API
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Middleware
const allowedOrigins = [
  'https://ecole.vercel.app',
  'https://ecole-eosin.vercel.app',
  'https://erp-ecole.bj'
];

// localhost autorisé UNIQUEMENT en développement (FIND-013)
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push(/^https?:\/\/localhost(:\d+)?$/);
}
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, etc.)
    if (!origin) return callback(null, true);
    const allowed = allowedOrigins.some(o =>
      typeof o === 'string' ? origin === o : o.test(origin)
    );
    if (allowed) return callback(null, true);
    callback(new Error('Origine non autorisée par CORS'));
  }
}));
app.use(express.json());

// Rate limit global doux (FIND-018) : bien au-dessus de l'usage réel d'un
// utilisateur légitime (navigation admin ≈ 1-2 req/s au pire), il arrête
// les scripts de scanning et le brute-force à grande échelle.
const globalRateLimit = require('../server/middleware/rateLimit')({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Trop de requêtes. Veuillez ralentir.'
});
app.use(globalRateLimit);

// Main handler for Vercel
const router = express.Router();

// Basic route with versioning for debug
router.get('/', (req, res) => {
  res.json({ 
    message: 'École SLB Unified Backend Ready on Vercel',
    version: '1.0.2',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

// Routes
router.use('/auth', require('../server/routes/auth'));
router.use('/admin', require('../server/routes/admin'));
router.use('/teacher', require('../server/routes/teacher'));
router.use('/parent', require('../server/routes/parent'));
router.use('/health', require('../server/routes/health'));
router.use('/schools', require('../server/routes/schools'));
router.use('/super-admin', require('../server/routes/super-admin'));

// Mount everything on /api (production) AND / (backup)
// This ensures that either local dev or Vercel rewrites work correctly.
app.use('/api', router);
app.use('/', router); 

// Global Error Handler — message générique, détails dans les logs serveur uniquement
app.use((err, req, res, _next) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({ 
    error: 'Une erreur interne est survenue. Veuillez réessayer.'
  });
});

// 404 Handler (JSON)
app.use((req, res) => {
  res.status(404).json({ 
    error: `Route ${req.method} ${req.url} not found`,
    path: req.path,
    hint: 'Ensure your fetch URL matches the API structure. If you see /api/api, check your Express and Vercel routing.'
  });
});

// Start server locally if run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 École SLB Unified Backend running locally!`);
    console.log(`👉 API Endpoint: http://localhost:${PORT}`);
    console.log(`==================================================\n`);
  });
}

module.exports = app;
