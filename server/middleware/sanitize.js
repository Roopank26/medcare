/**
 * Medcare — Input Sanitization Middleware (Phase 1)
 */
'use strict';

const sanitizeStr = (v, maxLen = 2000) => {
  if (typeof v !== 'string') return v;
  // Strip HTML tags, null bytes, and excess whitespace
  return v
    .replace(/<[^>]*>/g, '')
    .replace(/\0/g, '')
    .trim()
    .slice(0, maxLen);
};

const sanitizeDeep = (obj, depth = 0) => {
  if (depth > 5) return obj;
  if (typeof obj === 'string') return sanitizeStr(obj);
  if (Array.isArray(obj)) return obj.map((v) => sanitizeDeep(v, depth + 1));
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = sanitizeDeep(v, depth + 1);
    }
    return out;
  }
  return obj;
};

const sanitizeBody = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeDeep(req.body);
  }
  next();
};

module.exports = { sanitizeBody };
