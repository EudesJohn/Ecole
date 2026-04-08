const { supabase, supabaseVerify } = require('../supabase');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split('Bearer ')[1];
  
  if (!token) {
    console.error('VerifyToken: No token provided in header');
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // CRITICAL: We use supabaseVerify (Anon Client) to validate the user JWT.
    // This is more reliable for production JWT verification than the Service Role client.
    const { data: { user }, error } = await supabaseVerify.auth.getUser(token);
    
    if (error || !user) {
      console.error('VerifyToken: Token rejected by Supabase Auth:', error?.message || 'No user found');
      return res.status(401).json({ error: error?.message || 'Invalid token' });
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
