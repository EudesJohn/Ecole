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
    const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
    const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();

    if (!supabaseUrl) throw new Error('SUPABASE_URL is not configured on server');

    let authCheck;
    try {
      authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': supabaseAnonKey
        }
      });
    } catch (fetchErr) {
      console.error('VerifyToken: Fetch network error:', fetchErr.message);
      return res.status(503).json({ error: 'Identity service currently unreachable', source: 'Backend Network' });
    }

    const responseBody = await authCheck.json().catch(() => ({}));

    if (!authCheck.ok) {
      const errorMsg = responseBody.msg || responseBody.error || responseBody.message || 'Identity verification failed';
      console.error('VerifyToken: Auth API rejection:', errorMsg);
      
      let hint = 'Your session might be invalid. Please log out and log back in.';
      if (errorMsg.toLowerCase().includes('session') || errorMsg.toLowerCase().includes('jwt')) {
        hint = 'Your browser session is stale or expired. Please SIGNOUT and SIGNIN again.';
      }

      return res.status(401).json({ 
        error: errorMsg,
        code: 'AUTH_API_REJECTED',
        source: 'Supabase Raw API',
        hint
      });
    }

    req.user = responseBody;
    
    // Fetch role from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', responseBody.id)
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
