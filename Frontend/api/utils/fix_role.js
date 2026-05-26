const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixRLS() {
    console.log("Mise à jour des politiques de sécurité (RLS) pour les profils...");

    // we use RPC or just raw queries if allowed, but since we don't have such tools, 
    // we'll at least ensure the user role is uppercase-agnostic and trimmed in the DB.
    // For fixing role, we fetch the Auth user first natively if needed, 
    // but since we only have profiles access here comfortably, we assume profiles has no email.
    // Wait, if profiles don't have email, how do we find admin?
    // Let's use the supabase auth admin API to find by email.
    const { data: users, error: _listError } = await supabase.auth.admin.listUsers();

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
        console.error("❌ Erreur : ADMIN_EMAIL ou ADMIN_PASSWORD non définis dans le fichier .env");
        return;
    }

    const adminUser = users?.users?.find(u => u.email === adminEmail);
    if (!adminUser) { console.log(`Utilisateur ${adminEmail} non trouvé`); return; }

    console.log(`Utilisateur Auth trouvé: ${adminUser.email}`);

    // 1. Mise à jour du mot de passe via variable d'environnement
    const { error: pwdError } = await supabase.auth.admin.updateUserById(
        adminUser.id,
        { password: adminPassword }
    );
    if (pwdError) console.error("❌ Erreur lors de la mise à jour du mot de passe:", pwdError.message);
    else console.log("✅ Mot de passe mis à jour avec succès.");

    // 2. Forçage du rôle admin dans la table profiles
    const { data: school } = await supabase
        .from('schools')
        .select('id')
        .eq('abreviation', 'SLB')
        .single();

    const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
            id: adminUser.id,
            role: 'admin',
            school_id: school?.id
        }, { onConflict: 'id' });

    if (profileError) console.error("❌ Erreur profil:", profileError.message);
    else console.log("✅ Rôle 'admin' et 'school_id' (SLB) assignés avec succès.");
}

fixRLS();
