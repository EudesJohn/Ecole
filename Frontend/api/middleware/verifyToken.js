const { supabase } = require('../supabase');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split('Bearer ')[1];
  
  if (!token) {
    console.error('VerifyToken: No token provided in header');
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // Note: getUser(token) is the standard way to verify a client-side JWT on the server
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('VerifyToken: Supabase rejected token:', error?.message);
      return res.status(401).json({ error: 'Invalid token' });
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
