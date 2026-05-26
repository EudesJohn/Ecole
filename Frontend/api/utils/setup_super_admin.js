const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupSuperAdmin() {
    console.log("🚀 Provisioning Supreme Super Admin User...");

    const email = 'eudesjohn650@gmail.com';
    const password = 'Johnson@@50';

    try {
        const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;

        let user = usersData?.users?.find(u => u.email === email);

        if (user) {
            console.log(`Found existing user with email: ${email}. Updating password and metadata...`);
            const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
                user.id,
                { 
                    password: password,
                    user_metadata: { role: 'super_admin', prenom: 'Admin', nom: 'Suprême' }
                }
            );
            if (updateError) throw updateError;
            user = updatedUser.user;
            console.log("✅ User auth updated successfully.");
        } else {
            console.log(`User with email: ${email} not found. Creating a new one...`);
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { role: 'super_admin', prenom: 'Admin', nom: 'Suprême' }
            });
            if (createError) throw createError;
            user = newUser.user;
            console.log("✅ User auth created successfully.");
        }

        // Force super_admin role and NULL school_id in profiles
        console.log("Upserting profile...");
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: user.id,
                email: email,
                prenom: 'Admin',
                nom: 'Suprême',
                role: 'super_admin',
                school_id: null
            }, { onConflict: 'id' });

        if (profileError) throw profileError;

        console.log("🎉 Supreme Super Admin setup completed successfully!");
    } catch (err) {
        console.error("❌ Error setting up super admin:", err.message || err);
    }
}

setupSuperAdmin();
