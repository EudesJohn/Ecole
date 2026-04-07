import { supabase } from '../supabase';

/**
 * Generates a sequential matricule using Supabase RPC: [0001] SLB [Year]
 */
const generateSLBId = async () => {
  try {
    const { data, error } = await supabase.rpc('get_next_matricule');
    
    if (error) {
      console.error('Error generating matricule via RPC:', error);
      throw new Error('Impossible de générer le matricule.');
    }
    
    return data;
  } catch (err) {
    console.error('generateSLBId failed:', err);
    throw err;
  }
};

export default generateSLBId;

