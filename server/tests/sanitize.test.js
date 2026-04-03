'use strict';

const { sanitizeBody } = require('../middleware/sanitize');

const mockReq  = (body) => ({ body });
const mockNext = jest.fn();

beforeEach(() => mockNext.mockClear());

describe('sanitizeBody middleware', () => {
  it('strips HTML tags from string fields', () => {
    const req = mockReq({ symptoms: '<script>alert(1)</script>fever' });
    sanitizeBody(req, {}, mockNext);
    expect(req.body.symptoms).toBe('fever');
    expect(mockNext).toHaveBeenCalled();
  });

  it('strips null bytes', () => {
    const req = mockReq({ name: 'Alice\x00Smith' });
    sanitizeBody(req, {}, mockNext);
    expect(req.body.name).toBe('AliceSmith');
  });

  it('handles nested objects', () => {
    const req = mockReq({ user: { name: '<b>Bob</b>' } });
    sanitizeBody(req, {}, mockNext);
    expect(req.body.user.name).toBe('Bob');
  });

  it('trims whitespace', () => {
    const req = mockReq({ symptoms: '  fever  ' });
    sanitizeBody(req, {}, mockNext);
    expect(req.body.symptoms).toBe('fever');
  });

  it('passes non-string values unchanged', () => {
    const req = mockReq({ age: 30, active: true });
    sanitizeBody(req, {}, mockNext);
    expect(req.body.age).toBe(30);
    expect(req.body.active).toBe(true);
  });

  it('always calls next()', () => {
    sanitizeBody(mockReq({}), {}, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });
});
