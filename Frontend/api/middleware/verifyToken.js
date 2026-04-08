const { supabase, supabaseVerify } = require('../supabase');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split('Bearer ')[1];
  
  if (!token) {
    console.error('VerifyToken: No token provided in header');
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // 1. Primary Check: Use Anon Client (supabaseVerify)
    let authResult = await supabaseVerify.auth.getUser(token);
    
    // 2. Fallback Check: Use Service Role Client (supabase) if primary fails
    if (authResult.error) {
      console.warn('VerifyToken: Primary auth failed, trying fallback...', authResult.error.message);
      authResult = await supabase.auth.getUser(token);
    }
    
    const { data: { user }, error } = authResult;

    if (error || !user) {
      console.error('VerifyToken: All auth attempts failed:', error?.message || 'No user found');
      return res.status(401).json({ 
        error: error?.message || 'Invalid token',
        code: error?.code || 'AUTH_FAILURE',
        hint: 'Check if your session is still valid. Try logging out and back in.',
        diag: `Token length: ${token.length}`
      });
    }

    req.user = user;
    
    // Fetch role from profiles table
    const { data: profile, error: profileError } = await supabase
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
