'use client';
import { useEffect, useState } from 'react';

// Set when store listings are live. Leave empty to hide the badge.
const APP_STORE_URL = ''; // e.g. 'https://apps.apple.com/sg/app/tcg-express/idXXXXXXXXXX'
const PLAY_STORE_URL = ''; // pending — closed testing ends late Aug

const NAVY = '#070D1A';
const NAVY2 = '#0C1B35';
const BLUE = '#2398EC';
const BLUE_GRAD = 'linear-gradient(90deg, #2485EB 0%, #23A6EC 100%)';
const LIGHT_BLUE = '#6EC8F5';

const LAUNCH_TS = new Date('2026-09-01T00:00:00+08:00').getTime();

function useCountdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, LAUNCH_TS - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s, live: diff === 0 };
}

export default function PreviewPage() {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('customer');
  const [status, setStatus] = useState('idle'); // idle | sending | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const [ref, setRef] = useState(null);
  const { d, h, m, s, live } = useCountdown();

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get('ref');
    if (r) setRef(r.toUpperCase());
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    setErrorMsg('');
    try {
      const res = await fetch('/api/preview-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, company, role, ref: ref || 'PREVIEW' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    }
  }

  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${NAVY} 0%, ${NAVY2} 100%)`, color: '#fff', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, maxWidth: 560, width: '100%', margin: '0 auto', padding: '48px 24px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

        <img src="/icons/icon-192x192.png" alt="TCG Express" width={84} height={84} style={{ borderRadius: 20, boxShadow: '0 8px 30px rgba(35,152,236,0.35)' }} />

        <div style={{ marginTop: 22, fontWeight: 800, fontSize: 13, letterSpacing: '0.28em', color: BLUE }}>
          {live ? 'WE ARE LIVE' : 'LAUNCHING 1 SEPTEMBER'}
        </div>

        <h1 style={{ marginTop: 12, fontSize: 34, lineHeight: 1.15, fontWeight: 800 }}>
          Singapore&apos;s delivery platform, built for <span style={{ color: LIGHT_BLUE }}>tech equipment</span>.
        </h1>

        <p style={{ marginTop: 14, fontSize: 16, lineHeight: 1.55, color: '#cbd5e1' }}>
          Servers, displays, POS, networking gear — post a job, get driver bids in minutes, track door to door, invoices handled.
        </p>

        {!live && (
          <div style={{ marginTop: 22, display: 'flex', gap: 10 }}>
            {[[d, 'DAYS'], [pad(h), 'HRS'], [pad(m), 'MIN'], [pad(s), 'SEC']].map(([v, label]) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(110,200,245,0.25)', borderRadius: 12, padding: '10px 0', width: 72 }}>
                <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: LIGHT_BLUE, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {status === 'done' ? (
          <div style={{ marginTop: 28, width: '100%', background: 'rgba(35,152,236,0.12)', border: `1px solid ${BLUE}`, borderRadius: 16, padding: '26px 22px' }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>You&apos;re on the list 🎉</div>
            <p style={{ marginTop: 8, fontSize: 14.5, lineHeight: 1.6, color: '#cbd5e1' }}>
              We&apos;ll email you on launch day with your download link{role === 'customer' ? ' and your S$10 starting credit' : ' and your 0% commission activation'}.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} style={{ marginTop: 28, width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['customer', 'I ship equipment'], ['driver', 'I drive']].map(([value, label]) => (
                <button key={value} type="button" onClick={() => setRole(value)}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', border: role === value ? `1px solid ${BLUE}` : '1px solid rgba(255,255,255,0.15)', background: role === value ? 'rgba(35,152,236,0.2)' : 'transparent', color: role === value ? LIGHT_BLUE : '#94a3b8' }}>
                  {label}
                </button>
              ))}
            </div>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email"
              style={{ padding: '13px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 15, outline: 'none' }} />
            {role === 'customer' && (
              <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company (optional)"
                style={{ padding: '13px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 15, outline: 'none' }} />
            )}
            <button type="submit" disabled={status === 'sending'}
              style={{ padding: '14px 0', borderRadius: 10, border: 'none', background: BLUE_GRAD, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', opacity: status === 'sending' ? 0.7 : 1 }}>
              {status === 'sending' ? 'Signing you up…' : 'Get early access'}
            </button>
            {status === 'error' && <div style={{ color: '#fca5a5', fontSize: 13.5 }}>{errorMsg}</div>}
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
              Launch credits are promotional, apply to delivery fees, and are first-come while the launch budget lasts.
            </div>
          </form>
        )}

        <div style={{ marginTop: 26, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '16px 14px', textAlign: 'left' }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: LIGHT_BLUE }}>For businesses</div>
            <div style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.55, color: '#cbd5e1' }}>S$10 credit on sign-up · loyalty credits at your 3rd &amp; 10th delivery · refer a business, both get S$20</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '16px 14px', textAlign: 'left' }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: LIGHT_BLUE }}>For drivers</div>
            <div style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.55, color: '#cbd5e1' }}>0% commission for your first 30 days · S$50 bonus after 5 deliveries · first 100 drivers only</div>
          </div>
        </div>

        {(APP_STORE_URL || PLAY_STORE_URL) && (
          <div style={{ marginTop: 24, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            {APP_STORE_URL && (
              <a href={APP_STORE_URL} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: NAVY, fontWeight: 800, fontSize: 14, padding: '11px 18px', borderRadius: 10, textDecoration: 'none' }}>
                 Download on the App Store
              </a>
            )}
            {PLAY_STORE_URL ? (
              <a href={PLAY_STORE_URL} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: NAVY, fontWeight: 800, fontSize: 14, padding: '11px 18px', borderRadius: 10, textDecoration: 'none' }}>
                ▶ Get it on Google Play
              </a>
            ) : (
              <span style={{ fontSize: 13, color: '#94a3b8' }}>Google Play — coming this week</span>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: '18px 24px 26px', textAlign: 'center', fontSize: 12.5, color: '#64748b' }}>
        Tech Chain Global Pte. Ltd. · <a href="/services" style={{ color: '#94a3b8' }}>Services</a> · <a href="/terms" style={{ color: '#94a3b8' }}>Terms</a> · <a href="/privacy" style={{ color: '#94a3b8' }}>Privacy</a>
      </div>
    </div>
  );
}
