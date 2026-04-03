/**
 * Medcare — Structured Logger
 *
 * Environment-aware logging utility:
 * - Development: full colored console output with context
 * - Production:  errors only; info/warn silenced to reduce noise
 *
 * Usage:
 *   import logger from './utils/logger';
 *   logger.info('User signed in', { uid, role });
 *   logger.warn('ML service slow', { latencyMs });
 *   logger.error('Firestore write failed', error, { collection: 'patients' });
 *   logger.action('symptom_analyzed', { disease, confidence });
 */

const IS_DEV  = process.env.NODE_ENV === 'development';
const IS_PROD = process.env.NODE_ENV === 'production';

/** Format context object as a readable string for console output */
const ctxStr = (ctx) => (ctx && Object.keys(ctx).length ? ` ${JSON.stringify(ctx)}` : '');

/** ISO timestamp for log entries */
const ts = () => new Date().toISOString().split('.')[0].replace('T', ' ');

/** In-memory ring buffer of recent log entries (last 50) for debugging */
const _logBuffer = [];
const MAX_BUFFER = 50;

const _push = (entry) => {
  _logBuffer.push({ ...entry, timestamp: new Date().toISOString() });
  if (_logBuffer.length > MAX_BUFFER) _logBuffer.shift();
};

const logger = {
  /**
   * Informational log — dev only.
   * @param {string} message
   * @param {object} [ctx] - Additional context
   */
  info(message, ctx = {}) {
    _push({ level: 'info', message, ctx });
    if (IS_DEV) {
      console.log(`%c[${ts()}] ℹ INFO%c  ${message}${ctxStr(ctx)}`,
        'color:#2E86DE;font-weight:bold', 'color:inherit');
    }
  },

  /**
   * Warning log — dev + prod (silently buffered in prod).
   * @param {string} message
   * @param {object} [ctx]
   */
  warn(message, ctx = {}) {
    _push({ level: 'warn', message, ctx });
    if (IS_DEV) {
      console.warn(`%c[${ts()}] ⚠ WARN%c  ${message}${ctxStr(ctx)}`,
        'color:#B45309;font-weight:bold', 'color:inherit');
    }
    // In production, warnings are sent to monitoring if configured
    if (IS_PROD && window.__MEDCARE_MONITOR__) {
      window.__MEDCARE_MONITOR__.captureMessage(message, 'warning', ctx);
    }
  },

  /**
   * Error log — always logged; sends to monitoring in production.
   * @param {string}         message
   * @param {Error|null}     [error]  - The actual error object
   * @param {object}         [ctx]    - Additional context
   */
  error(message, error = null, ctx = {}) {
    _push({ level: 'error', message, error: error?.message, ctx });
    if (IS_DEV) {
      console.group(`%c[${ts()}] 🚨 ERROR  ${message}`, 'color:#B91C1C;font-weight:bold');
      if (error) console.error(error);
      if (Object.keys(ctx).length) console.info('Context:', ctx);
      console.groupEnd();
    } else {
      // Always log errors in production (console.error is minimal noise)
      console.error(`[Medcare] ${message}`, error?.message || '');
    }
    // Send to monitoring
    if (window.__MEDCARE_MONITOR__) {
      window.__MEDCARE_MONITOR__.captureException(error || new Error(message), ctx);
    }
  },

  /**
   * User action log — tracks feature usage for analytics.
   * @param {string} action  - e.g. 'symptom_analyzed', 'report_uploaded'
   * @param {object} [data]  - Event payload
   */
  action(action, data = {}) {
    _push({ level: 'action', action, data });
    if (IS_DEV) {
      console.log(`%c[${ts()}] 📊 ACTION  ${action}${ctxStr(data)}`,
        'color:#7C3AED;font-weight:bold', 'color:inherit');
    }
    // Send to analytics if configured
    if (window.__MEDCARE_ANALYTICS__) {
      window.__MEDCARE_ANALYTICS__.track(action, data);
    }
  },

  /**
   * Performance timing log.
   * @param {string} operation
   * @param {number} ms
   */
  perf(operation, ms) {
    _push({ level: 'perf', operation, ms });
    if (IS_DEV) {
      const color = ms > 2000 ? '#B91C1C' : ms > 500 ? '#B45309' : '#20B05A';
      console.log(`%c[${ts()}] ⚡ PERF  ${operation}: ${ms}ms`, `color:${color};font-weight:bold`);
    }
    if (IS_PROD && ms > 3000 && window.__MEDCARE_MONITOR__) {
      window.__MEDCARE_MONITOR__.captureMessage(`Slow operation: ${operation}`, 'warning', { ms });
    }
  },

  /** Return a copy of the recent log buffer (for debugging). */
  getBuffer: () => [..._logBuffer],

  /** Clear the log buffer. */
  clearBuffer: () => { _logBuffer.length = 0; },
};

export default logger;
