'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../../lib/supabase';

const CATEGORIES = [
  { key: 'delivery', icon: '🚚', label: 'Delivery Issue' },
  { key: 'payment', icon: '💳', label: 'Payment Issue' },
  { key: 'account', icon: '👤', label: 'Account Issue' },
  { key: 'driver', icon: '🏍️', label: 'Driver Issue' },
  { key: 'other', icon: '❓', label: 'Other' },
];

export default function SupportChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    if (ticket) {
      fetchMessages();
      // Subscribe to real-time messages
      channelRef.current = supabase
        .channel(`support-${ticket.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'express_support_messages',
          filter: `ticket_id=eq.${ticket.id}`,
        }, (payload) => {
          setMessages(prev => [...prev, payload.new]);
          if (!open) setUnread(prev => prev + 1);
        })
        .subscribe();

      return () => {
        if (channelRef.current) supabase.removeChannel(channelRef.current);
      };
    }
  }, [ticket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    if (!ticket) return;
    const res = await fetch(`/api/support/messages?ticketId=${ticket.id}`);
    const data = await res.json();
    setMessages(data.data || []);
  };

  const createTicket = async (category) => {
    const res = await fetch('/api/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, subject: `${category} support request` }),
    });
    const data = await res.json();
    setTicket(data.data);
  };

  const sendMessage = async (requestAgent = false) => {
    if (!input.trim() && !requestAgent) return;
    setSending(true);
    try {
      await fetch('/api/support/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.id,
          content: requestAgent ? 'Requesting live agent support' : input.trim(),
          requestAgent,
        }),
      });
      setInput('');
      fetchMessages();
    } catch {}
    finally { setSending(false); }
  };

  const handleOpen = () => {
    setOpen(!open);
    setUnread(0);
  };

  if (!user || user.role === 'admin') return null;

  const s = {
    btn: { position: 'fixed', bottom: '24px', right: '24px', width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(59,130,246,0.4)', zIndex: 1000, fontSize: '24px', color: 'white' },
    panel: { position: 'fixed', bottom: '90px', right: '24px', width: '360px', maxHeight: '500px', background: 'white', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 1000, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #e2e8f0' },
    header: { padding: '16px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white' },
    body: { flex: 1, overflowY: 'auto', padding: '16px', maxHeight: '340px', minHeight: '200px' },
    footer: { padding: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px' },
    msgUser: { background: '#eff6ff', borderRadius: '12px 12px 0 12px', padding: '10px 14px', maxWidth: '80%', marginLeft: 'auto', marginBottom: '8px', fontSize: '13px', color: '#1e293b' },
    msgAi: { background: '#f1f5f9', borderRadius: '12px 12px 12px 0', padding: '10px 14px', maxWidth: '80%', marginBottom: '8px', fontSize: '13px', color: '#1e293b' },
    msgAdmin: { background: '#f0fdf4', borderRadius: '12px 12px 12px 0', padding: '10px 14px', maxWidth: '80%', marginBottom: '8px', fontSize: '13px', color: '#1e293b', border: '1px solid #bbf7d0' },
  };

  return (
    <>
      {/* Floating Button */}
      <button style={s.btn} onClick={handleOpen}>
        {open ? '✕' : '💬'}
        {unread > 0 && !open && (
          <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ef4444', borderRadius: '50%', width: '20px', height: '20px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: 'white' }}>{unread}</span>
        )}
      </button>

      {/* Chat Panel */}
      {open && (
        <div style={s.panel}>
          <div style={s.header}>
            <div style={{ fontSize: '15px', fontWeight: '700' }}>
              {ticket ? (ticket.status === 'waiting_agent' || ticket.status === 'in_progress' ? '👨‍💼 Live Support' : '🤖 AI Assistant') : '💬 Help & Support'}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>
              {ticket ? `Ticket: ${ticket.category}` : 'How can we help you?'}
            </div>
          </div>

          <div style={s.body}>
            {!ticket ? (
              <div>
                <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>Select your issue type:</div>
                {CATEGORIES.map(cat => (
                  <button key={cat.key} onClick={() => createTicket(cat.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px',
                      borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer',
                      marginBottom: '8px', fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: '500',
                      color: '#1e293b', textAlign: 'left',
                    }}>
                    <span style={{ fontSize: '20px' }}>{cat.icon}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
            ) : (
              <>
                {messages.map(msg => (
                  <div key={msg.id} style={msg.sender_type === 'user' ? s.msgUser : msg.sender_type === 'admin' ? s.msgAdmin : s.msgAi}>
                    {msg.sender_type === 'ai' && <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: '600', marginBottom: '4px' }}>🤖 AI Assistant</div>}
                    {msg.sender_type === 'admin' && <div style={{ fontSize: '11px', color: '#059669', fontWeight: '600', marginBottom: '4px' }}>👨‍💼 Support Agent</div>}
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  </div>
                ))}
                {ticket.status === 'ai_handled' && (
                  <button onClick={() => sendMessage(true)}
                    style={{
                      width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #f59e0b',
                      background: '#fffbeb', color: '#92400e', fontSize: '12px', fontWeight: '600',
                      cursor: 'pointer', fontFamily: "'Inter', sans-serif", marginTop: '8px',
                    }}>
                    👨‍💼 Connect to Live Agent
                  </button>
                )}
                {ticket.status === 'waiting_agent' && (
                  <div style={{ textAlign: 'center', padding: '12px', background: '#fef3c7', borderRadius: '8px', fontSize: '12px', color: '#92400e', marginTop: '8px' }}>
                    ⏳ Waiting for an agent to join...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {ticket && (
            <div style={s.footer}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', fontFamily: "'Inter', sans-serif" }}
              />
              <button onClick={() => sendMessage()} disabled={sending || !input.trim()}
                style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", opacity: sending || !input.trim() ? 0.5 : 1 }}>
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
