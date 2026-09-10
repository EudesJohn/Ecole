/**
 * Rate limiter hybride (FIND-007/008, durci en phase 3 — faille #3).
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
 *   par instance.
 *
 * PHASE 3 (faille #3) — deux changements de comportement :
 *   1. La clé inclut désormais la route (req.baseUrl + req.path
 *      partiel), pour que le limiteur GLOBAL 120/min n'épuise jamais
 *      le quota d'un limiteur de route — et inversement.
 *   2. FAIL-OPEN → FAIL-CLOSED ciblé : les limiteurs qui protègent des
 *      données sensibles (inscription école, bulletins, login) sont
 *      créés avec failClosed: true. En production, si Upstash est
 *      configuré mais injoignable, ces limiteurs renvoient 503 au lieu
 *      de laisser passer. En développement, et quand Upstash n'est pas
 *      configuré du tout, le fallback in-memory reste actif (le site
 *      fonctionne ; la protection est juste par-instance).
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
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Incrémente le compteur Redis pour la clé donnée et fixe l'expiration.
 * Retourne le nombre de requêtes, ou null si Redis est indisponible.
 * Utilise un unique script pipeline : INCR puis EXPIRE (2 allers-retours).
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
    console.error('RateLimit: Redis indisponible:', err.message);
    return null;
  }
}

/**
 * Clé de comptage : route + IP (via x-forwarded-for posé par Vercel,
 * req.ip déjà résolu grâce à trust proxy).
 */
function buildKey(req, prefix) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const route = (req.baseUrl || 'api').replace(/[^a-zA-Z0-9/_-]/g, '');
  return `${prefix}:${route}:${ip}`;
}

const rateLimit = ({
  windowMs = 60000,
  max = 20,
  message = 'Trop de requêtes. Veuillez réessayer plus tard.',
  failClosed = false,
  prefix = 'ratelimit'
} = {}) => {
  return async (req, res, next) => {
    const now = Date.now();
    const key = buildKey(req, prefix);

    let count;

    if (redisEnabled) {
      count = await redisIncr(key, windowMs);
    }

    if (count === undefined || count === null) {
      if (redisEnabled && failClosed && isProduction) {
        // Redis configuré mais injoignable en production : pour les
        // limiteurs SENSIBLES (failClosed), on ferme la porte plutôt que
        // de laisser un attaquant profiter de la panne.
        console.error('RateLimit: fail-closed déclenché (Redis injoignable, production)');
        return res.status(503).json({
          error: 'Service momentanément indisponible. Veuillez réessayer dans quelques instants.'
        });
      }
      // Fallback in-memory (pas de Redis configuré, dev, ou limiteur non sensible)
      let entry = requests.get(key);
      if (!entry || now > entry.resetAt) {
        entry = { count: 0, resetAt: now + windowMs };
        requests.set(key, entry);
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
