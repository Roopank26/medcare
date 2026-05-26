/**
 * Phase 3 - SymptomChecker component tests
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import SymptomChecker from '../components/patient/SymptomChecker';

function mockGet(url) {
  if (url === '/symptoms') {
    return Promise.resolve({ data: { common_tags: [] } });
  }
  if (String(url).startsWith('/suggest')) {
    return Promise.resolve({ data: { suggestions: [] } });
  }
  return Promise.resolve({ data: {} });
}

function mockPost() {
  return Promise.resolve({ data: { success: true } });
}

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    get: mockGet,
    post: mockPost,
  })),
}));

jest.mock('../firebase/config', () => ({ db: {} }));
jest.mock('../firebase/firestore', () => ({
  saveSymptomDoc: jest.fn().mockResolvedValue({ error: null }),
}));
jest.mock('../utils/analytics', () => ({
  __esModule: true,
  default: { track: jest.fn(), init: jest.fn(), reset: jest.fn(), page: jest.fn() },
  EVENTS: { SYMPTOM_ANALYZED: 'symptom_analyzed', SYMPTOM_SEARCH: 'symptom_search' },
}));
jest.mock('../utils/logger', () => ({
  perf: jest.fn(), error: jest.fn(), action: jest.fn(), info: jest.fn(), warn: jest.fn(),
}));
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'test-uid', role: 'patient' } }),
}));
jest.mock('../hooks/useToast', () => () => ({
  success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn(),
}));
jest.mock('../utils/validation', () => ({
  validateSymptoms: jest.fn().mockReturnValue({ valid: true }),
}));
jest.mock('../utils/sanitize', () => ({
  sanitizeSymptoms: jest.fn((s) => s),
}));

describe('SymptomChecker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', async () => {
    render(<SymptomChecker />);
    expect(await screen.findByPlaceholderText(/type a symptom/i)).toBeInTheDocument();
  });

  it('shows the analyze button after loading', async () => {
    render(<SymptomChecker />);
    expect(await screen.findByText(/analyze symptoms/i)).toBeInTheDocument();
  });

  it('keeps the analyze button visible for empty input state', async () => {
    render(<SymptomChecker />);
    expect(await screen.findByText(/analyze symptoms/i)).toBeInTheDocument();
  });
});
