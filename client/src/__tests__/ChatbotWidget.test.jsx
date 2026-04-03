/**
 * Phase 6+7 — ChatbotWidget tests
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

jest.mock('../firebase/config', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn().mockResolvedValue({ id: 'fb-1' }),
  collection: jest.fn(),
  serverTimestamp: jest.fn(),
}));
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'uid-1', role: 'patient' } }),
}));
jest.mock('../utils/analytics', () => ({
  default: { track: jest.fn() },
  EVENTS: { CHATBOT_MESSAGE: 'chatbot_message' },
}));
jest.mock('../utils/logger', () => ({
  error: jest.fn(), warn: jest.fn(), info: jest.fn(),
}));
jest.mock('../services/mlApi', () => ({
  mlChat: jest.fn().mockResolvedValue({
    data: { reply: 'For a fever, rest and stay hydrated.', source: 'rule-based' },
  }),
}));
jest.mock('../firebase/firestore', () => ({
  saveChatFeedback: jest.fn().mockResolvedValue({ id: 'fb-1', error: null }),
}));

import ChatbotWidget from '../components/ChatbotWidget';

describe('ChatbotWidget', () => {
  it('renders floating button by default', () => {
    render(<ChatbotWidget />);
    expect(screen.getByTitle(/open medbot/i)).toBeInTheDocument();
  });

  it('opens chat panel on button click', async () => {
    render(<ChatbotWidget />);
    fireEvent.click(screen.getByTitle(/open medbot/i));
    await waitFor(() => expect(screen.getByText(/MedBot/)).toBeInTheDocument());
  });

  it('shows welcome message when panel opens', async () => {
    render(<ChatbotWidget />);
    fireEvent.click(screen.getByTitle(/open medbot/i));
    await waitFor(() => expect(screen.getByText(/Hi! I'm \*\*MedBot\*\*/i)).toBeInTheDocument());
  });

  it('shows quick question buttons initially', async () => {
    render(<ChatbotWidget />);
    fireEvent.click(screen.getByTitle(/open medbot/i));
    await waitFor(() => expect(screen.getByText(/fever/i)).toBeInTheDocument());
  });

  it('closes panel when × is clicked', async () => {
    render(<ChatbotWidget />);
    fireEvent.click(screen.getByTitle(/open medbot/i));
    await waitFor(() => screen.getByText('×'));
    fireEvent.click(screen.getByText('×'));
    expect(screen.getByTitle(/open medbot/i)).toBeInTheDocument();
  });

  it('send button is disabled when input is empty', async () => {
    render(<ChatbotWidget />);
    fireEvent.click(screen.getByTitle(/open medbot/i));
    await waitFor(() => screen.getByPlaceholderText(/ask a health question/i));
    const sendBtn = screen.getAllByRole('button').find(b => b.querySelector('svg'));
    expect(sendBtn).toHaveAttribute('disabled');
  });

  it('tracks analytics on send', async () => {
    const analytics = require('../utils/analytics').default;
    render(<ChatbotWidget />);
    fireEvent.click(screen.getByTitle(/open medbot/i));
    await waitFor(() => screen.getByPlaceholderText(/ask a health question/i));
    const input = screen.getByPlaceholderText(/ask a health question/i);
    fireEvent.change(input, { target: { value: 'I have a headache' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(analytics.track).toHaveBeenCalledWith('chatbot_message', expect.any(Object)));
  });
});
