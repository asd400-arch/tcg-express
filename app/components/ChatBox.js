'use client';
import { useState, useEffect, useRef } from 'react';
import { useToast } from './Toast';
import { supabase } from '../../lib/supabase';

export default function ChatBox({ jobId, userId, receiverId, userRole }) {
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!jobId) return;
    loadMessages();

    // Real-time subscription
    const channel = supabase
      .channel(`chat-${jobId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'express_messages',
        filter: `job_id=eq.${jobId}`,
      }, async (payload) => {
        const msg = payload.new;
        const { data: sender } = await supabase.from('express_users').select('contact_name, role').eq('id', msg.sender_id).single();
        msg.sender = sender;
        setMessages(prev => [...prev, msg]);
      })
      .subscribe();
    channelRef.current = channel;

    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [jobId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const loadMessages = async () => {
    const { data } = await supabase.from('express_messages').select('*, sender:sender_id(contact_name, role)').eq('job_id', jobId).order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const send = async () => {
    if (!newMsg.trim() || !receiverId) return;
    setSending(true);
    await supabase.from('express_messages').insert([{
      job_id: jobId, sender_id: userId, receiver_id: receiverId, content: newMsg.trim(),
    }]);
    setNewMsg('');
    setSending(false);
  };

  const sendImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSending(true);
    const path = `chat/${jobId}/${Date.now()}_${file.name}`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const result = await res.json();
    if (!result.url) { toast.error('Upload failed'); setSending(false); return; }
    await supabase.from('express_messages').insert([{
      job_id: jobId, sender_id: userId, receiver_id: receiverId,
      content: '📷 Photo', message_type: 'image', attachment_url: result.url,
    }]);
    setSending(false);
  };

  const myColor = userRole === 'driver' ? '#10b981' : '#3b82f6';
  const input = { flex: 1, padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif" };

  return (
    <div style={{ background: 'white', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '16px' }}>💬</span>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', margin: 0 }}>Messages</h3>
        <span style={{ fontSize: '12px', color: '#94a3b8' }}>• Real-time</span>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }}></span>
      </div>

      <div ref={scrollRef} style={{ height: '350px', overflowY: 'auto', padding: '16px', background: '#fafbfc' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
            <p style={{ color: '#94a3b8', fontSize: '13px' }}>No messages yet. Start the conversation!</p>
          </div>
        ) : messages.map(msg => {
          const isMine = msg.sender_id === userId;
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: '10px' }}>
              <div style={{
                maxWidth: '75%', borderRadius: '14px', overflow: 'hidden',
                background: isMine ? myColor : 'white',
                border: isMine ? 'none' : '1px solid #e2e8f0',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}>
                <div style={{ padding: '10px 14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: isMine ? 'rgba(255,255,255,0.7)' : '#94a3b8', marginBottom: '3px' }}>
                    {msg.sender?.contact_name} • {msg.sender?.role}
                  </div>
                  {msg.message_type === 'image' && msg.attachment_url && (
                    <img src={msg.attachment_url} alt="Shared photo" style={{ maxWidth: '200px', borderRadius: '8px', marginBottom: '6px', display: 'block' }} />
                  )}
                  <div style={{ fontSize: '14px', color: isMine ? 'white' : '#1e293b', lineHeight: '1.4' }}>{msg.content}</div>
                  <div style={{ fontSize: '10px', color: isMine ? 'rgba(255,255,255,0.5)' : '#c0c9d4', marginTop: '4px', textAlign: 'right' }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <label style={{ cursor: 'pointer', padding: '8px', borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '16px' }}>📷</span>
          <input type="file" accept="image/*" onChange={sendImage} style={{ display: 'none' }} disabled={sending || !receiverId} />
        </label>
        <input
          style={input}
          value={newMsg}
          onChange={e => setNewMsg(e.target.value)}
          placeholder={receiverId ? "Type a message..." : "Waiting for driver assignment..."}
          disabled={!receiverId || sending}
          onKeyDown={e => e.key === 'Enter' && send()}
        />
        <button onClick={send} disabled={sending || !receiverId || !newMsg.trim()} style={{
          padding: '10px 18px', borderRadius: '10px', border: 'none',
          background: myColor, color: 'white', fontSize: '14px', fontWeight: '600',
          cursor: 'pointer', fontFamily: "'Inter', sans-serif",
          opacity: (sending || !receiverId || !newMsg.trim()) ? 0.5 : 1,
        }}>Send</button>
      </div>

    </div>
  );
}
