const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the Backend directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL || 'saintlambert@gmail.com';
  const password = process.env.ADMIN_PASSWORD || 'SaintLambert';

  console.log(`Initialisation de l'administrateur : ${email}...`);

  // 1. Créer l'utilisateur dans Supabase Auth
  const { data: { user }, error: authError } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
    user_metadata: { role: 'admin' }
  });

  if (authError) {
    if (authError.message.includes('already exists') || authError.message.includes('already registered')) {
      console.log('L\'utilisateur existe déjà. Recherche de l\'ID...');

      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
      const existingUser = users.find(u => u.email === email);

      if (existingUser) {
        console.log(`Utilisateur trouvé (ID: ${existingUser.id}). Mise à jour du rôle...`);
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', existingUser.id);

        if (updateError) console.error('Erreur de mise à jour du profil:', updateError.message);
        else console.log('✅ Rôle mis à jour avec succès en "admin".');
      }
    } else {
      console.error('❌ Erreur lors de la création Auth:', authError.message);
    }
    return;
  }

  // 2. S'assurer que le profil est bien en "admin"
  // Le trigger handle_new_user() l'aura créé, mais on force le rôle admin au cas où
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', user.id);

  if (profileError) {
    console.error('Erreur lors de la mise à jour du profil:', profileError.message);
  } else {
    console.log('✅ Compte Administrateur créé avec succès !');
  }
}

createAdmin();
