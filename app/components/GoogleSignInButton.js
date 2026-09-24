'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';

// Renders Google's official "Continue with Google" button (Google Identity Services).
// Business clients only — the server refuses driver accounts.
export default function GoogleSignInButton({ text = 'continue_with', onError, referralCode }) {
  const router = useRouter();
  const { updateUser } = useAuth();
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;
    const init = () => {
      if (!window.google?.accounts?.id || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp) => {
          try {
            const res = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential: resp.credential, referral_code: referralCode || undefined }),
            });
            const result = await res.json();
            if (result.error) { onError?.(result.error); return; }
            updateUser?.(result.user);
            router.push(result.isNew ? '/client/settings?complete=1' : '/client/dashboard');
          } catch {
            onError?.('Google sign-in failed. Please try again.');
          }
        },
        ux_mode: 'popup',
        auto_select: false,
      });
      window.google.accounts.id.renderButton(ref.current, {
        type: 'standard', theme: 'outline', size: 'large', text, shape: 'pill', width: 340, logo_alignment: 'left',
      });
      setReady(true);
    };
    if (window.google?.accounts?.id) { init(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = init;
    document.head.appendChild(s);
  }, [clientId, text, referralCode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!clientId) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div ref={ref} style={{ minHeight: '44px' }} />
      {ready && <div style={{ fontSize: '11px', color: '#94a3b8' }}>For business customers · Drivers register with documents</div>}
    </div>
  );
}
