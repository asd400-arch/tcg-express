'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const input = { width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' };

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setStep(2);
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const result = await res.json();
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      router.push('/login');
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '20px' }}>
      <div style={{ maxWidth: '420px', width: '100%', background: 'white', borderRadius: '20px', padding: '40px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '900', color: 'white', margin: '0 auto 16px' }}>T</div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>
            {step === 1 ? 'Forgot Password' : 'Reset Password'}
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            {step === 1 ? 'Enter your email to receive a reset code' : 'Enter the code sent to your email'}
          </p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" style={input} required />
            </div>
            {error && <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fef2f2', color: '#dc2626', fontSize: '13px', fontWeight: '500' }}>{error}</div>}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white',
              fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
              opacity: loading ? 0.7 : 1,
            }}>{loading ? 'Sending...' : 'Send Reset Code'}</button>
          </form>
        ) : (
          <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '12px 14px', borderRadius: '8px', background: '#f0fdf4', color: '#15803d', fontSize: '13px', fontWeight: '500' }}>
              A reset code has been sent to {email}
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Reset Code</label>
              <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="6-digit code" maxLength={6} style={{ ...input, textAlign: 'center', letterSpacing: '4px', fontSize: '18px', fontWeight: '700' }} required />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 6 characters" style={input} required />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" style={input} required />
            </div>
            {error && <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fef2f2', color: '#dc2626', fontSize: '13px', fontWeight: '500' }}>{error}</div>}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white',
              fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
              opacity: loading ? 0.7 : 1,
            }}>{loading ? 'Resetting...' : 'Reset Password'}</button>
            <button type="button" onClick={() => { setStep(1); setError(''); }} style={{
              width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0',
              background: 'white', color: '#64748b', fontSize: '13px', fontWeight: '500',
              cursor: 'pointer', fontFamily: "'Inter', sans-serif",
            }}>Back</button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            Remember your password? <a href="/login" style={{ color: '#3b82f6', fontWeight: '600', textDecoration: 'none' }}>Sign In</a>
          </p>
        </div>
      </div>
    </div>
  );
}
