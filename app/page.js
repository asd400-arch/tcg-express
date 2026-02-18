'use client';
import { useEffect } from 'react';
import { useAuth } from './components/AuthContext';

export default function Home() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) window.location.href = '/login';
      else if (user.role === 'admin') window.location.href = '/admin/dashboard';
      else if (user.role === 'driver') window.location.href = '/driver/dashboard';
      else window.location.href = '/client/dashboard';
    }
  }, [user, loading]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: '900', color: 'white', margin: '0 auto 16px' }}>T</div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>TCG Express</h1>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Loading...</p>
      </div>
    </div>
  );
}
