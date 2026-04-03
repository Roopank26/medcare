/**
 * Medcare — Monitoring & Error Tracking (Phase 5)
 *
 * Additions:
 * - Sentry performance transactions via startTransaction
 * - measureAsync wraps async operations in Sentry spans
 * - breadcrumb() helper for manual tracing
 * - window.__MEDCARE_MONITOR__ exposed for logger integration
 */

const SENTRY_DSN   = process.env.REACT_APP_SENTRY_DSN;
const IS_PROD      = process.env.NODE_ENV === 'production';
const APP_VERSION  = process.env.REACT_APP_VERSION || '4.0.0';

let _Sentry = null;

export const initMonitoring = async () => {
  if (SENTRY_DSN) {
    try {
      const SentryModule = await import('@sentry/react').catch(() => null);
      if (SentryModule) {
        SentryModule.init({
          dsn:         SENTRY_DSN,
          environment: IS_PROD ? 'production' : 'development',
          release:     `medcare@${APP_VERSION}`,
          enabled:     IS_PROD,
          tracesSampleRate: IS_PROD ? 0.2 : 1.0,
          // Attach user context automatically
          initialScope: {},
          beforeSend(event) {
            // Drop noisy network/Firebase errors in production
            const val = event.exception?.values?.[0]?.value || '';
            if (val.includes('Network Error'))   return null;
            if (val.includes('FirebaseError'))   return null;
            if (val.includes('auth/'))           return null;
            return event;
          },
        });
        _Sentry = SentryModule;
        console.info('[Monitoring] Sentry initialized ✓');
      }
    } catch {
      console.info('[Monitoring] Sentry unavailable, using console fallback');
    }
  }

  // Expose monitor interface for logger.js
  window.__MEDCARE_MONITOR__ = {
    captureException: (error, ctx = {}) => {
      if (_Sentry) {
        _Sentry.withScope((scope) => {
          Object.entries(ctx).forEach(([k, v]) => scope.setExtra(k, v));
          _Sentry.captureException(error);
        });
      }
    },
    captureMessage: (msg, level = 'info', ctx = {}) => {
      if (_Sentry) _Sentry.captureMessage(msg, level);
      // In dev always log warnings/errors
      if (!IS_PROD && (level === 'warning' || level === 'error')) {
        console.warn(`[Monitor] ${level}: ${msg}`, ctx);
      }
    },
    addBreadcrumb: (crumb) => {
      if (_Sentry) _Sentry.addBreadcrumb(crumb);
    },
  };
};

export const setMonitoringUser = (user) => {
  if (_Sentry && user) {
    _Sentry.setUser({ id: user.uid, email: user.email, role: user.role });
  }
  // Always add a breadcrumb for audit trail
  window.__MEDCARE_MONITOR__?.addBreadcrumb?.({
    category: 'auth',
    message:  `User login: role=${user?.role}`,
    level:    'info',
  });
};

export const clearMonitoringUser = () => {
  if (_Sentry) _Sentry.setUser(null);
};

export const reportError = (error, ctx = {}) => {
  if (_Sentry) {
    _Sentry.withScope((scope) => {
      Object.entries(ctx).forEach(([k, v]) => scope.setExtra(k, v));
      _Sentry.captureException(error);
    });
  } else if (IS_PROD) {
    console.error('[Monitoring]', error?.message, ctx);
  }
};

export const withMonitoring = (App) => {
  if (_Sentry?.withProfiler) return _Sentry.withProfiler(App, { name: 'MedcareApp' });
  return App;
};

/**
 * Wrap an async operation in a Sentry performance span.
 * Falls back to plain timing if Sentry is unavailable.
 * @param {string}            name
 * @param {() => Promise<T>}  fn
 * @returns {Promise<T>}
 */
export const measureAsync = async (name, fn) => {
  const start = performance.now();
  const transaction = _Sentry?.startTransaction?.({ name, op: 'task' });
  try {
    const result = await fn();
    const ms = Math.round(performance.now() - start);
    transaction?.setStatus('ok');
    if (IS_PROD && _Sentry && ms > 2000) {
      _Sentry.captureMessage(`Slow operation: ${name} took ${ms}ms`, 'warning');
    }
    return result;
  } catch (err) {
    transaction?.setStatus('internal_error');
    reportError(err, { operation: name });
    throw err;
  } finally {
    transaction?.finish();
  }
};
