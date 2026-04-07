const express = require('express');
const cors = require('cors');
const { supabase } = require('./supabase');

const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Main handler for Vercel
const router = express.Router();

// Basic route
router.get('/', (req, res) => {
  res.json({ 
    message: 'École SLB Unified Backend Ready on Vercel',
    env: process.env.NODE_ENV,
    status: 'online'
  });
});

// Routes
router.use('/auth', require('./routes/auth'));
router.use('/admin', require('./routes/admin'));
router.use('/teacher', require('./routes/teacher'));
router.use('/parent', require('./routes/parent'));

// Mount everything on /api (production) AND / (backup)
app.use('/api', router);
app.use('/', router); 

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
