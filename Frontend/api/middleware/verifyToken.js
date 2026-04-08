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
    // Single client attempt with Service Role Key (default)
    // We pass the cleaned token explicitly.
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('VerifyToken: Final Auth rejection:', error?.message || 'No user');
      return res.status(401).json({ 
        error: error?.message || 'Invalid token',
        code: error?.code || 'AUTH_REJECTED',
        source: 'Supabase Auth Service',
        hint: 'Your session token was rejected. Try logging out and back in.'
      });
    }

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
