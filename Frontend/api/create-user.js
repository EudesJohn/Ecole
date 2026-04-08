import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // CORS Headers si besoin
    res.setHeader('Access-Control-Allow-Origin', '*'); // Pour le développement. En prod, utilisez l'URL de votre frontend.
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); // Méthodes autorisées
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // Headers autorisés

    // Réponse pour la requête de pré-vérification (preflight)
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

    try {
        // Utilisation obligatoire de la clé SERVICE_ROLE pour l'API Admin de Supabase
        const supabaseAdmin = createClient(
            process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { email, password, prenom, nom, role } = req.body;

        // Création via l'API Admin (Ne déconnecte PAS l'administrateur en cours)
        // Le trigger on_auth_user_created s'occupera d'insérer dans la table "profiles"
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { prenom, nom, role: role || 'teacher' }
        });

        if (error) throw error;
        return res.status(200).json({ success: true, user: data.user, message: 'Utilisateur créé avec succès' });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}