'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import useMobile from '../../components/useMobile';
import { supabase } from '../../../lib/supabase';

export default function AdminClients() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [expandedClient, setExpandedClient] = useState(null);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'admin') router.push('/');
    if (user && user.role === 'admin') loadData();
  }, [user, loading]);

  const loadData = async () => {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'client' }),
    });
    const result = await res.json();
    setClients(result.data || []);
  };

  const toggleReviews = async (clientId) => {
    if (expandedClient === clientId) { setExpandedClient(null); return; }
    setExpandedClient(clientId);
    const { data } = await supabase.from('express_reviews').select('*, driver:driver_id(contact_name)').eq('client_id', clientId).eq('reviewer_role', 'driver').order('created_at', { ascending: false });
    setReviews(data || []);
  };

  const toggleActive = async (id, current) => {
    await fetch('/api/admin/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id, updates: { is_active: !current } }),
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
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by company, name, email, phone..." style={{ width: '100%', padding: '10px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', background: '#f8fafc', color: '#1e293b', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box', marginBottom: '16px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {clients.filter(c => {
            if (!search.trim()) return true;
            const s = search.toLowerCase();
            return (c.company_name || '').toLowerCase().includes(s) || (c.contact_name || '').toLowerCase().includes(s) || (c.email || '').toLowerCase().includes(s) || (c.phone || '').toLowerCase().includes(s);
          }).map(c => (
            <div key={c.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '700', color: '#3b82f6' }}>{((c.company_name || c.contact_name) || 'C')[0]}</div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{c.company_name || c.contact_name}</div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>{c.contact_name} • {c.email} • {c.phone}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>⭐ {c.client_rating || '5.0'} rating • Joined {new Date(c.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', background: c.is_active ? '#f0fdf4' : '#fef2f2', color: c.is_active ? '#10b981' : '#ef4444' }}>{c.is_active ? 'Active' : 'Inactive'}</span>
                  <button onClick={() => toggleActive(c.id, c.is_active)} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>{c.is_active ? 'Deactivate' : 'Activate'}</button>
                </div>
              </div>
              <div style={{ marginTop: '12px' }}>
                <button onClick={() => toggleReviews(c.id)} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: expandedClient === c.id ? '#f8fafc' : 'white', color: '#64748b', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                  {expandedClient === c.id ? 'Hide Reviews' : 'Reviews from Drivers'}
                </button>
              </div>
              {expandedClient === c.id && (
                <div style={{ marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                  {reviews.length === 0 ? (
                    <p style={{ fontSize: '13px', color: '#94a3b8' }}>No reviews from drivers yet</p>
                  ) : reviews.map(r => (
                    <div key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ color: '#f59e0b', fontSize: '14px' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>{r.driver?.contact_name || 'Driver'}</span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                      {r.review_text && <p style={{ fontSize: '13px', color: '#374151', margin: 0 }}>{r.review_text}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {clients.length === 0 && <div style={card}><p style={{ color: '#64748b', textAlign: 'center' }}>No clients yet</p></div>}
        </div>
      </div>
    </div>
  );
}
