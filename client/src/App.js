/**
 * Medcare — App Root (Enterprise)
 *
 * - React.lazy route-level code splitting
 * - react-hot-toast global notification container
 * - react-helmet-async for SEO meta management
 * - AppErrorBoundary for error recovery
 * - Network status banner (offline detection)
 * - Analytics page-view tracking
 */

import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { HelmetProvider } from 'react-helmet-async';

import { AuthProvider, useAuth } from './context/AuthContext';
import AppErrorBoundary from './components/shared/ErrorBoundary';
import PrivateRoute     from './components/PrivateRoute';
import useNetworkStatus from './hooks/useNetworkStatus';
import './index.css';

// ── Lazy-loaded routes (code splitting) ──────────────────────
const Home             = lazy(() => import('./pages/Home'));
const Login            = lazy(() => import('./pages/Login'));
const Register         = lazy(() => import('./pages/Register'));
const PatientDashboard = lazy(() => import('./pages/PatientDashboard'));
const DoctorDashboard  = lazy(() => import('./pages/DoctorDashboard'));
const NotFound         = lazy(() => import('./pages/NotFound'));

// ── Full-screen loader shown during lazy chunk loading ────────
const PageLoader = () => (
  <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
    <div className="relative">
      <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white font-display font-bold text-2xl shadow-lg animate-pulse-ring">
        M
      </div>
      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-secondary rounded-full border-2 border-white" />
    </div>
    <div className="text-center">
      <p className="text-gray-600 font-semibold text-sm">Medcare</p>
      <p className="text-gray-400 text-xs mt-0.5">Loading…</p>
    </div>
    <div className="flex gap-1.5 mt-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 bg-primary rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  </div>
);

// ── Root redirect — waits for Firebase auth to resolve ────────
const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user)   return <Home />;
  return (
    <Navigate
      to={user.role === 'doctor' ? '/doctor-dashboard' : '/patient-dashboard'}
      replace
    />
  );
};

// ── App shell with network status ─────────────────────────────
const AppShell = () => {
  const { OfflineBanner } = useNetworkStatus();

  return (
    <>
      <OfflineBanner />
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"         element={<RootRedirect />} />
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route
              path="/patient-dashboard"
              element={
                <PrivateRoute role="patient">
                  <PatientDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/doctor-dashboard"
              element={
                <PrivateRoute role="doctor">
                  <DoctorDashboard />
                </PrivateRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Router>
    </>
  );
};

const App = () => (
  <AppErrorBoundary>
    <HelmetProvider>
      <AuthProvider>
        {/* Global toast notifications */}
        <Toaster
          position="top-right"
          gutter={10}
          containerStyle={{ top: 24, right: 24 }}
          toastOptions={{ duration: 4000 }}
        />
        <AppShell />
      </AuthProvider>
    </HelmetProvider>
  </AppErrorBoundary>
);

export default App;
