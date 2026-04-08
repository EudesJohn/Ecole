const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    env: {
      SUPABASE_URL: process.env.SUPABASE_URL ? '✅ Present' : '❌ Missing',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Present' : '❌ Missing',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? '✅ Present' : '❌ Missing',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ? '✅ Present' : '❌ Missing',
      NODE_ENV: process.env.NODE_ENV
    }
  });
});

module.exports = router;
