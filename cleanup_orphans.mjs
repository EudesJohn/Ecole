import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY // Note: Admin operations require Service Role Key if not using admin context
);

// We need the Service Role Key for admin delete operations
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function cleanupOrphans() {
  console.log('--- STARTING ORPHAN CLEANUP ---');
  
  try {
    // 1. Fetch all Auth users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) throw authError;

    const authUsers = authData.users;
    console.log(`Found ${authUsers.length} users in Auth.`);

    // 2. Fetch all profiles
    const { data: profiles, error: profileError } = await supabaseAdmin.from('profiles').select('id');
    if (profileError) throw profileError;

    const profileIds = new Set(profiles.map(p => p.id));
    console.log(`Found ${profileIds.size} profiles in Database.`);

    // 3. Find Orphand
    let deletedCount = 0;
    const now = new Date();

    for (const user of authUsers) {
      if (!profileIds.has(user.id)) {
        // Skip admins (manual check safety)
        if (user.user_metadata?.role === 'admin') continue;

        // Only delete if created more than 1 hour ago (to avoid race conditions with ongoing registrations)
        const createdAt = new Date(user.created_at);
        const ageHours = (now - createdAt) / (1000 * 60 * 60);

        if (ageHours > 1) {
          console.log(`Cleaning orphan: ${user.email} (ID: ${user.id}, Age: ${ageHours.toFixed(2)}h)`);
          const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
          if (deleteError) {
            console.error(`Failed to delete ${user.email}:`, deleteError.message);
          } else {
            deletedCount++;
          }
        }
      }
    }

    console.log(`--- CLEANUP FINISHED: ${deletedCount} orphans removed ---`);
  } catch (err) {
    console.error('CRITICAL ERROR DURING CLEANUP:', err.message);
  }
}

cleanupOrphans();
