const { supabase } = require('../server');

const generateMatricule = async () => {
  try {
    const { data, error } = await supabase.rpc('get_next_matricule');
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Backend generateMatricule error:', err);
    // Fallback logic if RPC fails
    const year = new Date().getFullYear().toString().slice(-2);
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `${randomNum} SLB ${year}`;
  }
};

module.exports = generateMatricule;
