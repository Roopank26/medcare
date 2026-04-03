/**
 * Medcare — Auth Context (Enterprise)
 *
 * Additions over previous version:
 * - setMonitoringUser / clearMonitoringUser on login/logout
 * - analytics.init / analytics.reset on login/logout
 * - logger calls for audit trail
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  subscribeToAuthChanges,
  registerWithEmail,
  loginWithEmail,
  logoutUser,
  resetPassword,
} from '../firebase/auth';
import { getUserProfile } from '../firebase/firestore';
import { setMonitoringUser, clearMonitoringUser } from '../utils/monitoring';
import analytics, { EVENTS } from '../utils/analytics';
import logger from '../utils/logger';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user,      setUser]      = useState(null);
  const [fireUser,  setFireUser]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [authError, setAuthError] = useState('');

  // ── Auth state listener ─────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeToAuthChanges(async (fbUser) => {
      try {
        if (fbUser) {
          const profile = await getUserProfile(fbUser.uid);
          if (profile) {
            const merged = {
              uid:   fbUser.uid,
              email: fbUser.email,
              name:  profile.name || fbUser.displayName || fbUser.email,
              role:  profile.role,
              ...profile,
            };
            setFireUser(fbUser);
            setUser(merged);
            // Attach user context to monitoring + analytics
            setMonitoringUser({ uid: fbUser.uid, email: fbUser.email, role: profile.role });
            analytics.init(fbUser.uid, profile.role);
            logger.info('[Auth] Session restored', { uid: fbUser.uid, role: profile.role });
          } else {
            await logoutUser();
            setFireUser(null);
            setUser(null);
            clearMonitoringUser();
            analytics.reset();
          }
        } else {
          setFireUser(null);
          setUser(null);
          clearMonitoringUser();
          analytics.reset();
        }
      } catch (err) {
        logger.error('[Auth] onAuthStateChanged error', err);
        setFireUser(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // ── Register ────────────────────────────────────────────────
  const register = useCallback(async ({ name, email, password, role }) => {
    setAuthError('');
    const { error } = await registerWithEmail({ name, email, password, role });
    if (error) {
      setAuthError(error);
      analytics.track(EVENTS.LOGIN_FAILED, { reason: 'register_error' });
      return { success: false, error };
    }
    analytics.track(EVENTS.REGISTER_SUCCESS, { role });
    logger.info('[Auth] Registration successful');
    return { success: true, error: null };
  }, []);

  // ── Login ────────────────────────────────────────────────────
  const login = useCallback(async ({ email, password }) => {
    setAuthError('');
    const { profile, error } = await loginWithEmail({ email, password });
    if (error) {
      setAuthError(error);
      analytics.track(EVENTS.LOGIN_FAILED, { reason: 'invalid_credentials' });
      logger.warn('[Auth] Login failed', { error });
      return { success: false, error };
    }
    analytics.track(EVENTS.LOGIN_SUCCESS, { role: profile?.role });
    logger.info('[Auth] Login successful', { role: profile?.role });
    return { success: true, role: profile?.role, error: null };
  }, []);

  // ── Logout ───────────────────────────────────────────────────
  const logout = useCallback(async () => {
    analytics.track(EVENTS.LOGOUT);
    analytics.flush(); // flush pending events before clearing session
    await logoutUser();
    clearMonitoringUser();
    analytics.reset();
    logger.info('[Auth] User logged out');
  }, []);

  // ── Password reset ───────────────────────────────────────────
  const sendPasswordReset = useCallback(async (email) => {
    const { error } = await resetPassword(email);
    if (error) return { success: false, error };
    logger.info('[Auth] Password reset email sent');
    return { success: true, error: null };
  }, []);

  // ── Profile refresh ──────────────────────────────────────────
  const refreshProfile = useCallback(async () => {
    if (!fireUser) return;
    const profile = await getUserProfile(fireUser.uid);
    if (profile) {
      setUser((prev) => ({
        ...prev,
        name:  profile.name || fireUser.displayName,
        ...profile,
      }));
    }
  }, [fireUser]);

  const clearError = useCallback(() => setAuthError(''), []);

  return (
    <AuthContext.Provider value={{
      user,
      fireUser,
      loading,
      authError,
      register,
      login,
      logout,
      sendPasswordReset,
      refreshProfile,
      clearError,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
