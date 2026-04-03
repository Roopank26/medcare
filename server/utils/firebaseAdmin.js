/**
 * Medcare — Firebase Admin SDK (Production-Grade)
 *
 * Features:
 * - Singleton pattern: Initializes once, reused across all modules
 * - Environment-first: Credentials from FIREBASE_SERVICE_ACCOUNT_JSON env var
 * - Fallback chains: Service Account → ADC (Google Application Credentials) → Error
 * - Comprehensive logging: Debug initialization, errors, and token verification
 * - Production-safe: No hardcoded secrets, secure JSON parsing
 *
 * Usage:
 *   const admin = require('./utils/firebaseAdmin');
 *   const decoded = await admin.auth().verifyIdToken(token);
 */
'use strict';

const admin = require('firebase-admin');
const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * Initialize Firebase Admin SDK once (singleton pattern)
 * Tries multiple credential sources in order of preference
 */
if (!admin.apps.length) {
  let credentialSource = 'none';
  let credential = null;

  try {
    // Strategy 1: FIREBASE_SERVICE_ACCOUNT_JSON environment variable (RECOMMENDED)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        credential = admin.credential.cert(serviceAccount);
        credentialSource = `service_account (project: ${serviceAccount.project_id})`;
      } catch (parseErr) {
        console.error('[FirebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', parseErr.message);
        if (IS_PROD) throw parseErr;
      }
    }

    // Strategy 2: GOOGLE_APPLICATION_CREDENTIALS file path (for GCP/Cloud Run)
    if (!credential && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      credential = admin.credential.applicationDefault();
      credentialSource = `ADC (${process.env.GOOGLE_APPLICATION_CREDENTIALS})`;
    }

    // Strategy 3: Development fallback (UNSAFE - for local dev only)
    if (!credential) {
      if (IS_PROD) {
        throw new Error(
          'Firebase credentials not configured. ' +
          'Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS'
        );
      }
      // Development mode: Initialize without credentials (token verification will fail)
      console.warn('[FirebaseAdmin] [DEV] No credentials found. Token verification will fail.');
      admin.initializeApp();
      credentialSource = 'none (development fallback)';
    } else {
      admin.initializeApp({ credential });
    }

    console.log(
      `[FirebaseAdmin] ${IS_PROD ? 'PRODUCTION' : 'DEVELOPMENT'} ` +
      `initialized. Credential source: ${credentialSource}`
    );
  } catch (err) {
    console.error('[FirebaseAdmin] Initialization failed:', err.message);
    throw err;
  }
}

/**
 * Verify Firebase ID token securely
 * Called by authentication middleware on protected routes
 *
 * @param {string} token - Firebase ID token from Authorization header
 * @returns {Promise<object>} Decoded token with uid, email, etc.
 * @throws {Error} If token is invalid or expired
 */
const verifyToken = async (token) => {
  if (!token) {
    const err = new Error('Token is required for verification');
    err.code = 'auth/no-token';
    throw err;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email,
      email_verified: decoded.email_verified,
      name: decoded.name,
      ...decoded,
    };
  } catch (err) {
    // Map Firebase errors to standardized codes
    const errorMap = {
      'auth/argument-error': { code: 'auth/invalid-token', message: 'Token format is invalid' },
      'auth/id-token-expired': { code: 'auth/token-expired', message: 'Token has expired' },
      'auth/invalid-api-key': { code: 'auth/invalid-firebase', message: 'Firebase API key is invalid' },
      'auth/invalid-credential': { code: 'auth/invalid-credential', message: 'Firebase credentials are invalid' },
    };

    const mapped = errorMap[err.code] || {
      code: 'auth/verification-failed',
      message: err.message || 'Token verification failed',
    };

    const error = new Error(mapped.message);
    error.code = mapped.code;
    error.originalError = err;
    throw error;
  }
};

/**
 * Verify custom claims (e.g., user role)
 * Used for role-based access control
 *
 * @param {string} uid - Firebase user UID
 * @param {string} requiredRole - Role to verify (e.g., 'doctor', 'admin')
 * @returns {Promise<boolean>} True if user has the required role
 */
const hasRole = async (uid, requiredRole) => {
  try {
    const user = await admin.auth().getUser(uid);
    const role = user.customClaims?.role || user.customClaims?.medcare_role;
    return role === requiredRole;
  } catch (err) {
    console.error(`[FirebaseAdmin] Error checking role for ${uid}:`, err.message);
    return false;
  }
};

/**
 * Create custom claims for a user (sets role)
 * Called during registration or role assignment
 *
 * @param {string} uid - Firebase user UID
 * @param {object} claims - Custom claims object (e.g., { role: 'doctor' })
 */
const setCustomClaims = async (uid, claims) => {
  try {
    await admin.auth().setCustomUserClaims(uid, claims);
    console.log(`[FirebaseAdmin] Set custom claims for ${uid}:`, claims);
  } catch (err) {
    console.error(`[FirebaseAdmin] Error setting custom claims for ${uid}:`, err.message);
    throw err;
  }
};

module.exports = admin;
module.exports.verifyToken = verifyToken;
module.exports.hasRole = hasRole;
module.exports.setCustomClaims = setCustomClaims;
