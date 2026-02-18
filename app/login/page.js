'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    if (result.error) { setError(result.error); setLoading(false); return; }
    const user = result.data;
    if (user.role === 'admin') router.push('/admin/dashboard');
    else if (user.role === 'driver') router.push('/driver/dashboard');
    else router.push('/client/dashboard');
  };

  const input = { width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '20px' }}>
      <div style={{ maxWidth: '420px', width: '100%', background: 'white', borderRadius: '20px', padding: '40px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '900', color: 'white', margin: '0 auto 16px' }}>T</div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>Welcome back</h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>Sign in to TCG Express</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" style={input} required />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" style={input} required />
          </div>
          {error && <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fef2f2', color: '#dc2626', fontSize: '13px', fontWeight: '500' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white',
            fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
            opacity: loading ? 0.7 : 1,
          }}>{loading ? 'Signing in...' : 'Sign In'}</button>
          <div style={{ textAlign: 'right' }}>
            <a href="/forgot-password" style={{ color: '#3b82f6', fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>Forgot password?</a>
          </div>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            Don't have an account? <a href="/signup" style={{ color: '#3b82f6', fontWeight: '600', textDecoration: 'none' }}>Sign Up</a>
          </p>
        </div>
      </div>
    </div>
  );
}
