/**
 * Medcare - Firebase Auth Helpers (Production)
 *
 * Features:
 * - browserLocalPersistence: session survives browser restart
 * - Full error code -> human-readable message mapping
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
import { createUserProfile, ensureUserProfile, getUserProfile } from "./firestore";

// Persistent login session
setPersistence(auth, browserLocalPersistence).catch((err) =>
  console.warn("[Auth] Could not set persistence:", err.message)
);

// Error message map
const AUTH_ERRORS = {
  "auth/email-already-in-use": "This email is already registered. Try signing in.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/weak-password": "Password must be at least 8 characters.",
  "auth/user-not-found": "No account found with this email.",
  "auth/wrong-password": "Incorrect password. Please try again.",
  "auth/too-many-requests": "Too many failed attempts. Please wait and try again.",
  "auth/network-request-failed": "Network error. Check your internet connection.",
  "auth/invalid-credential": "Invalid email or password.",
  "auth/user-disabled": "This account has been disabled. Contact support.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
  "auth/operation-not-allowed": "This sign-in method is not enabled.",
  "auth/requires-recent-login": "Please sign in again to perform this action.",
};

const friendlyError = (code) =>
  AUTH_ERRORS[code] || "An unexpected error occurred. Please try again.";

/**
 * Sends Firebase ID token to backend to create/sync user profile.
 * This ensures backend database stays in sync with Firebase Auth.
 */
const syncRegisterWithBackend = async (user, name, role) => {
  try {
    const token = await user.getIdToken();
    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/register-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, role, uid: user.uid, email: user.email }),
    });
    if (!response.ok) {
      const data = await response.json();
      console.warn("[Auth] Backend sync failed:", data.error);
      return { error: null };
    }
    return { error: null };
  } catch (err) {
    console.warn("[Auth] Backend sync error:", err.message);
    return { error: null };
  }
};

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
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
    });

    if (profileErr) {
      await user.delete().catch(() => {});
      return { user: null, error: "Account setup failed. Please try again." };
    }

    await syncRegisterWithBackend(user, name.trim(), role);

    return { user, error: null };
  } catch (err) {
    if (fbUser) {
      await fbUser.delete().catch(() => {});
    }
    return { user: null, error: friendlyError(err.code) };
  }
};

/**
 * Sends Firebase ID token to backend to verify/fetch user profile.
 * Backend either returns existing profile or creates one if missing.
 */
const syncLoginWithBackend = async (user) => {
  try {
    const token = await user.getIdToken();
    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/login-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ uid: user.uid, email: user.email }),
    });
    if (!response.ok) {
      const data = await response.json();
      return { profile: null, error: data.error || "Backend profile fetch failed" };
    }
    const data = await response.json();
    return { profile: data.user || null, error: null };
  } catch (err) {
    console.warn("[Auth] Backend sync failed:", err.message);
    return { profile: null, error: null };
  }
};

/**
 * Login with email/password.
 *
 * Flow:
 * 1. Sign in with Firebase Auth using email/password
 * 2. Fetch profile from Firestore using the auth UID
 * 3. Auto-create a missing users/{uid} profile for legacy accounts
 * 4. Fall back to backend recovery if Firestore is unavailable
 */
export const loginWithEmail = async ({ email, password }) => {
  try {
    console.log("[Auth] Starting login with email:", email);

    const { user } = await signInWithEmailAndPassword(auth, email, password);
    console.log("[Auth] Firebase Auth successful");
    console.log("[Auth] User UID:", user.uid);

    let profile = await getUserProfile(user.uid);

    if (profile) {
      console.log("[Auth] Profile found in Firestore", {
        uid: profile.uid,
        name: profile.name,
        role: profile.role,
      });
      return { user, profile, error: null };
    }

    const recovered = await ensureUserProfile(user, {
      email: user.email,
      name: user.displayName || user.email,
      role: "patient",
    });

    if (recovered.profile) {
      console.log("[Auth] Profile auto-recovered in Firestore", {
        uid: recovered.profile.uid,
        role: recovered.profile.role,
        created: recovered.created,
      });
      return { user, profile: recovered.profile, error: null };
    }

    console.warn("[Auth] Firestore profile recovery failed, trying backend fallback...");
    const { profile: backendProfile, error: backendError } = await syncLoginWithBackend(user);

    if (backendProfile) {
      console.log("[Auth] Profile found via backend fallback", {
        uid: backendProfile.uid,
        role: backendProfile.role,
      });
      return { user, profile: backendProfile, error: null };
    }

    await signOut(auth).catch(() => {});

    return {
      user: null,
      profile: null,
      error:
        recovered.error ||
        backendError ||
        "We couldn't restore your profile right now. Please check your connection and try again.",
    };
  } catch (err) {
    console.error("[Auth] Login error:", err.code, err.message);
    return { user: null, profile: null, error: friendlyError(err.code) };
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { error: null };
  } catch (err) {
    return { error: friendlyError(err.code) };
  }
};

export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
    return { error: null };
  } catch (err) {
    return { error: friendlyError(err.code) };
  }
};

export const subscribeToAuthChanges = (callback) =>
  onAuthStateChanged(auth, callback);
