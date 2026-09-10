/**
 * Helper centralisé pour les erreurs serveur (FIND-009).
 * - Log complet côté serveur (visible dans les logs Vercel)
 * - Message générique côté client (aucune fuite d'infos DB/Supabase)
 *
 * Usage dans les catch :
 *   } catch (error) {
 *     return safeError(res, error, 'admin/students');
 *   }
 */
const safeError = (res, error, context = '') => {
  console.error(`[API]${context ? ` ${context}:` : ''}`, error?.message || error);
  // Ne pas divulguer error.message au client : il peut contenir des
  // détails Postgres (contraintes, tables, politiques RLS).
  return res.status(500).json({
    error: 'Une erreur interne est survenue. Veuillez réessayer.'
  });
};

module.exports = safeError;
