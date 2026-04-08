const { supabase, supabaseVerify } = require('../supabase');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  // Robust token extraction
  let token = null;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.substring(7).trim();
  }
  
  if (!token || token === 'undefined' || token === 'null') {
    console.error('VerifyToken: Token missing or literal string "undefined"/"null"');
    return res.status(401).json({ error: 'No valid token provided' });
  }

  try {
    // FAIL-SAFE: Direct HTTP call to Supabase Auth API
    // This bypasses any library-level session management issues.
    const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
    const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();

    const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseAnonKey
      }
    });

    if (!authCheck.ok) {
      const errorData = await authCheck.json().catch(() => ({}));
      console.error('VerifyToken: Auth API rejected token:', errorData.msg || errorData.error);
      return res.status(401).json({ 
        error: errorData.msg || errorData.error || 'Authentication rejected by Supabase',
        code: 'AUTH_API_REJECTED',
        source: 'Supabase Raw API',
        hint: 'Your session might be invalid. Please log out and log back in.'
      });
    }

    const user = await authCheck.json();
    req.user = user;
    
    // Fetch role from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    
    if (profileError) {
      console.error('VerifyToken: Error fetching profile:', profileError.message);
    }
    
    req.role = profile?.role || 'parent';
    next();
  } catch (error) {
    console.error('VerifyToken: Unexpected Error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = verifyToken;
