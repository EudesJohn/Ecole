const express = require('express');
const cors = require('cors');
// const { supabase } = require('./supabase'); // Suppressed if not needed here

const app = express();

// Middleware
app.use(cors({ origin: true }));
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
router.use('/auth', require('./routes/auth'));
router.use('/admin', require('./routes/admin'));
router.use('/teacher', require('./routes/teacher'));
router.use('/parent', require('./routes/parent'));

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
    hint: 'Ensure your fetch URL matches the API structure.'
  });
});

module.exports = app;
