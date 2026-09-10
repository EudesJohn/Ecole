/**
 * Rate limiter hybride (FIND-007/008).
 *
 * Mode 1 — DURABLE (production) :
 *   Si UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN sont définis,
 *   les compteurs sont stockés dans Upstash Redis (HTTP/REST, sans
 *   dépendance npm). Toutes les instances serverless partagent le même
 *   compteur → protection réelle contre l'énumération et le brute-force.
 *
 * Mode 2 — IN-MEMORY (fallback automatique) :
 *   Sans variables Upstash, on retombe sur le comportement historique
 *   (Map en mémoire). Suffisant en local ; sur Vercel, le compteur est
 *   par instance. AUCUNE requête n'échoue si Redis est injoignable :
 *   on laisse passer (disponibilité > restriction).
 */
const requests = new Map();

// Nettoyage périodique toutes les 60s pour éviter les fuites mémoire (mode local)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requests) {
    if (now > entry.resetAt) requests.delete(key);
  }
}, 60000).unref?.();

const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const redisEnabled = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

/**
 * Incrémente le compteur Redis pour la clé donnée et fixe l'expiration.
 * Retourne le nombre de requêtes, ou null si Redis est indisponible.
 */
async function redisIncr(key, windowMs) {
  try {
    const headers = { Authorization: `Bearer ${UPSTASH_TOKEN}` };
    const incrRes = await fetch(`${UPSTASH_URL}/incr/${encodeURIComponent(key)}`, { headers });
    if (!incrRes.ok) return null;
    const incrData = await incrRes.json();
    const count = parseInt(incrData.result, 10);
    if (Number.isNaN(count)) return null;

    if (count === 1) {
      const expireSeconds = Math.ceil(windowMs / 1000);
      await fetch(`${UPSTASH_URL}/expire/${encodeURIComponent(key)}/${expireSeconds}`, { headers });
    }
    return count;
  } catch (err) {
    console.error('RateLimit: Redis indisponible, bascule en mode tolérant:', err.message);
    return null; // fail-open : on ne bloque jamais le trafic légitime
  }
}

const rateLimit = ({ windowMs = 60000, max = 20, message = 'Trop de requêtes. Veuillez réessayer plus tard.' } = {}) => {
  return async (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();

    let count;

    if (redisEnabled) {
      count = await redisIncr(`ratelimit:${req.baseUrl || 'api'}:${ip}`, windowMs);
    }

    if (count === undefined || count === null) {
      // Fallback in-memory (pas de Redis configuré ou Redis injoignable)
      let entry = requests.get(ip);
      if (!entry || now > entry.resetAt) {
        entry = { count: 0, resetAt: now + windowMs };
        requests.set(ip, entry);
      }
      entry.count++;
      count = entry.count;
      res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));
    }

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));

    if (count > max) {
      return res.status(429).json({ error: message });
    }

    next();
  };
};

module.exports = rateLimit;
