import { supabase } from '../supabase';

export const getAccessToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};
