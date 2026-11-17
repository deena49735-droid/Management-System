const { ipKeyGenerator } = require('express-rate-limit');

/**
 * Login Rate Limiter & Failed Attempt Tracker
 *
 * Implements two-tiered failed-login protection:
 * 1. Account-level protection: Blocks an account identifier after ACCOUNT_MAX_ATTEMPTS
 *    consecutive failed attempts within WINDOW_MS (15 minutes).
 *    Resets to 0 immediately upon a successful authentication.
 * 2. IP-level abuse protection: Blocks an IP address after IP_MAX_ATTEMPTS
 *    failed attempts within WINDOW_MS across any identifiers, preventing
 *    credential stuffing / email-rotation attacks.
 *
 * Successful logins never increment counters and never block legitimate users.
 */

const ACCOUNT_MAX_ATTEMPTS = 5;    // Max consecutive failed attempts per account
const IP_MAX_ATTEMPTS = 20;        // Max failed attempts per IP across accounts
const WINDOW_MS = 15 * 60 * 1000;  // 15-minute cooldown window

// In-memory stores
const accountFailures = new Map();
const ipFailures = new Map();

/**
 * Extract normalized client IP key
 * @param {import('express').Request} req
 * @returns {string}
 */
const getClientIp = (req) => {
  if (!req) return '127.0.0.1';
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    const firstIp = forwarded.split(',')[0].trim();
    if (firstIp) {
      try {
        return ipKeyGenerator(firstIp);
      } catch {
        return firstIp;
      }
    }
  }
  const rawIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  try {
    return ipKeyGenerator(rawIp);
  } catch {
    return rawIp;
  }
};

/**
 * Periodic cleanup of expired entries
 */
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of accountFailures.entries()) {
    if (record.resetTime <= now) {
      accountFailures.delete(key);
    }
  }
  for (const [key, record] of ipFailures.entries()) {
    if (record.resetTime <= now) {
      ipFailures.delete(key);
    }
  }
}, 5 * 60 * 1000);

if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Middleware: Check if the IP or account is currently in cooldown lockout
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const middleware = (req, res, next) => {
  const clientIp = getClientIp(req);
  const now = Date.now();

  // 1. Check IP-level abuse lockout
  const ipRecord = ipFailures.get(clientIp);
  if (ipRecord && ipRecord.count >= IP_MAX_ATTEMPTS) {
    if (ipRecord.resetTime > now) {
      const retryAfterSeconds = Math.max(1, Math.ceil((ipRecord.resetTime - now) / 1000));
      const remainingMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        message: `Too many login attempts. Please try again after ${remainingMinutes} ${remainingMinutes === 1 ? 'minute' : 'minutes'}.`,
        retryAfter: retryAfterSeconds,
      });
    } else {
      ipFailures.delete(clientIp);
    }
  }

  // 2. Check Account-level failed attempts lockout
  const rawIdentifier = req.body?.email || req.body?.username;
  const cleanIdentifier = typeof rawIdentifier === 'string'
    ? rawIdentifier.trim().toLowerCase()
    : null;

  if (cleanIdentifier) {
    const accountRecord = accountFailures.get(cleanIdentifier);
    if (accountRecord && accountRecord.count >= ACCOUNT_MAX_ATTEMPTS) {
      if (accountRecord.resetTime > now) {
        const retryAfterSeconds = Math.max(1, Math.ceil((accountRecord.resetTime - now) / 1000));
        const remainingMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
        res.set('Retry-After', String(retryAfterSeconds));
        return res.status(429).json({
          success: false,
          message: `Too many login attempts. Please try again after ${remainingMinutes} ${remainingMinutes === 1 ? 'minute' : 'minutes'}.`,
          retryAfter: retryAfterSeconds,
        });
      } else {
        accountFailures.delete(cleanIdentifier);
      }
    }
  }

  next();
};

/**
 * Record a failed authentication attempt (invalid password, unknown account, inactive account)
 * @param {string|null} identifier - Account email or username
 * @param {import('express').Request} req - Express request
 */
const recordFailure = (identifier, req) => {
  const now = Date.now();
  const clientIp = getClientIp(req);

  // 1. Account-level tracking
  if (identifier && typeof identifier === 'string') {
    const cleanId = identifier.trim().toLowerCase();
    const existing = accountFailures.get(cleanId);
    if (!existing || existing.resetTime <= now) {
      accountFailures.set(cleanId, {
        count: 1,
        resetTime: now + WINDOW_MS,
      });
    } else {
      existing.count += 1;
      if (existing.count === ACCOUNT_MAX_ATTEMPTS) {
        existing.resetTime = now + WINDOW_MS;
      }
    }
  }

  // 2. IP-level tracking
  if (clientIp) {
    const existingIp = ipFailures.get(clientIp);
    if (!existingIp || existingIp.resetTime <= now) {
      ipFailures.set(clientIp, {
        count: 1,
        resetTime: now + WINDOW_MS,
      });
    } else {
      existingIp.count += 1;
      if (existingIp.count === IP_MAX_ATTEMPTS) {
        existingIp.resetTime = now + WINDOW_MS;
      }
    }
  }
};

/**
 * Record a successful login - resets the account's failed attempt counter to 0
 * @param {string} identifier - Account email or username
 * @param {import('express').Request} req - Express request
 */
const recordSuccess = (identifier, req) => {
  if (identifier && typeof identifier === 'string') {
    const cleanId = identifier.trim().toLowerCase();
    accountFailures.delete(cleanId);
  }
};

/**
 * Check failure count for an account (for inspection and tests)
 * @param {string} identifier
 * @returns {number}
 */
const getAccountFailureCount = (identifier) => {
  if (!identifier) return 0;
  const cleanId = identifier.trim().toLowerCase();
  const record = accountFailures.get(cleanId);
  if (!record || record.resetTime <= Date.now()) return 0;
  return record.count;
};

/**
 * Check failure count for an IP (for inspection and tests)
 * @param {string} ip
 * @returns {number}
 */
const getIpFailureCount = (ip) => {
  if (!ip) return 0;
  let key = ip;
  try {
    key = ipKeyGenerator(ip);
  } catch {
    key = ip;
  }
  const record = ipFailures.get(key);
  if (!record || record.resetTime <= Date.now()) return 0;
  return record.count;
};

/**
 * Reset all failure counters (for tests)
 */
const resetAll = () => {
  accountFailures.clear();
  ipFailures.clear();
};

module.exports = {
  middleware,
  recordFailure,
  recordSuccess,
  getAccountFailureCount,
  getIpFailureCount,
  resetAll,
  ACCOUNT_MAX_ATTEMPTS,
  IP_MAX_ATTEMPTS,
  WINDOW_MS,
  getClientIp,
};
