/**
 * Simple in-memory rate limiter middleware.
 * Limite le nombre de requêtes par IP sur une fenêtre de temps donnée.
 */
const requests = new Map();

// Nettoyage périodique toutes les 60s pour éviter les fuites mémoire
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requests) {
    if (now > entry.resetAt) requests.delete(key);
  }
}, 60000);

const rateLimit = ({ windowMs = 60000, max = 20, message = 'Trop de requêtes. Veuillez réessayer plus tard.' } = {}) => {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    let entry = requests.get(ip);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      requests.set(ip, entry);
    }

    entry.count++;

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      return res.status(429).json({ error: message });
    }

    next();
  };
};

module.exports = rateLimit;
