/**
 * Medcare — In-Memory Cache with TTL
 *
 * Lightweight key-value cache for:
 * - ML prediction results (same symptoms → cached for 5 min)
 * - Symptom suggestion lists (cached 10 min)
 * - Static disease catalogue (cached 30 min)
 *
 * Why not localStorage?
 * ML results are large and TTL management would add complexity.
 * In-memory is fast, zero overhead, and resets on page refresh
 * (appropriate for medical data which should stay fresh).
 *
 * Usage:
 *   import { mlCache } from './utils/cache';
 *   const cached = mlCache.get('fever,headache');
 *   mlCache.set('fever,headache', predictionResult);
 */

class TTLCache {
  /**
   * @param {number} defaultTtlMs - Default TTL in milliseconds
   * @param {string} [name]       - Cache name for debug logging
   */
  constructor(defaultTtlMs, name = 'cache') {
    this._store   = new Map();
    this._ttl     = defaultTtlMs;
    this._name    = name;
    this._hits    = 0;
    this._misses  = 0;
  }

  /** Normalize a cache key: lowercase, trim whitespace, sort tokens */
  _normalizeKey(key) {
    if (typeof key !== 'string') return String(key);
    // For symptom strings: sort tokens so "fever, cough" === "cough, fever"
    return key
      .toLowerCase()
      .split(/,\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
      .sort()
      .join(',');
  }

  /**
   * Retrieve a cached value. Returns undefined if missing or expired.
   * @param {string} key
   * @returns {*|undefined}
   */
  get(key) {
    const normalized = this._normalizeKey(key);
    const entry      = this._store.get(normalized);
    if (!entry) { this._misses++; return undefined; }
    if (Date.now() > entry.expiresAt) {
      this._store.delete(normalized);
      this._misses++;
      return undefined;
    }
    this._hits++;
    return entry.value;
  }

  /**
   * Store a value with optional custom TTL.
   * @param {string} key
   * @param {*}      value
   * @param {number} [ttlMs] - Override default TTL for this entry
   */
  set(key, value, ttlMs) {
    const normalized = this._normalizeKey(key);
    this._store.set(normalized, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this._ttl),
      cachedAt:  Date.now(),
    });
  }

  /**
   * Check if a key exists and is not expired.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /** Remove a specific entry. */
  delete(key) {
    this._store.delete(this._normalizeKey(key));
  }

  /** Remove all expired entries (call periodically to prevent memory growth). */
  evictExpired() {
    const now = Date.now();
    let count = 0;
    for (const [k, v] of this._store) {
      if (now > v.expiresAt) { this._store.delete(k); count++; }
    }
    return count;
  }

  /** Clear entire cache. */
  clear() { this._store.clear(); }

  /** Cache stats for monitoring/debugging. */
  stats() {
    const total  = this._hits + this._misses;
    const hitRate = total ? ((this._hits / total) * 100).toFixed(1) : '0.0';
    return {
      name:     this._name,
      size:     this._store.size,
      hits:     this._hits,
      misses:   this._misses,
      hitRate:  `${hitRate}%`,
    };
  }
}

// ── Named cache instances ─────────────────────────────────────

/** Cache ML predictions. Key = normalized symptom string. TTL = 5 minutes. */
export const mlCache = new TTLCache(5 * 60 * 1000, 'ml-predictions');

/** Cache symptom list from /symptoms endpoint. TTL = 30 minutes. */
export const symptomsListCache = new TTLCache(30 * 60 * 1000, 'symptoms-list');

/** Cache autocomplete suggestions per query. TTL = 10 minutes. */
export const suggestCache = new TTLCache(10 * 60 * 1000, 'suggest');

// ── Periodic eviction (every 5 minutes) ──────────────────────
setInterval(() => {
  mlCache.evictExpired();
  symptomsListCache.evictExpired();
  suggestCache.evictExpired();
}, 5 * 60 * 1000);

/** Return stats for all caches (useful for debugging). */
export const getCacheStats = () => [
  mlCache.stats(),
  symptomsListCache.stats(),
  suggestCache.stats(),
];
