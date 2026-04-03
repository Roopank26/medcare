/**
 * Medcare — Global Error Boundary (Enterprise)
 *
 * - Catches unhandled React render errors
 * - Reports to Sentry (when configured) or console
 * - User-friendly recovery UI with error ID for support
 */

import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { reportError } from '../../utils/monitoring';
import logger from '../../utils/logger';

const FallbackUI = ({ error, resetErrorBoundary, errorId }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
    <div className="max-w-md w-full text-center">
      {/* Icon */}
      <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-6 border border-red-100">
        🩺
      </div>

      <h1 className="font-display font-bold text-2xl text-gray-900 mb-3">
        Something went wrong
      </h1>
      <p className="text-gray-500 text-sm mb-2 leading-relaxed">
        The application encountered an unexpected error. Your data is safe.
      </p>

      {/* Error ID for support */}
      {errorId && (
        <p className="text-xs text-gray-400 font-mono mt-1">
          Error ID: <span className="font-semibold text-gray-600">{errorId}</span>
        </p>
      )}

      {/* Dev mode: show stack trace */}
      {process.env.NODE_ENV === 'development' && error?.message && (
        <div className="mt-4 mb-5 p-3 bg-gray-900 text-gray-100 rounded-xl text-xs text-left font-mono overflow-x-auto max-h-40">
          <p className="text-red-400 font-semibold mb-1">Error: {error.message}</p>
          {error.stack && (
            <pre className="text-gray-400 text-[10px] whitespace-pre-wrap">
              {error.stack.split('\n').slice(1, 6).join('\n')}
            </pre>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
        <button onClick={resetErrorBoundary} className="btn-primary">
          ↺ Try Again
        </button>
        <button
          onClick={() => { window.location.href = '/'; }}
          className="btn-outline"
        >
          Go to Home
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-8">
        If this keeps happening, contact support with Error ID above.
      </p>
    </div>
  </div>
);

const AppErrorBoundary = ({ children }) => {
  // Generate a unique ID for each error instance (useful for support tickets)
  const generateErrorId = () =>
    `MC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  return (
    <ErrorBoundary
      FallbackComponent={(props) => (
        <FallbackUI {...props} errorId={generateErrorId()} />
      )}
      onError={(error, info) => {
        // Log the error
        logger.error('[ErrorBoundary] Unhandled render error', error, {
          componentStack: info?.componentStack?.split('\n').slice(0, 5).join(' '),
        });
        // Send to Sentry / monitoring
        reportError(error, {
          source:          'ErrorBoundary',
          componentStack:  info?.componentStack,
        });
      }}
      onReset={() => {
        // Don't hard-reload on retry — just re-render
        // window.location.reload() was too aggressive
      }}
    >
      {children}
    </ErrorBoundary>
  );
};

export default AppErrorBoundary;
