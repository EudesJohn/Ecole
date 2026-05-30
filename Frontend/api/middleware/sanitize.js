/**
 * Sanitization helpers pour prévenir XSS et injection.
 * Nettoie les chaînes et les objets de toute balise HTML/script.
 */

// Supprime les balises HTML/XML d'une chaîne
const stripTags = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '').trim();
};

// Nettoie un email
const sanitizeEmail = (email) => {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '');
};

// Validation email basique
const isValidEmail = (email) => {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Applique le stripTags à toutes les propriétés string d'un objet
const sanitizeObject = (obj, fields) => {
  const sanitized = { ...obj };
  for (const field of fields) {
    if (typeof sanitized[field] === 'string') {
      sanitized[field] = stripTags(sanitized[field]);
    }
  }
  return sanitized;
};

module.exports = { stripTags, sanitizeEmail, isValidEmail, sanitizeObject };
