'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';

export default function VerifyEmail() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [success, setSuccess] = useState(false);

  // Redirect if already verified or not logged in
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.is_verified) {
      if (user.role === 'admin') router.push('/admin/dashboard');
      else if (user.role === 'driver') router.push('/driver/dashboard');
      else router.push('/client/dashboard');
    }
  }, [user, authLoading, router]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const result = await res.json();
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setSuccess(true);
      // Refresh user data then redirect
      setTimeout(() => {
        window.location.href = user.role === 'admin' ? '/admin/dashboard' : user.role === 'driver' ? '/driver/dashboard' : '/client/dashboard';
      }, 1500);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResendLoading(true);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await res.json();
      if (result.error) {
        setError(result.error);
      } else {
        setResendCooldown(60);
      }
    } catch {
      setError('Failed to resend code.');
    }
    setResendLoading(false);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const input = { width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' };

  if (authLoading || !user) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '20px' }}>
      <div style={{ maxWidth: '420px', width: '100%', background: 'white', borderRadius: '20px', padding: '40px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '900', color: 'white', margin: '0 auto 16px' }}>T</div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>Verify Your Email</h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            Enter the 6-digit code sent to <strong>{user.email}</strong>
          </p>
        </div>

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ padding: '16px', borderRadius: '10px', background: '#f0fdf4', color: '#15803d', fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>
              Email verified successfully! Redirecting...
            </div>
          </div>
        ) : (
          <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Verification Code</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                maxLength={6}
                style={{ ...input, textAlign: 'center', letterSpacing: '6px', fontSize: '20px', fontWeight: '700' }}
                required
                autoFocus
              />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fef2f2', color: '#dc2626', fontSize: '13px', fontWeight: '500' }}>{error}</div>
            )}

            <button type="submit" disabled={loading || code.length !== 6} style={{
              width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white',
              fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
              opacity: (loading || code.length !== 6) ? 0.7 : 1,
            }}>{loading ? 'Verifying...' : 'Verify Email'}</button>

            <div style={{ textAlign: 'center' }}>
              {resendCooldown > 0 ? (
                <p style={{ color: '#64748b', fontSize: '13px' }}>Resend code in {resendCooldown}s</p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading}
                  style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", padding: 0 }}
                >
                  {resendLoading ? 'Sending...' : "Didn't receive a code? Resend"}
                </button>
              )}
            </div>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          <button
            onClick={handleLogout}
            style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '13px', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
