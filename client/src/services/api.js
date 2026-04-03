/**
 * Medcare - Express Backend API Client
 *
 * - Firebase ID token is automatically attached as
 *   Authorization: Bearer <token> on every request via request interceptor.
 */

import axios from 'axios';
import { getAuth } from 'firebase/auth';

const API = axios.create({ baseURL: '/api', timeout: 15_000 });

// -- Request interceptor: attach Firebase ID token ------
API.interceptors.request.use(
  async (config) => {
    try {
      const auth  = getAuth();
      const user  = auth.currentUser;
      if (user) {
        const token = await user.getIdToken(/* forceRefresh */ false);
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // No-op — if token fetch fails, request goes unsigned (server will reject with 401)
    }
    return config;
  },
  (err) => Promise.reject(err),
);

// -- Response interceptor: consistent error messages ------
API.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.error ||
      err.response?.data?.message ||
      'Server error. Is the backend running?';
    return Promise.reject(new Error(message));
  },
);

/** Send symptoms text to the Express backend for rule-based analysis. */
export const analyzeSymptoms = (symptoms) =>
  API.post('/symptoms/analyze', { symptoms });

export default API;
