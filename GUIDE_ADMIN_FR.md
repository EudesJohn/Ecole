# Guide Administrateur - Gestion des Écoles et des Mots de Passe

## Table des Matières
1. [Suppression d'une école](#suppression-dune-école)
2. [Réinitialisation du mot de passe administrateur](#réinitialisation-du-mot-de-passe-administrateur)
3. [Récupération de mot de passe oublié](#récupération-de-mot-de-passe-oublié)

---

## Suppression d'une école

### ⚠️ AVERTISSEMENT IMPORTANT

La suppression d'une école est **IRRÉVERSIBLE**. Toutes les données associées à l'école seront définitivement supprimées, y compris :
- Tous les élèves, professeurs et parents
- Toutes les notes, absences et plans de cours
- Toutes les configurations de l'école
- Tous les comptes utilisateurs

**Faites une sauvegarde de la base de données avant de procéder !**

---

### Méthode 1 : Utiliser le script spécifique pour SLB

Le fichier `delete_slb_school.sql` est pré-configuré pour supprimer l'école Saint Lambert (SLB).

#### Étapes :

1. **Simulation (dry run)** :
   ```bash
   # Exécutez le script tel quel pour voir ce qui sera supprimé
   psql -U postgres -d votre_base_de_donnees -f delete_slb_school.sql
   ```
   
   Cela affichera :
   ```
   School ID: 123e4567-e89b-12d3-a456-426614174000
     - Grades: 456 records
     - Absences: 123 records
     - Cahier de texte: 78 records
     - Matieres (subjects): 20 records
     - Students: 150 records
     - Classes: 8 records
     - Profiles (users): 45 records
   ```

2. **Suppression réelle** :
   - Ouvrez le fichier `delete_slb_school.sql`
   - Décommentez toutes les lignes `DELETE FROM` (supprimez les `--` au début)
   - Supprimez la ligne `ROLLBACK;` à la fin
   - Sauvegardez le fichier
   - Exécutez à nouveau :
     ```bash
     psql -U postgres -d votre_base_de_donnees -f delete_slb_school.sql
     ```

---

### Méthode 2 : Suppression manuelle table par table

Si vous préférez plus de contrôle, utilisez ces commandes SQL dans l'ordre :

```sql
BEGIN;

-- 1. Supprimer les données enfants d'abord (à cause des contraintes de clés étrangères)
DELETE FROM grades WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SLB');
DELETE FROM absences WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SLB');
DELETE FROM cahier_texte WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SLB');

-- 2. Supprimer les matières
DELETE FROM matieres WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SLB');

-- 3. Supprimer les élèves
DELETE FROM students WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SLB');

-- 4. Supprimer les classes
DELETE FROM classes WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SLB');

-- 5. Supprimer la configuration
DELETE FROM school_config_mt WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SLB');

-- 6. Supprimer les profils utilisateurs (comptes admin, professeurs, parents)
DELETE FROM profiles WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SLB');

-- 7. Enfin, supprimer l'école elle-même
DELETE FROM schools WHERE abreviation = 'SLB';

COMMIT;
```

---

### Vérification après suppression

Pour vérifier que l'école a bien été supprimée :

```sql
-- Vérifier que l'école n'existe plus
SELECT * FROM schools WHERE abreviation = 'SLB';
-- Devrait retourner 0 lignes

-- Vérifier qu'aucune donnée n'est restée
SELECT COUNT(*) FROM grades WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SLB');
-- Devrait retourner 0
```

---

## Réinitialisation du mot de passe administrateur

Les administrateurs peuvent maintenant changer leur propre mot de passe directement depuis l'interface.

### Utilisation du composant AdminPasswordReset

1. **Intégration** :
   Importez le composant dans votre tableau de bord admin :
   ```jsx
   import AdminPasswordReset from '../components/AdminPasswordReset';
   
   // Dans votre composant
   <AdminPasswordReset />
   ```

2. **Fonctionnalité** :
   - L'administrateur entre son mot de passe actuel
   - Il entre et confirme le nouveau mot de passe
   - Le mot de passe doit avoir au moins 6 caractères
   - Le système vérifie que le mot de passe actuel est correct
   - Le mot de passe est mis à jour dans la base de données

3. **Endpoint API** :
   - URL: `POST /api/admin/reset-own-password`
   - Body:
     ```json
     {
       "currentPassword": "ancienmotdepasse",
       "newPassword": "nouveaumotdepasse"
     }
     ```
   - Headers: `Authorization: Bearer <token>`

---

## Récupération de mot de passe oublié

Les administrateurs qui ont oublié leur mot de passe peuvent le réinitialiser via leur email.

### Utilisation du composant PasswordRecovery

1. **Intégration** :
   Ajoutez le composant à votre page de connexion ou créez une page dédiée :
   ```jsx
   import PasswordRecovery from '../components/PasswordRecovery';
   
   // Dans votre composant
   <PasswordRecovery />
   ```

2. **Processus** :
   - L'administrateur entre son adresse email
   - Le système envoie un email avec un lien de réinitialisation
   - Le lien redirige vers une page où il peut définir un nouveau mot de passe
   - Pour des raisons de sécurité, le système ne révèle pas si l'email existe

3. **Endpoint API** :
   - URL: `POST /api/admin/recover-password`
   - Body:
     ```json
     {
       "email": "admin@ecole.com"
     }
     ```
   - Réponse réussie:
     ```json
     {
       "success": true,
       "message": "Si cette adresse email existe dans notre système, un lien de récupération a été envoyé."
     }
     ```

4. **Configuration requise** :
   - Configurez l'URL de redirection dans le backend (`Frontend/api/routes/admin.js`)
   - Actuellement configuré sur: `http://localhost:5173/reset-password`
   - Changez-le pour correspondre à votre environnement de production

---

## Dépannage

### Erreur lors de la suppression d'une école

**Problème** : `ERROR: update or delete on table "X" violates foreign key constraint`

**Solution** : 
- Vérifiez que vous supprimez les tables dans le bon ordre (enfants d'abord, puis parents)
- Utilisez le script fourni qui gère correctement l'ordre de suppression

### L'email de récupération n'arrive pas

**Vérifications** :
1. Vérifiez que l'email est correctement orthographié
2. Vérifiez les spams/courrier indésirable
3. Assurez-vous que Supabase est correctement configuré pour envoyer des emails
4. Vérifiez que l'URL de redirection est correcte dans le backend

### Le mot de passe actuel est refusé

**Solutions** :
- Vérifiez que vous utilisez le bon mot de passe
- Assurez-vous qu'il n'y a pas d'espaces avant ou après
- La vérification est sensible à la casse (majuscules/minuscules)

---

## Sécurité

### Bonnes pratiques pour les mots de passe

1. **Complexité** : Utilisez des mots de passe d'au moins 8 caractères avec :
   - Majuscules et minuscules
   - Chiffres
   - Caractères spéciaux

2. **Rotation** : Changez les mots de passe administrateur tous les 3-6 mois

3. **Confidentialité** : Ne partagez jamais les mots de passe par email ou messagerie non sécurisée

4. **Stockage** : Le système utilise le chiffrement bcrypt via Supabase Auth

---

## Support

Pour toute assistance supplémentaire :
- Consultez la documentation technique
- Contactez l'administrateur système
- Ouvrez un ticket de support avec les détails de l'erreur

---

*Dernière mise à jour : 27 mai 2026*
