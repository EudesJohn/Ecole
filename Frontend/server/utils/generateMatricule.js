const { supabase } = require('../supabase');

const generateMatricule = async (schoolId, schoolAbbrev = 'SLB') => {
  try {
    if (!schoolId) {
      const { data, error } = await supabase.rpc('get_next_matricule');
      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase.rpc('get_next_matricule_for_school', { p_school_id: schoolId });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Backend generateMatricule error:', err);
    // Fallback logic if RPC fails
    const year = new Date().getFullYear().toString().slice(-2);
    const randomNum = Math.floor(1000 + Math.random() * 9000).toString().padStart(4, '0');
    return `${randomNum} ${schoolAbbrev.toUpperCase()} ${year}`;
  }
};

module.exports = generateMatricule;
