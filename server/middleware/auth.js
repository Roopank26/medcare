/**
 * Medcare — Firebase ID Token Authentication Middleware (Production)
 *
 * Features:
 * - Extracts token from Authorization: Bearer <token> header
 * - Verifies token using Firebase Admin SDK
 * - Attaches decoded user data to req.user
 * - Comprehensive error handling and logging
 * - Supports role-based access control
 *
 * Usage:
 *   app.use(requireAuth);  // Require valid token
 *   app.use(requireRole('doctor'));  // Require specific role
 */
'use strict';

const admin = require('../utils/firebaseAdmin');
const { verifyToken, hasRole } = require('../utils/firebaseAdmin');

const IS_DEV = process.env.NODE_ENV !== 'production';

/**
 * Middleware: Verify Firebase ID token
 * Extracts Authorization Bearer token, verifies it, attaches user to request
 */
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';

  // Validate header format
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Missing or malformed Authorization header. Expected: Bearer <token>',
      code: 'auth/missing-token',
    });
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authorization token is empty',
      code: 'auth/empty-token',
    });
  }

  try {
    // Verify the Firebase ID token
    const decoded = await verifyToken(token);

    // Attach user data to request for use in route handlers
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      email_verified: decoded.email_verified,
      name: decoded.name,
      ...decoded,
    };

    if (IS_DEV) {
      console.log(`[Auth] Token verified for user: ${decoded.email} (${decoded.uid})`);
    }

    next();
  } catch (err) {
    if (IS_DEV) {
      console.warn(`[Auth] Token verification failed:`, err.message);
    }

    // Return standardized error response
    return res.status(401).json({
      success: false,
      error: err.message || 'Token verification failed',
      code: err.code || 'auth/verification-failed',
    });
  }
};

/**
 * Middleware: Verify user has required role
 * Must be used AFTER requireAuth
 *
 * @param {string|string[]} requiredRoles - Role(s) user must have
 * @returns {Function} Express middleware
 *
 * Usage:
 *   router.get('/doctor-only', requireRole('doctor'), handler);
 *   router.get('/admin-or-doctor', requireRole(['admin', 'doctor']), handler);
 */
const requireRole = (requiredRoles) => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  return async (req, res, next) => {
    // Ensure requireAuth ran first
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required before role check',
        code: 'auth/not-authenticated',
      });
    }

    // Check if user has one of the required roles
    // Role can be in custom claims (custom_role) or in token (medcare_role)
    const userRole = req.user.custom_claims?.role ||
                     req.user.custom_claims?.medcare_role ||
                     req.user.role ||
                     req.user.medcare_role;

    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${userRole || 'none'}`,
        code: 'auth/insufficient-role',
        required: roles,
        current: userRole,
      });
    }

    if (IS_DEV) {
      console.log(`[Auth] Role check passed for ${req.user.email} (role: ${userRole})`);
    }

    next();
  };
};

/**
 * Middleware: Optional authentication
 * Like requireAuth but doesn't return 401 if token is missing
 * Useful for public routes that can show user data if authenticated
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const decoded = await verifyToken(token);
        req.user = {
          uid: decoded.uid,
          email: decoded.email,
          email_verified: decoded.email_verified,
          name: decoded.name,
          ...decoded,
        };
      } catch (err) {
        // Silently ignore invalid token, continue as unauthenticated
        if (IS_DEV) {
          console.debug(`[Auth] Optional token verification failed:`, err.message);
        }
      }
    }
  }

  // Always proceed, whether authenticated or not
  next();
};

/**
 * Error handler for Firebase authentication errors
 * Maps Firebase errors to user-friendly messages
 */
const handleAuthError = (err, req, res) => {
  const errors = {
    'auth/missing-token': { status: 401, message: 'Authorization token is required' },
    'auth/empty-token': { status: 401, message: 'Authorization token cannot be empty' },
    'auth/invalid-token': { status: 401, message: 'Token format is invalid' },
    'auth/token-expired': { status: 401, message: 'Token has expired. Please sign in again' },
    'auth/invalid-firebase': { status: 500, message: 'Firebase authentication is misconfigured' },
    'auth/verification-failed': { status: 401, message: 'Token could not be verified' },
    'auth/insufficient-role': { status: 403, message: 'Insufficient permissions for this action' },
    'auth/not-authenticated': { status: 401, message: 'You must be authenticated to access this resource' },
  };

  const mapping = errors[err.code] || { status: 401, message: err.message || 'Authentication failed' };

  return res.status(mapping.status).json({
    success: false,
    error: mapping.message,
    code: err.code || 'auth/unknown',
  });
};

module.exports = {
  requireAuth,
  requireRole,
  optionalAuth,
  handleAuthError,
};
