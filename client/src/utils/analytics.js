/**
 * Medcare — Client-Side Analytics
 *
 * Tracks user actions and feature usage patterns.
 * Data is stored in Firestore under `analytics/{userId}/events`
 *
 * Design:
 * - Batches events to avoid excessive Firestore writes
 * - Never sends PII (names, emails) — only action types + metadata
 * - All event categories are predefined to prevent typos
 *
 * PHASE 0 FIX:
 *   Root cause of "Maximum call stack size exceeded":
 *     analytics.track()
 *       → logger.action()
 *         → window.__MEDCARE_ANALYTICS__.track()    ← set in analytics.init()
 *           → analytics.track()   ← INFINITE LOOP
 *
 *   Fix: module-level _tracking boolean guard.
 *   When track() is already on the call stack, the window bridge is a no-op.
 *   Zero feature loss — logger still records every action; analytics still batches
 *   and flushes; the only change is that re-entrant calls via the window bridge
 *   are silently dropped instead of recursing.
 */

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import logger from './logger';

// ── Event categories ──────────────────────────────────────────
export const EVENTS = {
  // Feature usage
  SYMPTOM_ANALYZED:      'symptom_analyzed',
  SYMPTOM_SAVED:         'symptom_saved',
  REPORT_UPLOADED:       'report_uploaded',
  APPOINTMENT_BOOKED:    'appointment_booked',
  APPOINTMENT_CANCELLED: 'appointment_cancelled',
  CHATBOT_MESSAGE:       'chatbot_message',
  PROFILE_UPDATED:       'profile_updated',
  // Navigation
  PAGE_VIEW:             'page_view',
  // Authentication
  LOGIN_SUCCESS:         'login_success',
  LOGIN_FAILED:          'login_failed',
  REGISTER_SUCCESS:      'register_success',
  LOGOUT:                'logout',
  // Doctor actions
  PATIENT_ADDED:         'patient_added',
  PATIENT_UPDATED:       'patient_updated',
  PATIENT_DELETED:       'patient_deleted',
  // Search
  SYMPTOM_SEARCH:        'symptom_search',
  PATIENT_SEARCH:        'patient_search',
};

/** Batch buffer — flush every 30s or when 10 events accumulate */
const _buffer        = [];
const BATCH_SIZE     = 10;
const FLUSH_INTERVAL = 30_000;

let _userId     = null;
let _role       = null;
let _flushTimer = null;

/**
 * PHASE 0 FIX — Reentrancy guard.
 * Breaks the track() → logger.action() → window.__MEDCARE_ANALYTICS__.track() → track() loop.
 * Set to true while track() is executing; any re-entrant window bridge call is a no-op.
 */
let _tracking = false;

const _flush = async () => {
  if (!_buffer.length || !_userId) return;
  const batch = _buffer.splice(0, _buffer.length);
  try {
    await addDoc(collection(db, 'analytics'), {
      userId:    _userId,
      role:      _role,
      events:    batch,
      flushedAt: serverTimestamp(),
    });
  } catch (err) {
    logger.warn('[Analytics] Failed to flush events', { count: batch.length, error: err.message });
    // Re-add to buffer on failure (don't lose events)
    _buffer.unshift(...batch);
  }
};

const _schedule = () => {
  if (_flushTimer) clearTimeout(_flushTimer);
  _flushTimer = setTimeout(_flush, FLUSH_INTERVAL);
};

const analytics = {
  /**
   * Initialize analytics for the current user session.
   * Call after login / auth state resolves.
   * @param {string} userId
   * @param {string} role
   */
  init(userId, role) {
    _userId = userId;
    _role   = role;
    _schedule();

    // Expose for logger.js action hook.
    // PHASE 0 FIX: bridge checks _tracking to prevent re-entrant calls.
    window.__MEDCARE_ANALYTICS__ = {
      track: (action, data) => {
        if (_tracking) return; // re-entrant call → drop silently, break the loop
        analytics.track(action, data);
      },
    };
  },

  /** Reset on logout */
  reset() {
    _userId = null;
    _role   = null;
    if (_flushTimer) clearTimeout(_flushTimer);
    _buffer.length = 0;
    window.__MEDCARE_ANALYTICS__ = null;
  },

  /**
   * Track a user action.
   * @param {string} event  - Use EVENTS constants
   * @param {object} [data] - Non-PII metadata
   */
  track(event, data = {}) {
    if (!_userId) return;

    // PHASE 0 FIX: raise reentrancy guard BEFORE calling logger.action()
    _tracking = true;
    try {
      const entry = {
        event,
        data: sanitizeEventData(data),
        ts:   new Date().toISOString(),
      };
      _buffer.push(entry);
      logger.action(event, entry.data); // safe — guard prevents infinite recursion
      if (_buffer.length >= BATCH_SIZE) _flush();
      else _schedule();
    } finally {
      _tracking = false; // always release, even if logger throws
    }
  },

  /**
   * Track a page/section view.
   * @param {string} section - e.g. 'symptom_checker', 'appointments'
   */
  page(section) {
    this.track(EVENTS.PAGE_VIEW, { section });
  },

  /** Flush pending events immediately (call on page unload). */
  flush: _flush,
};

/** Strip any PII from event data before storing */
const sanitizeEventData = (data) => {
  const safe = { ...data };
  ['name', 'email', 'phone', 'address', 'notes', 'doctorName', 'patientName'].forEach(
    (k) => delete safe[k],
  );
  return safe;
};

export default analytics;
