/**
 * Medcare — Firebase Auth Helpers (Production)
 *
 * Features:
 * - browserLocalPersistence: session survives browser restart
 * - Full error code → human-readable message mapping
 * - Password reset support
 * - Profile created atomically with auth account
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { auth } from "./config";
import { createUserProfile, getUserProfile } from "./firestore";

// ── Persistent login session ─────────────────────────────────
setPersistence(auth, browserLocalPersistence).catch((err) =>
  console.warn("[Auth] Could not set persistence:", err.message)
);

// ── Error message map ────────────────────────────────────────
const AUTH_ERRORS = {
  "auth/email-already-in-use":    "This email is already registered. Try signing in.",
  "auth/invalid-email":           "Please enter a valid email address.",
  "auth/weak-password":           "Password must be at least 8 characters.",
  "auth/user-not-found":          "No account found with this email.",
  "auth/wrong-password":          "Incorrect password. Please try again.",
  "auth/too-many-requests":       "Too many failed attempts. Please wait and try again.",
  "auth/network-request-failed":  "Network error. Check your internet connection.",
  "auth/invalid-credential":      "Invalid email or password.",
  "auth/user-disabled":           "This account has been disabled. Contact support.",
  "auth/popup-closed-by-user":    "Sign-in was cancelled.",
  "auth/operation-not-allowed":   "This sign-in method is not enabled.",
  "auth/requires-recent-login":   "Please sign in again to perform this action.",
};

const friendlyError = (code) =>
  AUTH_ERRORS[code] || "An unexpected error occurred. Please try again.";

// ── Sync register with backend ──────────────────────────────
/**
 * Sends Firebase ID token to backend to create/sync user profile.
 * This ensures backend database stays in sync with Firebase Auth.
 */
const syncRegisterWithBackend = async (user, name, role) => {
  try {
    const token = await user.getIdToken();
    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/register-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ name, role, uid: user.uid, email: user.email }),
    });
    if (!response.ok) {
      const data = await response.json();
      console.warn('[Auth] Backend sync failed:', data.error);
      return { error: null }; // Non-fatal: Firestore still has the profile
    }
    return { error: null };
  } catch (err) {
    console.warn('[Auth] Backend sync error:', err.message);
    return { error: null }; // Non-fatal: Firestore still has the profile
  }
};

// ── Register ─────────────────────────────────────────────────
/**
 * Create Firebase Auth user + Firestore profile atomically.
 * Then sync with backend. If profile creation fails, the auth user is deleted.
 */
export const registerWithEmail = async ({ name, email, password, role }) => {
  let fbUser = null;
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    fbUser = user;
    await updateProfile(user, { displayName: name.trim() });

    const { error: profileErr } = await createUserProfile(user.uid, {
      name:  name.trim(),
      email: email.trim().toLowerCase(),
      role,
    });

    if (profileErr) {
      // Roll back: delete auth account so user can retry cleanly
      await user.delete().catch(() => {});
      return { user: null, error: "Account setup failed. Please try again." };
    }

    // Sync with backend (wait for it to complete)
    await syncRegisterWithBackend(user, name.trim(), role);

    return { user, error: null };
  } catch (err) {
    // If auth succeeded but profile failed, clean up
    if (fbUser) {
      await fbUser.delete().catch(() => {});
    }
    return { user: null, error: friendlyError(err.code) };
  }
};

// ── Sync login with backend ────────────────────────────────
/**
 * Sends Firebase ID token to backend to verify/fetch user profile.
 * Backend either returns existing profile or creates one if missing.
 */
const syncLoginWithBackend = async (user) => {
  try {
    const token = await user.getIdToken();
    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/login-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ uid: user.uid, email: user.email }),
    });
    if (!response.ok) {
      const data = await response.json();
      return { profile: null, error: data.error || 'Backend profile fetch failed' };
    }
    const data = await response.json();
    return { profile: data.user || null, error: null };
  } catch (err) {
    console.warn('[Auth] Backend sync failed:', err.message);
    return { profile: null, error: null }; // Non-fatal: Firestore still has the profile
  }
};

// ── Login ─────────────────────────────────────────────────────
/**
 * Login with email/password.
 * 
 * Flow:
 * 1. Sign in with Firebase Auth using email/password
 * 2. Get user.uid from Firebase Auth
 * 3. Fetch profile from Firestore using UID (primary source)
 * 4. If Firestore profile missing, try backend (fallback only)
 * 5. Return profile or error
 * 
 * Debug logs added to diagnose profile fetch issues.
 */
export const loginWithEmail = async ({ email, password }) => {
  try {
    console.log('[Auth] Starting login with email:', email);
    
    // ✅ Step 1: Sign in with Firebase Auth
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    console.log('[Auth] Firebase Auth successful');
    console.log('[Auth] User UID:', user.uid);
    console.log('[Auth] User email from Auth:', user.email);
    
    // ✅ Step 2: Fetch profile from Firestore using UID (PRIMARY)
    console.log('[Auth] Fetching profile from Firestore at path: users/' + user.uid);
    let profile = await getUserProfile(user.uid);
    
    if (profile) {
      console.log('[Auth] ✅ Profile found in Firestore', { 
        uid: profile.uid, 
        name: profile.name, 
        role: profile.role 
      });
      return { user, profile, error: null };
    }
    
    // Profile not in Firestore - this is the error case
    console.warn('[Auth] ⚠️ Profile NOT found in Firestore at: users/' + user.uid);
    console.warn('[Auth] Firestore collections to check:');
    console.warn('[Auth]   - Expected: db.collection("users").doc(uid)');
    console.warn('[Auth]   - UID value:', user.uid);
    console.warn('[Auth] If profile exists under different path, update getUserProfile()');
    
    // ✅ Step 3: Try backend sync as fallback (NON-PRIMARY)
    console.log('[Auth] Trying backend profile fetch as fallback...');
    const { profile: backendProfile, error: backendError } = await syncLoginWithBackend(user);
    
    if (backendProfile) {
      console.log('[Auth] ✅ Profile found via backend fallback', {
        name: backendProfile.name,
        role: backendProfile.role
      });
      return { user, profile: backendProfile, error: null };
    }
    
    // Both Firestore AND backend failed
    console.error('[Auth] ❌ CRITICAL: Profile not found in Firestore or backend');
    console.error('[Auth] User UID:', user.uid);
    console.error('[Auth] User email:', user.email);
    console.error('[Auth] Next steps:');
    console.error('[Auth]   1. Check Firebase Console > Firestore > "users" collection');
    console.error('[Auth]   2. Verify document exists with ID:', user.uid);
    console.error('[Auth]   3. Verify "name" and "role" fields exist');
    console.error('[Auth]   4. If missing, run: createUserProfile(uid, { name, email, role })');
    
    // Log out user since profile doesn't exist
    await signOut(auth);
    
    return { 
      user: null, 
      profile: null, 
      error: "User profile not found in database. This means either: 1) You registered but profile wasn't saved, or 2) The profile is in a different collection. Please register again." 
    };
    
  } catch (err) {
    console.error('[Auth] Login error:', err.code, err.message);
    return { user: null, profile: null, error: friendlyError(err.code) };
  }
};

// ── Logout ────────────────────────────────────────────────────
export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { error: null };
  } catch (err) {
    return { error: friendlyError(err.code) };
  }
};

// ── Password reset ────────────────────────────────────────────
export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
    return { error: null };
  } catch (err) {
    return { error: friendlyError(err.code) };
  }
};

// ── Auth state observer ───────────────────────────────────────
export const subscribeToAuthChanges = (callback) =>
  onAuthStateChanged(auth, callback);
