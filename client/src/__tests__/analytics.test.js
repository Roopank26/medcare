/**
 * PHASE 0 — Regression test for analytics infinite loop
 * Ensures analytics.track() does NOT cause "Maximum call stack size exceeded"
 */

// Mock Firestore
jest.mock('../firebase/config', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  addDoc:          jest.fn().mockResolvedValue({}),
  collection:      jest.fn(),
  serverTimestamp: jest.fn(),
}));

// Mock logger — simulates the original bug: logger.action calls window.__MEDCARE_ANALYTICS__.track
jest.mock('../utils/logger', () => ({
  action: jest.fn((event, data) => {
    // This is exactly the pattern that caused the infinite loop
    if (window.__MEDCARE_ANALYTICS__) {
      window.__MEDCARE_ANALYTICS__.track(event, data);
    }
  }),
  warn:  jest.fn(),
  info:  jest.fn(),
  error: jest.fn(),
  perf:  jest.fn(),
}));

describe('analytics — Phase 0 infinite loop regression', () => {
  let analytics;

  beforeEach(() => {
    jest.resetModules();
    // Re-import to get fresh module state
    analytics = require('../utils/analytics').default;
    analytics.reset();
  });

  afterEach(() => {
    analytics.reset();
  });

  it('should NOT throw "Maximum call stack size exceeded" when track() is called', () => {
    analytics.init('test-uid', 'patient');
    expect(() => {
      analytics.track('symptom_analyzed', { disease: 'Flu', confidence: 80 });
    }).not.toThrow();
  });

  it('should buffer the event exactly once — not duplicate via re-entrant call', () => {
    analytics.init('test-uid', 'patient');
    const logger = require('../utils/logger');
    analytics.track('page_view', { section: 'dashboard' });
    // logger.action should be called exactly once — not recursively
    expect(logger.action).toHaveBeenCalledTimes(1);
  });

  it('should still call logger.action (feature not removed by fix)', () => {
    analytics.init('test-uid', 'patient');
    const logger = require('../utils/logger');
    analytics.track('login_success', { role: 'doctor' });
    expect(logger.action).toHaveBeenCalledWith('login_success', expect.any(Object));
  });

  it('should silently drop calls when userId is not set (no crash)', () => {
    // analytics.reset() clears _userId
    expect(() => analytics.track('page_view', {})).not.toThrow();
  });

  it('page() helper should track PAGE_VIEW without crashing', () => {
    analytics.init('uid-2', 'doctor');
    expect(() => analytics.page('symptom_checker')).not.toThrow();
  });

  it('sanitizeEventData strips PII fields', () => {
    analytics.init('uid-3', 'patient');
    const logger = require('../utils/logger');
    analytics.track('profile_updated', {
      name: 'Alice Smith',   // PII — should be stripped
      email: 'a@b.com',      // PII — should be stripped
      confidence: 90,        // safe
    });
    const calledData = logger.action.mock.calls[0][1];
    expect(calledData.name).toBeUndefined();
    expect(calledData.email).toBeUndefined();
    expect(calledData.confidence).toBe(90);
  });
});
