'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import { useToast } from '../../components/Toast';
import { supabase } from '../../../lib/supabase';

export default function AdminSupportPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState('waiting_agent');
  const channelRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => { fetchTickets(); }, [filter]);

  useEffect(() => {
    if (!selectedTicket) return;
    fetchMessages(selectedTicket.id);

    channelRef.current = supabase
      .channel(`admin-support-${selectedTicket.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'express_support_messages', filter: `ticket_id=eq.${selectedTicket.id}` },
        (payload) => setMessages(prev => [...prev, payload.new])
      ).subscribe();

    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [selectedTicket]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const fetchTickets = async () => {
    const url = filter ? `/api/support/tickets?status=${filter}` : '/api/support/tickets';
    const res = await fetch(url);
    const data = await res.json();
    setTickets(data.data || []);
  };

  const fetchMessages = async (ticketId) => {
    const res = await fetch(`/api/support/messages?ticketId=${ticketId}`);
    const data = await res.json();
    setMessages(data.data || []);
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedTicket) return;
    setSending(true);
    try {
      await fetch('/api/support/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: selectedTicket.id, content: input.trim() }),
      });
      setInput('');
      fetchMessages(selectedTicket.id);
    } catch {}
    finally { setSending(false); }
  };

  const card = { background: 'white', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' };
  const statusColor = { open: '#3b82f6', ai_handled: '#8b5cf6', waiting_agent: '#f59e0b', in_progress: '#059669', resolved: '#10b981', closed: '#64748b' };
  const categoryIcon = { delivery: '🚚', payment: '💳', account: '👤', driver: '🏍️', other: '❓' };

  if (!user || user.role !== 'admin') return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Support" />
      <div style={{ flex: 1, padding: '30px', display: 'flex', gap: '16px', maxWidth: '1200px' }}>
        {/* Ticket List */}
        <div style={{ width: '360px', flexShrink: 0 }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>💬 Support</h1>

          <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {[['waiting_agent', 'Waiting'], ['in_progress', 'Active'], ['open', 'Open'], ['', 'All']].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", background: filter === val ? '#3b82f6' : 'white', color: filter === val ? 'white' : '#64748b' }}>
                {label}
              </button>
            ))}
          </div>

          {tickets.map(t => (
            <div key={t.id} onClick={() => setSelectedTicket(t)}
              style={{ ...card, padding: '14px', marginBottom: '8px', cursor: 'pointer', borderLeft: selectedTicket?.id === t.id ? '3px solid #3b82f6' : '3px solid transparent' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{categoryIcon[t.category]} {t.subject}</span>
                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', background: `${statusColor[t.status]}15`, color: statusColor[t.status] }}>{t.status.replace(/_/g, ' ')}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>{t.user?.contact_name || 'User'} • {new Date(t.updated_at).toLocaleString()}</div>
            </div>
          ))}
          {tickets.length === 0 && <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '13px' }}>No tickets</div>}
        </div>

        {/* Chat Panel */}
        <div style={{ flex: 1, ...card, display: 'flex', flexDirection: 'column' }}>
          {!selectedTicket ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '14px' }}>
              Select a ticket to start chatting
            </div>
          ) : (
            <>
              <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{categoryIcon[selectedTicket.category]} {selectedTicket.subject}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{selectedTicket.user?.contact_name} ({selectedTicket.user?.email})</div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', background: `${statusColor[selectedTicket.status]}15`, color: statusColor[selectedTicket.status] }}>{selectedTicket.status.replace(/_/g, ' ')}</span>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', maxHeight: '60vh' }}>
                {messages.map(msg => (
                  <div key={msg.id} style={{ marginBottom: '10px', display: 'flex', justifyContent: msg.sender_type === 'admin' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '70%', padding: '10px 14px', borderRadius: '12px', fontSize: '13px', color: '#1e293b',
                      background: msg.sender_type === 'admin' ? '#eff6ff' : msg.sender_type === 'ai' ? '#f1f5f9' : '#f0fdf4',
                    }}>
                      {msg.sender_type !== 'admin' && <div style={{ fontSize: '11px', fontWeight: '600', color: msg.sender_type === 'ai' ? '#3b82f6' : '#059669', marginBottom: '4px' }}>{msg.sender_type === 'ai' ? '🤖 AI' : '👤 User'}</div>}
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>{new Date(msg.created_at).toLocaleTimeString()}</div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div style={{ padding: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px' }}>
                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Type your reply..." style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', fontFamily: "'Inter', sans-serif" }} />
                <button onClick={sendMessage} disabled={sending || !input.trim()}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", opacity: sending || !input.trim() ? 0.5 : 1 }}>
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
