'use client';
import { useState, useEffect, useCallback } from 'react';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function usePushSubscription() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  const vapidKey = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY : null;

  useEffect(() => {
    const check = async () => {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !vapidKey) {
        console.log('[PUSH] Not supported — SW:', 'serviceWorker' in (typeof navigator !== 'undefined' ? navigator : {}), 'PushManager:', typeof window !== 'undefined' && 'PushManager' in window, 'VAPID:', !!vapidKey);
        setSupported(false);
        setLoading(false);
        return;
      }
      setSupported(true);
      setPermission(Notification.permission);
      console.log('[PUSH] Supported. Permission:', Notification.permission);

      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        console.log('[PUSH] Existing subscription:', sub ? 'yes' : 'none');
        setSubscribed(!!sub);
      } catch {
        setSubscribed(false);
      }
      setLoading(false);
    };
    check();
  }, [vapidKey]);

  const subscribe = useCallback(async () => {
    if (!supported) return false;
    setLoading(true);
    try {
      console.log('[PUSH] 1. Requesting permission...');
      const perm = await Notification.requestPermission();
      setPermission(perm);
      console.log('[PUSH] 2. Permission result:', perm);
      if (perm !== 'granted') { setLoading(false); return false; }

      const reg = await navigator.serviceWorker.ready;
      console.log('[PUSH] 3. SW ready, subscribing to push...');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const subJson = sub.toJSON();
      console.log('[PUSH] 4. Browser subscription created:', subJson.endpoint?.substring(0, 60));

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          },
          userAgent: navigator.userAgent,
        }),
      });

      const body = await res.json();
      console.log('[PUSH] 5. Server response:', res.status, body);

      if (!res.ok) {
        console.error('[PUSH] Server rejected subscription:', body.error);
        // Unsubscribe from browser since server didn't save it
        await sub.unsubscribe();
        setLoading(false);
        return false;
      }

      setSubscribed(true);
      setLoading(false);
      console.log('[PUSH] 6. Subscription complete!');
      return true;
    } catch (err) {
      console.error('[PUSH] Subscribe error:', err);
      setLoading(false);
      return false;
    }
  }, [supported, vapidKey]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return false;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setLoading(false);
      return true;
    } catch {
      setLoading(false);
      return false;
    }
  }, [supported]);

  return { supported, permission, subscribed, loading, subscribe, unsubscribe };
}
