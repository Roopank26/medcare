/**
 * Phase 3 — Symptom controller tests
 */
'use strict';

const { analyzeSymptoms } = require('../controllers/symptomController');

const mockReq  = (body) => ({ body });
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};

describe('analyzeSymptoms controller', () => {
  it('returns 400 when symptoms is missing', () => {
    const res = mockRes();
    analyzeSymptoms(mockReq({}), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when symptoms is empty string', () => {
    const res = mockRes();
    analyzeSymptoms(mockReq({ symptoms: '   ' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 200 with a result for valid symptoms', () => {
    const res = mockRes();
    analyzeSymptoms(mockReq({ symptoms: 'fever chills body ache' }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.result).toBeDefined();
    expect(body.result.diagnosis).toBeTruthy();
    expect(body.result.confidence).toBeGreaterThan(0);
  });

  it('returns unspecified condition for unknown symptoms', () => {
    const res = mockRes();
    analyzeSymptoms(mockReq({ symptoms: 'tingling in left elbow only at night' }), res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('analyzeSymptoms — edge cases', () => {
  it('matches flu symptoms correctly', () => {
    const res = mockRes();
    analyzeSymptoms(mockReq({ symptoms: 'fever chills body ache fatigue' }), res);
    const body = res.json.mock.calls[0][0];
    expect(body.result.diagnosis).toContain('Flu');
    expect(body.result.confidence).toBeGreaterThan(50);
    expect(body.result.recommendations.length).toBeGreaterThan(0);
  });

  it('returns date in result', () => {
    const res = mockRes();
    analyzeSymptoms(mockReq({ symptoms: 'headache migraine' }), res);
    const body = res.json.mock.calls[0][0];
    expect(body.result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('confidence is between 0 and 100', () => {
    const res = mockRes();
    analyzeSymptoms(mockReq({ symptoms: 'nausea vomiting stomach pain' }), res);
    const { confidence } = res.json.mock.calls[0][0].result;
    expect(confidence).toBeGreaterThan(0);
    expect(confidence).toBeLessThanOrEqual(100);
  });
});
