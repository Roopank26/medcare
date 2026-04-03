/**
 * Medcare — Application Entry Point
 *
 * Responsibilities:
 * 1. Initialize monitoring (Sentry / console fallback) before React mounts
 * 2. Mount the React application
 * 3. Flush analytics on page unload
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { initMonitoring } from './utils/monitoring';
import analytics from './utils/analytics';

// ── Initialize monitoring BEFORE React renders ────────────────
// This ensures any errors during startup are captured.
initMonitoring().then(() => {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});

// ── Flush analytics on page close / navigate away ─────────────
window.addEventListener('beforeunload', () => {
  analytics.flush();
});

// ── Web Vitals (optional performance reporting) ────────────────
// Uncomment if you want Core Web Vitals reporting:
// import { getCLS, getFID, getLCP } from 'web-vitals';
// getCLS(console.log); getFID(console.log); getLCP(console.log);
