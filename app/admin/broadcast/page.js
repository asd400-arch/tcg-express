'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import { useToast } from '../../components/Toast';

const AUDIENCE_OPTIONS = [
  { value: 'test', label: 'Test (@techchainglobal.com)' },
  { value: 'drivers', label: 'Drivers (approved & active)' },
  { value: 'customers', label: 'Customers (active)' },
  { value: 'all', label: 'All users' },
];

const AUDIENCE_COLORS = {
  test: { bg: '#fef3c7', color: '#92400e' },
  drivers: { bg: '#ecfdf5', color: '#065f46' },
  customers: { bg: '#eff6ff', color: '#1e40af' },
  all: { bg: '#f3e8ff', color: '#6b21a8' },
};

export default function AdminBroadcastPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('test');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/admin/broadcast');
      const data = await res.json();
      setHistory(data.data || []);
    } catch {
      toast.error('Failed to load broadcast history');
    }
    setHistoryLoading(false);
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required');
      return;
    }

    // Get recipient count first
    setSending(true);
    try {
      const countRes = await fetch(`/api/admin/broadcast?count_only=1&audience=${audience}`);
      const countData = await countRes.json();

      if (!countData.count) {
        toast.error('No users match this audience');
        setSending(false);
        return;
      }

      const confirmed = window.confirm(
        `Send to ${countData.count} recipient(s)?\n\nTitle: ${title}\nAudience: ${AUDIENCE_OPTIONS.find(o => o.value === audience)?.label}`,
      );
      if (!confirmed) { setSending(false); return; }

      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, audience }),
      });
      const result = await res.json();

      if (res.ok) {
        toast.success(`Sent: ${result.sent_count}, Failed: ${result.failed_count}`);
        setTitle('');
        setMessage('');
        setAudience('test');
        fetchHistory();
      } else {
        toast.error(result.error || 'Broadcast failed');
      }
    } catch {
      toast.error('Network error');
    }
    setSending(false);
  };

  if (!user || user.role !== 'admin') return null;

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '16px' };
  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box', marginBottom: '10px' };
  const label = { fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px', display: 'block' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Broadcast" />
      <div style={{ flex: 1, padding: '30px', maxWidth: '900px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>Broadcast</h1>

        {/* Send form */}
        <div style={card}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>New Broadcast</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={label}>Title *</label>
              <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="Notification title" />
            </div>
            <div>
              <label style={label}>Audience *</label>
              <select style={inputStyle} value={audience} onChange={e => setAudience(e.target.value)}>
                {AUDIENCE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <label style={label}>Message *</label>
          <textarea
            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Notification message body"
          />

          {/* Warning for non-test */}
          {audience !== 'test' && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: '8px', marginBottom: '10px', fontSize: '13px', color: '#991b1b' }}>
              This will send real notifications to {audience === 'all' ? 'ALL users' : audience === 'drivers' ? 'all approved drivers' : 'all active customers'}.
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              padding: '10px 24px', borderRadius: '8px', border: 'none',
              background: sending ? '#94a3b8' : '#1a56db', color: 'white',
              fontSize: '13px', fontWeight: '600', cursor: sending ? 'default' : 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {sending ? 'Sending...' : 'Send Broadcast'}
          </button>
        </div>

        {/* History */}
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>Recent Broadcasts</h3>

        {historyLoading ? (
          <p style={{ color: '#64748b' }}>Loading...</p>
        ) : history.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>No broadcasts yet.</p>
        ) : (
          history.map(b => {
            const ac = AUDIENCE_COLORS[b.audience] || AUDIENCE_COLORS.all;
            return (
              <div key={b.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>{b.title}</div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {b.message.length > 120 ? b.message.slice(0, 120) + '...' : b.message}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: ac.bg, color: ac.color }}>
                      {b.audience}
                    </span>
                    <span style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>
                      {b.sent_count} sent
                    </span>
                    {b.failed_count > 0 && (
                      <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: '600' }}>
                        {b.failed_count} failed
                      </span>
                    )}
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {new Date(b.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
