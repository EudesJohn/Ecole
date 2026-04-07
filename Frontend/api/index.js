const express = require('express');
const cors = require('cors');
const { supabase } = require('./supabase');

const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Basic route
app.get('/api', (req, res) => {
  res.json({ message: 'École SLB Unified Backend Ready on Vercel' });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/teacher', require('./routes/teacher'));
app.use('/api/parent', require('./routes/parent'));

// Vercel handles the listening, we just export the app
module.exports = app;
