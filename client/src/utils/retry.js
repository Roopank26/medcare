/**
 * Medcare — Retry Utility
 *
 * Provides exponential-backoff retry logic for unreliable async operations:
 * - ML service calls (may be warming up after idle)
 * - Firestore writes (transient network blips)
 *
 * Usage:
 *   import { withRetry, withTimeout } from './utils/retry';
 *
 *   // Retry up to 3 times with exponential backoff
 *   const data = await withRetry(() => mlPredict(symptoms), { retries: 3 });
 *
 *   // Fail fast if operation exceeds 10 seconds
 *   const data = await withTimeout(fetchData(), 10000);
 */

import logger from './logger';

/**
 * Default retry options.
 * @typedef {Object} RetryOptions
 * @property {number}   [retries=3]       - Max attempts (not counting the first try)
 * @property {number}   [baseDelayMs=300] - Initial delay; doubles each retry
 * @property {number}   [maxDelayMs=5000] - Cap on delay between retries
 * @property {Function} [shouldRetry]     - Return false to abort early (e.g. 4xx errors)
 */
const DEFAULTS = {
  retries:      3,
  baseDelayMs:  300,
  maxDelayMs:   5000,
  shouldRetry:  null,
};

/** Wait for `ms` milliseconds. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Execute `fn` with exponential-backoff retries.
 *
 * @param {() => Promise<T>} fn             - The async function to retry
 * @param {RetryOptions}     [options]
 * @returns {Promise<T>}
 * @throws  The last error if all retries are exhausted
 */
export const withRetry = async (fn, options = {}) => {
  const { retries, baseDelayMs, maxDelayMs, shouldRetry } = { ...DEFAULTS, ...options };
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Last attempt — don't delay, just throw
      if (attempt === retries) break;

      // Let caller decide whether to retry (e.g. skip 400 Bad Request)
      if (shouldRetry && !shouldRetry(err, attempt)) break;

      // Never retry authentication/authorization errors
      const msg = err?.message?.toLowerCase() || '';
      if (msg.includes('auth') || msg.includes('permission') || msg.includes('unauthorized')) {
        break;
      }

      // Exponential backoff with jitter
      const delay = Math.min(baseDelayMs * 2 ** attempt + Math.random() * 100, maxDelayMs);
      logger.warn(`[Retry] Attempt ${attempt + 1}/${retries + 1} failed — retrying in ${Math.round(delay)}ms`, {
        operation: fn.name || 'anonymous',
        error:     err.message,
      });
      await sleep(delay);
    }
  }

  logger.error(`[Retry] All ${retries + 1} attempts failed`, lastError);
  throw lastError;
};

/**
 * Wrap a promise with a timeout.
 * Rejects with a TimeoutError if `ms` milliseconds elapse before the promise settles.
 *
 * @param {Promise<T>} promise
 * @param {number}     ms         - Timeout in milliseconds
 * @param {string}     [label]    - Name for logging
 * @returns {Promise<T>}
 */
export const withTimeout = (promise, ms, label = 'operation') => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
};

/**
 * Retry with a timeout per attempt.
 * Useful for ML predictions: retry up to 3x but each attempt must complete in 15s.
 *
 * @param {() => Promise<T>} fn
 * @param {number}           timeoutMs  - Timeout per attempt
 * @param {RetryOptions}     [options]
 */
export const withRetryAndTimeout = (fn, timeoutMs = 15000, options = {}) =>
  withRetry(() => withTimeout(fn(), timeoutMs, fn.name || 'request'), options);
