/**
 * Medcare — ChatbotWidget (Phase 6)
 *
 * Enhancements:
 * - analytics.track on every user message (CHATBOT_MESSAGE event)
 * - Context awareness: passes last 10 messages as history to ML /chat
 * - Performance: debounce send, prevent double-submit
 * - Phase 7: "Was this helpful?" feedback button on each bot reply
 * - Feedback stored via saveChatFeedback (Firestore)
 * - Graceful error recovery: shows error bubble instead of silent failure
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { mlChat }            from '../services/mlApi';
import { useAuth }           from '../context/AuthContext';
import analytics, { EVENTS } from '../utils/analytics';
import logger                from '../utils/logger';
import { saveChatFeedback }  from '../firebase/firestore';

const WELCOME = {
  id:      'welcome',
  role:    'assistant',
  content: "👋 Hi! I'm **MedBot**, your AI health assistant on Medcare.\n\nI can answer general health questions, help you understand symptoms, and guide you on when to seek care.\n\n*Note: I'm an AI assistant — not a substitute for professional medical advice.*\n\nHow can I help you today?",
  ts:      new Date(),
  feedback: null,
};

const QUICK_Q = [
  'What should I do for a fever?',
  'When should I see a doctor?',
  'How can I manage stress?',
  'What are signs of dehydration?',
];

// Mini markdown renderer — bold, italic, code, newlines
const md = (text) =>
  (text || '')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       "<code class='bg-gray-100 px-1 rounded text-xs'>$1</code>")
    .replace(/\n/g,            '<br/>');

const Spinner = () => (
  <svg className='animate-spin w-3.5 h-3.5' fill='none' viewBox='0 0 24 24'>
    <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
    <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z' />
  </svg>
);

/** Single message bubble */
const Bubble = ({ msg, onFeedback }) => {
  const isUser = msg.role === 'user';
  const isErr  = msg.role === 'error';
  const time   = msg.ts
    ? new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
        isUser ? 'bg-primary text-white' : isErr ? 'bg-red-400 text-white' : 'bg-gradient-to-br from-secondary to-primary text-white'
      }`}>
        {isUser ? 'U' : 'M'}
      </div>

      <div className={`max-w-[82%] flex flex-col gap-0.5 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-primary text-white rounded-tr-sm'
              : isErr
              ? 'bg-red-50 border border-red-200 text-red-700 rounded-tl-sm'
              : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'
          }`}
          dangerouslySetInnerHTML={{ __html: md(msg.content) }}
        />
        {time && <span className='text-xs text-gray-400 px-1'>{time}</span>}

        {/* Phase 7: Feedback buttons on bot messages only */}
        {!isUser && !isErr && msg.id !== 'welcome' && onFeedback && (
          <div className='flex items-center gap-1 px-1'>
            {msg.feedback === null ? (
              <>
                <span className='text-xs text-gray-300 mr-1'>Helpful?</span>
                <button
                  onClick={() => onFeedback(msg.id, true)}
                  className='text-xs px-2 py-0.5 rounded-full border border-gray-200 text-gray-400 hover:border-green-400 hover:text-green-600 transition-all'
                  title='Yes, helpful'
                >
                  👍
                </button>
                <button
                  onClick={() => onFeedback(msg.id, false)}
                  className='text-xs px-2 py-0.5 rounded-full border border-gray-200 text-gray-400 hover:border-red-400 hover:text-red-600 transition-all'
                  title='Not helpful'
                >
                  👎
                </button>
              </>
            ) : (
              <span className='text-xs text-gray-400'>
                {msg.feedback ? '👍 Thanks!' : '👎 Got it'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const Typing = () => (
  <div className='flex gap-2 items-end'>
    <div className='w-7 h-7 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center text-xs font-bold text-white flex-shrink-0'>M</div>
    <div className='bg-white border border-gray-100 shadow-sm px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1'>
      {[0, 1, 2].map((i) => (
        <div key={i} className='w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce' style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  </div>
);

const ChatPanel = ({ onClose }) => {
  const { user }  = useAuth();
  const [messages, setMessages] = useState([WELCOME]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const sendingRef = useRef(false); // prevent double-submit

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  /** Phase 7: Handle thumbs up/down feedback */
  const handleFeedback = useCallback(async (msgId, helpful) => {
    setMessages((prev) =>
      prev.map((m) => m.id === msgId ? { ...m, feedback: helpful } : m),
    );
    try {
      const msg = messages.find((m) => m.id === msgId);
      if (user?.uid && msg) {
        await saveChatFeedback(user.uid, {
          messageId: msgId,
          content:   msg.content,
          helpful,
          ts:        new Date().toISOString(),
        });
      }
      analytics.track('chatbot_feedback', { helpful });
    } catch (err) {
      logger.warn('[ChatbotWidget] Feedback save failed', { error: err.message });
    }
  }, [messages, user]);

  const send = useCallback(async (text) => {
    const content = (text || input).trim();
    if (!content || loading || sendingRef.current) return;

    sendingRef.current = true;
    setInput('');

    const userMsg = {
      id:   `u-${Date.now()}`,
      role: 'user',
      content,
      ts:   new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    // Phase 6: Track chatbot usage
    analytics.track(EVENTS.CHATBOT_MESSAGE, { message_length: content.length });

    try {
      // Phase 6: Build context-aware history (last 10 messages)
      const history = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map(({ role, content: c }) => ({ role, content: c }));

      const { data } = await mlChat([...history, { role: 'user', content }]);

      const botMsg = {
        id:       `b-${Date.now()}`,
        role:     'assistant',
        content:  data.reply || 'Sorry, I could not generate a response.',
        ts:       new Date(),
        source:   data.source,
        feedback: null,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      logger.error('[ChatbotWidget] Chat request failed', err);
      setMessages((prev) => [...prev, {
        id:      `e-${Date.now()}`,
        role:    'error',
        content: 'Could not reach MedBot. Please check your connection or try again.',
        ts:      new Date(),
      }]);
    } finally {
      setLoading(false);
      sendingRef.current = false;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, loading, messages]);

  const handleClear = () => {
    setMessages([WELCOME]);
    setInput('');
  };

  return (
    <div className='flex flex-col h-full'>
      {/* Header */}
      <div className='px-4 py-3 bg-gradient-to-r from-primary to-primary-700 text-white flex items-center justify-between flex-shrink-0 rounded-t-2xl'>
        <div className='flex items-center gap-2'>
          <div className='w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-base'>🤖</div>
          <div>
            <p className='font-display font-semibold text-sm'>MedBot</p>
            <p className='text-xs text-white/70'>AI Health Assistant</p>
          </div>
          <span className='ml-2 w-2 h-2 bg-green-400 rounded-full animate-pulse' title='Online' />
        </div>
        <div className='flex items-center gap-1'>
          <button onClick={handleClear} className='text-white/60 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-white/10 transition-all'>
            Clear
          </button>
          <button onClick={onClose} className='text-white/60 hover:text-white w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-xl font-bold transition-all'>
            ×
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className='bg-amber-50 border-b border-amber-100 px-3 py-1.5 text-xs text-amber-700 flex items-center gap-1.5 flex-shrink-0'>
        <span>⚠️</span>
        <span>AI only — not a substitute for professional medical advice.</span>
      </div>

      {/* Messages */}
      <div className='flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50'>
        {messages.map((msg) => (
          <Bubble key={msg.id} msg={msg} onFeedback={handleFeedback} />
        ))}
        {loading && <Typing />}
        <div ref={bottomRef} />
      </div>

      {/* Quick questions — shown only on first message */}
      {messages.length === 1 && (
        <div className='px-4 py-2 bg-gray-50 border-t border-gray-100 flex-shrink-0'>
          <p className='text-xs text-gray-400 mb-1.5 font-medium'>Suggested questions:</p>
          <div className='flex flex-wrap gap-1.5'>
            {QUICK_Q.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className='text-xs px-2.5 py-1.5 bg-white border border-gray-200 rounded-full hover:border-primary hover:text-primary transition-all text-gray-600'
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className='px-3 py-3 bg-white border-t border-gray-100 rounded-b-2xl flex-shrink-0'>
        <div className='flex items-end gap-2'>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder='Ask a health question…'
            rows={1}
            className='flex-1 resize-none px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all bg-gray-50 max-h-24'
            style={{ minHeight: '38px' }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className='w-9 h-9 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0'
          >
            {loading ? <Spinner /> : (
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 19l9 2-9-18-9 18 9-2zm0 0v-8' />
              </svg>
            )}
          </button>
        </div>
        <p className='text-xs text-gray-300 mt-1.5 text-center'>Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
};

/* Floating button + panel */
const ChatbotWidget = () => {
  const [open,    setOpen]    = useState(false);
  const [pulsing, setPulsing] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setPulsing(false), 6000);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {!open && (
        <button
          onClick={() => { setOpen(true); setPulsing(false); }}
          className={`fixed bottom-6 right-6 w-14 h-14 bg-primary text-white rounded-2xl shadow-xl flex items-center justify-center hover:bg-primary-600 hover:scale-110 active:scale-95 transition-all z-50 ${pulsing ? 'animate-pulse-ring' : ''}`}
          title='Open MedBot AI Assistant'
        >
          <span className='text-2xl'>🤖</span>
          {pulsing && (
            <span className='absolute -top-1 -right-1 w-4 h-4 bg-secondary rounded-full border-2 border-white animate-bounce' />
          )}
        </button>
      )}
      {open && (
        <div className='fixed bottom-6 right-6 w-[360px] h-[580px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col z-50 overflow-hidden animate-fade-in'>
          <ChatPanel onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  );
};

export default ChatbotWidget;
