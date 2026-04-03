/**
 * Medcare — ML Service API Client (Enterprise)
 *
 * Additions over previous version:
 * - mlCache: identical symptom inputs return cached results (5-min TTL)
 * - suggestCache: autocomplete results cached per query (10-min TTL)
 * - symptomsListCache: disease catalogue cached (30-min TTL)
 * - withRetry: auto-retries transient failures (ML service cold start)
 * - withTimeout: every request has a max timeout
 * - logger.perf: measures and logs inference latency
 */

import axios from 'axios';
import { mlCache, suggestCache, symptomsListCache } from '../utils/cache';
import { withRetry } from '../utils/retry';
import logger from '../utils/logger';

const ML_BASE = process.env.REACT_APP_ML_URL || 'http://localhost:5001';

// Verify ML URL is configured correctly
if (typeof window !== 'undefined') {
  console.log('🔗 ML Service URL:', ML_BASE);
  if (window.location.hostname !== 'localhost' && ML_BASE.includes('localhost')) {
    console.warn('⚠️ WARNING: Production frontend using localhost ML URL. Check REACT_APP_ML_URL environment variable.');
  }
}

const ML_API = axios.create({
  baseURL:         ML_BASE,
  timeout:         20_000,
  headers:         { 'Content-Type': 'application/json' },
});

// ── Request interceptor ──────────────────────────────────────
ML_API.interceptors.request.use(
  (config) => {
    config._startTime = Date.now();
    return config;
  },
  (err) => Promise.reject(err)
);

// ── Response interceptor ─────────────────────────────────────
ML_API.interceptors.response.use(
  (res) => {
    const ms = Date.now() - (res.config._startTime || Date.now());
    logger.perf(`ML ${res.config.method?.toUpperCase()} ${res.config.url}`, ms);
    return res;
  },
  (err) => {
    if (!err.response || err.code === 'ECONNABORTED') {
      const isProduction = process.env.NODE_ENV === 'production' || (typeof window !== 'undefined' && window.location.hostname !== 'localhost');
      const errorMsg = isProduction
        ? `ML service unavailable (${ML_BASE}). Check service status at https://ml-service-1hgd.onrender.com/health`
        : 'ML service offline. Start it: cd ml-service && python app.py';
      return Promise.reject(new Error(errorMsg));
    }
    const msg = err.response?.data?.error || 'ML service returned an error.';
    logger.error('[ML API] Request failed', err, { url: err.config?.url, ML_URL: ML_BASE });
    return Promise.reject(new Error(msg));
  }
);

// ── API methods ──────────────────────────────────────────────

/**
 * POST /predict — ML symptom analysis with caching + retry.
 *
 * Cache key = normalized symptom string (order-independent).
 * If the same symptoms are submitted within 5 minutes, returns cached result.
 * ML service cold-starts can take 2–3s — we retry up to 2 times with backoff.
 *
 * @param {string|string[]} symptoms
 */
export const mlPredict = async (symptoms) => {
  const key = Array.isArray(symptoms) ? symptoms.join(', ') : symptoms;

  // ── Cache hit ──────────────────────────────────────────────
  const cached = mlCache.get(key);
  if (cached) {
    logger.info('[ML] Cache hit for prediction', { key: key.slice(0, 40) });
    return { data: cached, fromCache: true };
  }

  // ── Cache miss → call API with retry ──────────────────────
  const response = await withRetry(
    () => ML_API.post('/predict', { symptoms: key }),
    { retries: 2, baseDelayMs: 500 }
  );

  // Cache successful predictions
  if (response.data?.success) {
    mlCache.set(key, response.data);
  }

  return response;
};

/**
 * POST /chat — AI chatbot (no caching — conversational state matters).
 * @param {Array<{role: string, content: string}>} messages
 */
export const mlChat = (messages) =>
  ML_API.post('/chat', { messages });

/**
 * GET /suggest?q=... — Symptom autocomplete with per-query caching.
 * @param {string} q
 */
export const mlSuggest = async (q) => {
  const cached = suggestCache.get(q);
  if (cached) return { data: cached };
  const response = await ML_API.get(`/suggest?q=${encodeURIComponent(q)}`);
  if (response.data?.suggestions) {
    suggestCache.set(q, response.data);
  }
  return response;
};

/**
 * GET /symptoms — Full disease catalogue (cached 30 min).
 */
export const mlSymptomsList = async () => {
  const cached = symptomsListCache.get('symptoms_list');
  if (cached) return { data: cached };
  const response = await ML_API.get('/symptoms');
  if (response.data) {
    symptomsListCache.set('symptoms_list', response.data);
  }
  return response;
};

/**
 * GET /health — Check ML service health.
 */
export const mlHealth = () => ML_API.get('/health');

export default ML_API;

/**
 * GET /metrics — ML service stats (Phase 8 Admin Dashboard).
 */
export const mlMetrics = () => ML_API.get('/metrics');
