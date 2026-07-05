const express = require('express');
const cors = require('cors');
// const { supabase } = require('./supabase'); // Suppressed if not needed here

const app = express();

// Middleware
const allowedOrigins = [
  'https://ecole.vercel.app',
  'https://ecole-eosin.vercel.app',
  'https://erp-ecole.bj',
  /^https?:\/\/localhost(:\d+)?$/
];
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

// Global Error Handler
app.use((err, req, res, _next) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal Server Error',
    path: req.url,
    method: req.method
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
