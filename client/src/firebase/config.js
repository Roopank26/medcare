/**
 * Medcare — Firebase Configuration
 *
 * All values MUST come from environment variables.
 * NEVER hardcode API keys or project IDs here.
 * Set REACT_APP_FIREBASE_* in .env (local) or CI/CD secrets (production).
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAuth }      from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage }   from 'firebase/storage';

const required = (key) => {
  const val = process.env[key];
  if (!val && process.env.NODE_ENV === 'production') {
    console.error(`[Firebase] Missing required env var: ${key}`);
  }
  return val || '';
};

const firebaseConfig = {
  apiKey:            required('REACT_APP_FIREBASE_API_KEY'),
  authDomain:        required('REACT_APP_FIREBASE_AUTH_DOMAIN'),
  projectId:         required('REACT_APP_FIREBASE_PROJECT_ID'),
  storageBucket:     required('REACT_APP_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: required('REACT_APP_FIREBASE_MESSAGING_SENDER_ID'),
  appId:             required('REACT_APP_FIREBASE_APP_ID'),
};

// Prevent duplicate initialization (hot-reload / React StrictMode safety)
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);

export default app;
