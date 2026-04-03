/**
 * Medcare — Monitoring & Error Tracking (Console Fallback)
 *
 * Note: Sentry dependency removed for production builds.
 * Using console-based monitoring with window.__MEDCARE_MONITOR__ interface.
 */

const IS_PROD = process.env.NODE_ENV === 'production';

export const initMonitoring = async () => {
  // Initialize monitoring interface (console fallback only)
  window.__MEDCARE_MONITOR__ = {
    captureException: (error, ctx = {}) => {
      // Log to console in development
      if (!IS_PROD) {
        console.error('[Monitor] Exception:', error?.message, ctx);
      }
    },
    captureMessage: (msg, level = 'info', ctx = {}) => {
      // Log to console
      if (level === 'warning' || level === 'error') {
        console.warn(`[Monitor] ${level}: ${msg}`, ctx);
      }
    },
    addBreadcrumb: () => {
      // Breadcrumbs are no longer tracked without Sentry
    },
  };
  console.info('[Monitoring] Console fallback initialized ✓');
};

export const setMonitoringUser = () => {
  // User monitoring disabled without Sentry
};

export const clearMonitoringUser = () => {
  // User monitoring disabled without Sentry
};

export const reportError = (error) => {
  // Report to console in development/production for debugging
  if (error?.message) {
    console.error('[Monitoring]', error.message);
  }
};

export const withMonitoring = (App) => {
  // No profiler without Sentry
  return App;
};

/**
 * Wrap an async operation with simple performance timing.
 * Sentry spans removed due to package removal.
 * @param {string}            name
 * @param {() => Promise<T>}  fn
 * @returns {Promise<T>}
 */
export const measureAsync = async (name, fn) => {
  const start = performance.now();
  try {
    const result = await fn();
    const ms = Math.round(performance.now() - start);
    if (IS_PROD && ms > 2000) {
      console.warn(`[Monitoring] Slow operation: ${name} took ${ms}ms`);
    }
    return result;
  } catch (err) {
    reportError(err);
    throw err;
  }
};
