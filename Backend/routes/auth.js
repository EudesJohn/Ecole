const express = require('express');
const { supabase } = require('../server');
const router = express.Router();

router.post('/login', async (req, res) => {
  const { access_token } = req.body;
  try {
    const { data: { user }, error } = await supabase.auth.getUser(access_token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    res.json({ token: access_token, uid: user.id, email: user.email });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
