const { supabase } = require('../server');

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    
    // Fetch role from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    req.role = profile?.role || 'parent';
    next();
  } catch (error) {
    console.error('VerifyToken Error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = verifyToken;
