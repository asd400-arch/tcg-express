'use client';
import { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import usePushSubscription from './usePushSubscription';

const DISMISS_KEY = 'push_prompt_dismissed_at';
const DISMISS_HOURS = 24;

export default function PushPromptBanner() {
  const { user } = useAuth();
  const push = usePushSubscription();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user || !push.supported || push.loading) return;
    // Already subscribed or permission denied — don't show
    if (push.subscribed || push.permission === 'denied') return;
    // Check if dismissed recently
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const hoursSince = (Date.now() - parseInt(dismissedAt, 10)) / 3600000;
      if (hoursSince < DISMISS_HOURS) return;
    }
    setVisible(true);
  }, [user, push.supported, push.subscribed, push.permission, push.loading]);

  const handleAllow = async () => {
    const ok = await push.subscribe();
    if (ok) {
      setVisible(false);
    }
    // If permission denied, hide banner (no point showing again)
    if (push.permission === 'denied') {
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 1000, width: 'calc(100% - 32px)', maxWidth: '420px',
      background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
      borderRadius: '14px', padding: '16px 20px',
      boxShadow: '0 8px 32px rgba(59, 130, 246, 0.35)',
      display: 'flex', alignItems: 'center', gap: '14px',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ fontSize: '28px', flexShrink: 0 }}>🔔</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: '700', color: 'white', marginBottom: '2px' }}>
          Enable Delivery Notifications
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
          Get instant alerts for jobs, bids, and deliveries
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button onClick={handleDismiss} style={{
          padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.3)',
          background: 'transparent', color: 'rgba(255,255,255,0.8)', fontSize: '12px',
          fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
        }}>Later</button>
        <button onClick={handleAllow} disabled={push.loading} style={{
          padding: '8px 16px', borderRadius: '8px', border: 'none',
          background: 'white', color: '#1e40af', fontSize: '12px',
          fontWeight: '700', cursor: push.loading ? 'not-allowed' : 'pointer',
          fontFamily: "'Inter', sans-serif", opacity: push.loading ? 0.7 : 1,
        }}>{push.loading ? '...' : 'Allow'}</button>
      </div>
    </div>
  );
}
