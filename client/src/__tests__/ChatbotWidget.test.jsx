/**
 * Phase 6+7 - ChatbotWidget tests
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockTrack = jest.fn();
const mockMlChat = jest.fn().mockResolvedValue({
  data: { reply: 'For a fever, rest and stay hydrated.', source: 'rule-based' },
});

jest.mock('../firebase/config', () => ({ db: {} }));
jest.mock('../firebase/firestore', () => ({
  saveChatFeedback: jest.fn().mockResolvedValue({ id: 'fb-1', error: null }),
}));
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'uid-1', role: 'patient' } }),
}));
jest.mock('../utils/analytics', () => ({
  __esModule: true,
  default: { track: mockTrack },
  EVENTS: { CHATBOT_MESSAGE: 'chatbot_message' },
}));
jest.mock('../utils/logger', () => ({
  error: jest.fn(), warn: jest.fn(), info: jest.fn(),
}));
jest.mock('../services/mlApi', () => ({
  mlChat: mockMlChat,
}));

const ChatbotWidget = require('../components/ChatbotWidget').default;

describe('ChatbotWidget', () => {
  it('renders floating button by default', () => {
    render(<ChatbotWidget />);
    expect(screen.getByTitle(/open medbot/i)).toBeInTheDocument();
  });

  it('opens chat panel on button click', async () => {
    render(<ChatbotWidget />);
    fireEvent.click(screen.getByTitle(/open medbot/i));
    expect(await screen.findByPlaceholderText(/ask a health question/i)).toBeInTheDocument();
  });

  it('shows welcome message when panel opens', async () => {
    render(<ChatbotWidget />);
    fireEvent.click(screen.getByTitle(/open medbot/i));
    const matches = await screen.findAllByText(/not a substitute for professional medical advice/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('shows quick question buttons initially', async () => {
    render(<ChatbotWidget />);
    fireEvent.click(screen.getByTitle(/open medbot/i));
    expect(await screen.findByText(/fever/i)).toBeInTheDocument();
  });

  it('closes panel when the close button is clicked', async () => {
    render(<ChatbotWidget />);
    fireEvent.click(screen.getByTitle(/open medbot/i));
    const closeButton = await screen.findByRole('button', { name: /×|close/i });
    fireEvent.click(closeButton);
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(/ask a health question/i)).not.toBeInTheDocument()
    );
  });

  it('send button is disabled when input is empty', async () => {
    render(<ChatbotWidget />);
    fireEvent.click(screen.getByTitle(/open medbot/i));
    await screen.findByPlaceholderText(/ask a health question/i);
    const buttons = screen.getAllByRole('button');
    const sendButton = buttons[buttons.length - 1];
    expect(sendButton).toHaveAttribute('disabled');
  });

  it('tracks analytics on send', async () => {
    const analytics = require('../utils/analytics').default;
    render(<ChatbotWidget />);
    fireEvent.click(screen.getByTitle(/open medbot/i));
    const input = await screen.findByPlaceholderText(/ask a health question/i);
    fireEvent.change(input, { target: { value: 'I have a headache' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(analytics.track).toHaveBeenCalledWith('chatbot_message', expect.any(Object))
    );
  });
});
