'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import usePushSubscription from './usePushSubscription';

const DISMISS_KEY = 'push_prompt_dismissed';

export default function PushPromptBanner() {
  const { user } = useAuth();
  const push = usePushSubscription();
  const [visible, setVisible] = useState(false);
  const autoSubAttempted = useRef(false);

  useEffect(() => {
    if (!user || !push.supported || push.loading) return;

    // Already subscribed or permission denied — nothing to do
    if (push.subscribed || push.permission === 'denied') return;

    // Permission already granted but not subscribed — auto-subscribe silently
    if (push.permission === 'granted' && !autoSubAttempted.current) {
      autoSubAttempted.current = true;
      push.subscribe();
      return;
    }

    // Permission is 'default' — show banner (unless dismissed this session)
    if (push.permission === 'default') {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
      setVisible(true);
    }
  }, [user, push.supported, push.subscribed, push.permission, push.loading]);

  // Hide banner once subscribed (after user clicks Allow)
  useEffect(() => {
    if (push.subscribed) setVisible(false);
  }, [push.subscribed]);

  const handleAllow = async () => {
    const ok = await push.subscribe();
    if (!ok && push.permission === 'denied') {
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 1000, width: 'calc(100% - 32px)', maxWidth: '420px',
      background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
      borderRadius: '14px', padding: '14px 18px',
      boxShadow: '0 8px 32px rgba(59, 130, 246, 0.35)',
      display: 'flex', alignItems: 'center', gap: '12px',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ fontSize: '24px', flexShrink: 0 }}>🔔</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: 'white' }}>
          Enable Delivery Notifications
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', marginTop: '1px' }}>
          Get instant alerts for jobs, bids &amp; deliveries
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button onClick={handleDismiss} style={{
          padding: '7px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.3)',
          background: 'transparent', color: 'rgba(255,255,255,0.8)', fontSize: '12px',
          fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
        }}>Later</button>
        <button onClick={handleAllow} disabled={push.loading} style={{
          padding: '7px 14px', borderRadius: '8px', border: 'none',
          background: 'white', color: '#1e40af', fontSize: '12px',
          fontWeight: '700', cursor: push.loading ? 'not-allowed' : 'pointer',
          fontFamily: "'Inter', sans-serif", opacity: push.loading ? 0.7 : 1,
        }}>{push.loading ? '...' : 'Allow'}</button>
      </div>
    </div>
  );
}
