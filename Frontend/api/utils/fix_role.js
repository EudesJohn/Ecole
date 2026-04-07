const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixRLS() {
    console.log("Mise à jour des politiques de sécurité (RLS) pour les profils...");

    // we use RPC or just raw queries if allowed, but since we don't have such tools, 
    // we'll at least ensure the user role is uppercase-agnostic and trimmed in the DB.
    // For fixing role, we fetch the Auth user first natively if needed, 
    // but since we only have profiles access here comfortably, we assume profiles has no email.
    // Wait, if profiles don't have email, how do we find admin?
    // Let's use the supabase auth admin API to find by email.
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    const adminUser = users?.users?.find(u => u.email === 'saintlambert@gmail.com');
    if (!adminUser) { console.log('Admin user not found'); return; }

    const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', adminUser.id)
        .single();

    if (profile) {
        console.log(`Profil trouvé (ID: ${profile.id}). Forçage du rôle 'admin' propre...`);
        const { error } = await supabase
            .from('profiles')
            .update({ role: 'admin' })
            .eq('id', profile.id);

        if (error) console.error("Erreur de mise à jour:", error.message);
        else console.log("✅ Rôle 'admin' réinitialisé proprement.");
    } else {
        console.log("Aucun profil admin à corriger via ce script.");
    }
}

fixRLS();
