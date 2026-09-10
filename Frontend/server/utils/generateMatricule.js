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
    // Fallback si RPC fails : on sonde les matricules existants pour éviter
    // toute collision (l'ancien fallback Math.random() pouvait en générer).
    const year = new Date().getFullYear().toString().slice(-2);
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = `${String(attempt + 1).padStart(4, '0')} ${schoolAbbrev.toUpperCase()} ${year}`;
      const { data } = await supabase
        .from('students')
        .select('id')
        .eq('matricule', candidate)
        .maybeSingle();
      if (!data) return candidate;
    }
    // Dernier recours : horodatage, collision impossible en pratique.
    return `${Date.now().toString().slice(-4)} ${schoolAbbrev.toUpperCase()} ${year}`;
  }
};

module.exports = generateMatricule;
