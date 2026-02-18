'use client';
import { useState } from 'react';
import usePushSubscription from './usePushSubscription';

const CATEGORIES = [
  { key: 'job_updates', label: 'Job Updates', desc: 'Cancellations, disputes' },
  { key: 'bid_activity', label: 'Bid Activity', desc: 'New bids, bid accepted' },
  { key: 'delivery_status', label: 'Delivery Status', desc: 'Status changes, confirmations' },
  { key: 'account_alerts', label: 'Account Alerts', desc: 'Approvals, rejections' },
];

const DEFAULT_PREFS = {
  job_updates: { email: true, push: true },
  bid_activity: { email: true, push: true },
  delivery_status: { email: true, push: true },
  account_alerts: { email: true, push: true },
};

export default function NotificationPreferences({ user, onSave, toast }) {
  const push = usePushSubscription();
  const [prefs, setPrefs] = useState(user?.notification_preferences || DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);

  const toggleChannel = (category, channel) => {
    setPrefs(prev => ({
      ...prev,
      [category]: { ...prev[category], [channel]: !prev[category]?.[channel] },
    }));
  };

  const savePrefs = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { notification_preferences: prefs } }),
      });
      const result = await res.json();
      if (result.error) { toast.error(result.error); }
      else { onSave(result.data); toast.success('Notification preferences saved'); }
    } catch { toast.error('Failed to save preferences'); }
    setSaving(false);
  };

  const handlePushToggle = async () => {
    if (push.subscribed) {
      const ok = await push.unsubscribe();
      if (ok) toast.success('Push notifications disabled');
      else toast.error('Failed to disable push notifications');
    } else {
      const ok = await push.subscribe();
      if (ok) toast.success('Push notifications enabled');
      else if (push.permission === 'denied') toast.error('Push notifications blocked. Please enable them in your browser settings.');
      else toast.error('Failed to enable push notifications');
    }
  };

  const card = { background: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '20px' };
  const toggleStyle = (active) => ({
    width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
    background: active ? '#10b981' : '#cbd5e1', position: 'relative', transition: 'background 0.2s',
    flexShrink: 0,
  });
  const toggleDot = (active) => ({
    width: '18px', height: '18px', borderRadius: '50%', background: 'white',
    position: 'absolute', top: '3px', left: active ? '23px' : '3px', transition: 'left 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  });

  return (
    <div style={card}>
      <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Notification Preferences</h3>

      {/* Push notifications master toggle */}
      {push.supported && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#f8fafc', borderRadius: '10px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Push Notifications</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              {push.permission === 'denied'
                ? 'Blocked in browser settings'
                : push.subscribed
                  ? 'Receiving push notifications'
                  : 'Enable browser push notifications'}
            </div>
          </div>
          <button
            onClick={handlePushToggle}
            disabled={push.loading || push.permission === 'denied'}
            style={{ ...toggleStyle(push.subscribed), opacity: (push.loading || push.permission === 'denied') ? 0.5 : 1 }}
          >
            <div style={toggleDot(push.subscribed)} />
          </button>
        </div>
      )}

      {/* Per-category preferences */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px', gap: '8px', marginBottom: '8px', padding: '0 4px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>Category</div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', textAlign: 'center' }}>Email</div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', textAlign: 'center' }}>Push</div>
        </div>
        {CATEGORIES.map(cat => (
          <div key={cat.key} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px', gap: '8px', alignItems: 'center', padding: '10px 4px', borderBottom: '1px solid #f1f5f9' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{cat.label}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>{cat.desc}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button onClick={() => toggleChannel(cat.key, 'email')} style={toggleStyle(prefs[cat.key]?.email !== false)}>
                <div style={toggleDot(prefs[cat.key]?.email !== false)} />
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button onClick={() => toggleChannel(cat.key, 'push')} style={toggleStyle(prefs[cat.key]?.push !== false)}>
                <div style={toggleDot(prefs[cat.key]?.push !== false)} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={savePrefs} disabled={saving} style={{
        padding: '12px 24px', borderRadius: '10px', border: 'none',
        background: 'linear-gradient(135deg, #3b82f6, #3b82f6dd)', color: 'white',
        fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
        opacity: saving ? 0.7 : 1,
      }}>
        {saving ? 'Saving...' : 'Save Preferences'}
      </button>
    </div>
  );
}
