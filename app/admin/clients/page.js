'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import useMobile from '../../components/useMobile';

export default function AdminClients() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const [clients, setClients] = useState([]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'admin') router.push('/');
    if (user && user.role === 'admin') loadData();
  }, [user, loading]);

  const loadData = async () => {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: user.id, role: 'client' }),
    });
    const result = await res.json();
    setClients(result.data || []);
  };

  const toggleActive = async (id, current) => {
    await fetch('/api/admin/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: user.id, userId: id, updates: { is_active: !current } }),
    });
    toast.success('Client updated');
    loadData();
  };

  if (loading || !user) return <Spinner />;
  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Clients" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>🏢 Clients ({clients.length})</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {clients.map(c => (
            <div key={c.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '700', color: '#3b82f6' }}>{(c.company_name || c.contact_name)[0]}</div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{c.company_name || c.contact_name}</div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>{c.contact_name} • {c.email} • {c.phone}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Joined {new Date(c.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', background: c.is_active ? '#f0fdf4' : '#fef2f2', color: c.is_active ? '#10b981' : '#ef4444' }}>{c.is_active ? 'Active' : 'Inactive'}</span>
                  <button onClick={() => toggleActive(c.id, c.is_active)} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>{c.is_active ? 'Deactivate' : 'Activate'}</button>
                </div>
              </div>
            </div>
          ))}
          {clients.length === 0 && <div style={card}><p style={{ color: '#64748b', textAlign: 'center' }}>No clients yet</p></div>}
        </div>
      </div>
    </div>
  );
}
