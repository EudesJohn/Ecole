const { createClient } = require('@supabase/supabase-js');

// On Vercel, environment variables are already in process.env.
// dotenv is only useful for local development.
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in environment!');
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

module.exports = { supabase };
