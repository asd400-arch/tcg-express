'use client';

import React, { useState, useRef, useEffect } from 'react';
import useMobile from '../useMobile';
import { useChatbot, useCreateTicket } from '@/lib/hooks/useHelp';
import { HELP_CONSTANTS } from '@/types/help';

// ============================================================
// Constants
// ============================================================

const font = "'Inter', sans-serif";

const QUICK_PROMPTS = [
  'How do I book a delivery?',
  'How to top up wallet?',
  'Become a driver',
  'Damage claim process',
];

// ============================================================
// Floating ChatWidget
// ============================================================

export default function ChatWidget() {
  const m = useMobile();
  const [open, setOpen] = useState(false);

  return (
    <>
      <style>{`
        @keyframes chatBounce1 { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
        @keyframes chatBounce2 { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
        @keyframes chatBounce3 { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
        @keyframes chatSlideUp { from { opacity: 0; transform: translateY(16px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes chatFabPulse { 0%,100% { box-shadow: 0 4px 16px rgba(59,130,246,0.4); } 50% { box-shadow: 0 4px 24px rgba(59,130,246,0.6); } }
      `}</style>

      {/* Chat Panel */}
      {open && <ChatPanel m={m} onClose={() => setOpen(false)} />}

      {/* FAB Toggle */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed',
            bottom: m ? '20px' : '28px',
            right: m ? '20px' : '28px',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: 'none',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            color: 'white',
            fontSize: '20px',
            fontWeight: '700',
            cursor: 'pointer',
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(59,130,246,0.4)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 24px rgba(59,130,246,0.6)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(59,130,246,0.4)';
          }}
        >
          ?
        </button>
      )}
    </>
  );
}

// ============================================================
// Chat Panel
// ============================================================

function ChatPanel({ m, onClose }: { m: boolean; onClose: () => void }) {
  const {
    messages,
    sessionId,
    loading,
    suggestEscalation,
    error,
    sendMessage,
    resetChat,
  } = useChatbot();

  const {
    createTicket,
    loading: ticketLoading,
    error: ticketError,
    ticketNumber,
  } = useCreateTicket();

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, loading, ticketNumber]);

  const handleSend = (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    sendMessage(msg);
    if (!text) setInput('');
  };

  const handleEscalate = async () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    await createTicket({
      subject: lastUserMsg ? lastUserMsg.content.slice(0, 100) : 'Chat escalation',
      description: messages.map((m) => `${m.role}: ${m.content}`).join('\n').slice(0, 2000),
      category: 'other',
      priority: 'normal',
      chat_session_id: sessionId || undefined,
    });
  };

  const handleReset = () => {
    resetChat();
    setInput('');
  };

  // --- Panel container ---
  const panelStyle: React.CSSProperties = m
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        background: 'white',
        animation: 'chatSlideUp 0.25s ease-out',
      }
    : {
        position: 'fixed',
        bottom: '28px',
        right: '28px',
        width: '400px',
        height: '600px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        background: 'white',
        borderRadius: '20px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.16)',
        overflow: 'hidden',
        animation: 'chatSlideUp 0.25s ease-out',
      };

  return (
    <div style={panelStyle}>
      {/* ---- Header ---- */}
      <div
        style={{
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8, #1e40af)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Bot avatar */}
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
            }}
          >
            &#129302;
          </div>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: '15px',
                fontWeight: '700',
                color: 'white',
                fontFamily: font,
              }}
            >
              TCG Support Bot
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: '#4ade80',
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', fontFamily: font }}>
                Online
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {messages.length > 0 && (
            <button
              onClick={handleReset}
              title="New chat"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(255,255,255,0.1)',
                color: 'white',
                fontSize: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              &#8635;
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            &#10005;
          </button>
        </div>
      </div>

      {/* ---- Messages area ---- */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 16px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          background: '#fafbfc',
        }}
      >
        {/* Welcome screen */}
        {messages.length === 0 && !loading && (
          <div style={{ padding: '20px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: '44px', marginBottom: '12px' }}>&#128075;</div>
            <p
              style={{
                margin: '0 0 4px',
                fontSize: '17px',
                fontWeight: '700',
                color: '#1e293b',
                fontFamily: font,
              }}
            >
              Hi there!
            </p>
            <p
              style={{
                margin: '0 0 20px',
                fontSize: '14px',
                color: '#64748b',
                fontFamily: font,
                lineHeight: '1.5',
              }}
            >
              I&apos;m your TCG Express support assistant. Ask me anything or choose a topic below.
            </p>

            {/* Quick prompts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  style={{
                    padding: '11px 16px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    background: 'white',
                    color: '#3b82f6',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: font,
                    textAlign: 'left',
                    transition: 'background 0.15s, border-color 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = '#eff6ff';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#bfdbfe';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'white';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0';
                  }}
                >
                  <span style={{ color: '#94a3b8', fontSize: '14px' }}>&#10148;</span>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const time = formatTime(msg.timestamp);
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                marginBottom: '4px',
              }}
            >
              <div
                style={{
                  maxWidth: '82%',
                  padding: '11px 15px',
                  borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: isUser
                    ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                    : 'white',
                  color: isUser ? 'white' : '#1e293b',
                  border: isUser ? 'none' : '1px solid #e9ecef',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  fontFamily: font,
                  wordBreak: 'break-word',
                  boxShadow: isUser ? 'none' : '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                {isUser ? msg.content : <BotMarkdown text={msg.content} />}
              </div>
              <span
                style={{
                  fontSize: '10px',
                  color: '#94a3b8',
                  marginTop: '3px',
                  fontFamily: font,
                  padding: isUser ? '0 4px 0 0' : '0 0 0 4px',
                }}
              >
                {time}
              </span>
            </div>
          );
        })}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '4px' }}>
            <div
              style={{
                padding: '12px 18px',
                borderRadius: '14px 14px 14px 4px',
                background: 'white',
                border: '1px solid #e9ecef',
                display: 'flex',
                gap: '5px',
                alignItems: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: '#94a3b8',
                    display: 'inline-block',
                    animation: `chatBounce${i + 1} 1.2s ease-in-out infinite`,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div
            style={{
              textAlign: 'center',
              fontSize: '13px',
              color: '#ef4444',
              fontFamily: font,
              padding: '4px 0',
            }}
          >
            {error}
          </div>
        )}

        {/* Escalation prompt */}
        {suggestEscalation && !loading && !ticketNumber && (
          <div
            style={{
              margin: '8px 0',
              padding: '14px 16px',
              background: '#fffbeb',
              borderRadius: '14px',
              border: '1px solid #fde68a',
              textAlign: 'center',
            }}
          >
            <p
              style={{
                margin: '0 0 10px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#92400e',
                fontFamily: font,
              }}
            >
              It looks like you might need more help. Would you like to speak with a support agent?
            </p>
            <button
              onClick={handleEscalate}
              disabled={ticketLoading}
              style={{
                padding: '9px 22px',
                borderRadius: '10px',
                border: 'none',
                background: ticketLoading
                  ? '#e2e8f0'
                  : 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: ticketLoading ? '#94a3b8' : 'white',
                fontSize: '13px',
                fontWeight: '700',
                cursor: ticketLoading ? 'not-allowed' : 'pointer',
                fontFamily: font,
              }}
            >
              {ticketLoading ? 'Creating...' : 'Create Support Ticket'}
            </button>
            {ticketError && (
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#ef4444', fontFamily: font }}>
                {ticketError}
              </p>
            )}
          </div>
        )}

        {/* Ticket confirmation */}
        {ticketNumber && (
          <div
            style={{
              margin: '8px 0',
              padding: '16px',
              background: '#f0fdf4',
              borderRadius: '14px',
              border: '1px solid #bbf7d0',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px',
                fontSize: '20px',
                color: 'white',
              }}
            >
              &#10003;
            </div>
            <p
              style={{
                margin: '0 0 4px',
                fontSize: '14px',
                fontWeight: '700',
                color: '#065f46',
                fontFamily: font,
              }}
            >
              Ticket Created
            </p>
            <div
              style={{
                display: 'inline-block',
                padding: '6px 16px',
                borderRadius: '8px',
                background: 'white',
                border: '1px solid #bbf7d0',
                fontSize: '16px',
                fontWeight: '700',
                color: '#059669',
                fontFamily: font,
                letterSpacing: '0.5px',
                margin: '6px 0',
              }}
            >
              {ticketNumber}
            </div>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: '12px',
                color: '#64748b',
                fontFamily: font,
              }}
            >
              Our team will respond within 24 hours.
            </p>
          </div>
        )}
      </div>

      {/* ---- Input bar ---- */}
      <div
        style={{
          padding: '10px 16px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          background: 'white',
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          maxLength={HELP_CONSTANTS.MAX_MESSAGE_LENGTH}
          disabled={loading}
          style={{
            flex: 1,
            padding: '11px 14px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            background: '#f8fafc',
            fontSize: '14px',
            color: '#1e293b',
            outline: 'none',
            fontFamily: font,
            boxSizing: 'border-box',
            opacity: loading ? 0.6 : 1,
          }}
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            border: 'none',
            background:
              input.trim() && !loading
                ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                : '#e2e8f0',
            color: input.trim() && !loading ? 'white' : '#94a3b8',
            fontSize: '17px',
            cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          &#10148;
        </button>
      </div>

      {/* ---- Footer ---- */}
      <div
        style={{
          textAlign: 'center',
          padding: '6px 16px 10px',
          background: 'white',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '10px',
            color: '#cbd5e1',
            fontFamily: font,
          }}
        >
          Powered by Claude AI
        </span>
      </div>
    </div>
  );
}

// ============================================================
// BotMarkdown — simple inline markdown for bot responses
// ============================================================

function BotMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (trimmed.startsWith('### ')) {
      elements.push(
        <div key={i} style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b', margin: '8px 0 4px', fontFamily: font }}>
          {renderInline(trimmed.slice(4))}
        </div>
      );
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <div key={i} style={{ fontWeight: '700', fontSize: '14px', color: '#1e293b', margin: '8px 0 4px', fontFamily: font }}>
          {renderInline(trimmed.slice(3))}
        </div>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '6px', margin: '2px 0', paddingLeft: '4px' }}>
          <span style={{ color: '#3b82f6', fontWeight: '600', flexShrink: 0 }}>
            {trimmed.match(/^\d+/)![0]}.
          </span>
          <span>{renderInline(trimmed.replace(/^\d+\.\s*/, ''))}</span>
        </div>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '6px', margin: '2px 0', paddingLeft: '4px' }}>
          <span style={{ color: '#3b82f6', flexShrink: 0 }}>&#8226;</span>
          <span>{renderInline(trimmed.slice(2))}</span>
        </div>
      );
    } else if (!trimmed) {
      elements.push(<div key={i} style={{ height: '6px' }} />);
    } else {
      elements.push(
        <div key={i} style={{ margin: '2px 0' }}>
          {renderInline(trimmed)}
        </div>
      );
    }
  }

  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(`(.+?)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(
        <strong key={match.index} style={{ fontWeight: '700', color: '#1e293b' }}>
          {match[2]}
        </strong>
      );
    } else if (match[4]) {
      parts.push(
        <code
          key={match.index}
          style={{
            background: '#f1f5f9',
            padding: '1px 4px',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#7c3aed',
          }}
        >
          {match[4]}
        </code>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

// ============================================================
// Helper
// ============================================================

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
