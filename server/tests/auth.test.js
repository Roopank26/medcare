/**
 * Phase 1+3 — Auth middleware tests
 */
'use strict';

const { requireAuth, requireRole } = require('../middleware/auth');

// Mock firebase-admin
jest.mock('../utils/firebaseAdmin', () => ({
  auth: () => ({
    verifyIdToken: jest.fn().mockImplementation((token) => {
      if (token === 'valid-token') return Promise.resolve({ uid: 'u1', role: 'patient' });
      throw new Error('Invalid token');
    }),
  }),
}));

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};

describe('requireAuth middleware', () => {
  it('rejects request with no Authorization header', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects malformed header (not Bearer)', async () => {
    const req = { headers: { authorization: 'Basic abc123' } };
    const res = mockRes();
    const next = jest.fn();
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects invalid token', async () => {
    const req = { headers: { authorization: 'Bearer bad-token' } };
    const res = mockRes();
    const next = jest.fn();
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('allows valid token and attaches user to req', async () => {
    const req = { headers: { authorization: 'Bearer valid-token' } };
    const res = mockRes();
    const next = jest.fn();
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.uid).toBe('u1');
  });
});

describe('requireRole middleware', () => {
  it('blocks wrong role', () => {
    const req = { user: { uid: 'u1', role: 'patient' } };
    const res = mockRes();
    const next = jest.fn();
    requireRole('doctor')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows correct role', () => {
    const req = { user: { uid: 'u1', role: 'doctor' } };
    const res = mockRes();
    const next = jest.fn();
    requireRole('doctor')(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
