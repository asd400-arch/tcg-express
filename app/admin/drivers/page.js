'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import useMobile from '../../components/useMobile';
import { supabase } from '../../../lib/supabase';

export default function AdminDrivers() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const [drivers, setDrivers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedDriver, setExpandedDriver] = useState(null);
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
      body: JSON.stringify({ adminId: user.id, role: 'driver' }),
    });
    const result = await res.json();
    setDrivers(result.data || []);
  };

  const toggleReviews = async (driverId) => {
    if (expandedDriver === driverId) { setExpandedDriver(null); return; }
    setExpandedDriver(driverId);
    const { data } = await supabase.from('express_reviews').select('*, client:client_id(contact_name)').eq('driver_id', driverId).order('created_at', { ascending: false });
    setReviews(data || []);
  };

  const updateStatus = async (id, status) => {
    await fetch('/api/admin/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: user.id, userId: id, updates: { driver_status: status } }),
    });
    toast.success('Status updated');
    loadData();
  };

  if (loading || !user) return <Spinner />;
  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' };
  const sColor = { pending: '#f59e0b', approved: '#10b981', suspended: '#ef4444', rejected: '#94a3b8' };
  const filtered = (filter === 'all' ? drivers : drivers.filter(d => d.driver_status === filter)).filter(d => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (d.contact_name || '').toLowerCase().includes(s) || (d.email || '').toLowerCase().includes(s) || (d.phone || '').toLowerCase().includes(s) || (d.vehicle_type || '').toLowerCase().includes(s) || (d.vehicle_plate || '').toLowerCase().includes(s);
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Drivers" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>🚗 Drivers ({drivers.length})</h1>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, phone, vehicle..." style={{ width: '100%', padding: '10px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', background: '#f8fafc', color: '#1e293b', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box', marginBottom: '12px' }} />
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
          {['all', 'pending', 'approved', 'suspended', 'rejected'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: filter === f ? '#ef4444' : '#e2e8f0', color: filter === f ? 'white' : '#64748b',
              fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif", textTransform: 'capitalize',
            }}>{f}</button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map(d => (
            <div key={d.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '700', color: '#64748b' }}>{d.contact_name[0]}</div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{d.contact_name}</div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>{d.email} • {d.phone}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{d.vehicle_type} • {d.vehicle_plate} • License: {d.license_number}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>⭐ {d.driver_rating} • {d.total_deliveries} deliveries • Joined {new Date(d.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <span style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', background: `${sColor[d.driver_status]}15`, color: sColor[d.driver_status], textTransform: 'uppercase' }}>{d.driver_status}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {d.driver_status !== 'approved' && <button onClick={() => updateStatus(d.id, 'approved')} style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: '#10b981', color: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Approve</button>}
                    {d.driver_status === 'approved' && <button onClick={() => updateStatus(d.id, 'suspended')} style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: '#f59e0b', color: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Suspend</button>}
                    {d.driver_status !== 'rejected' && <button onClick={() => updateStatus(d.id, 'rejected')} style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: '#ef4444', color: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Reject</button>}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '12px' }}>
                <button onClick={() => toggleReviews(d.id)} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: expandedDriver === d.id ? '#f8fafc' : 'white', color: '#64748b', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                  {expandedDriver === d.id ? 'Hide Reviews' : `Reviews (${d.total_deliveries || 0})`}
                </button>
              </div>
              {expandedDriver === d.id && (
                <div style={{ marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                  {reviews.length === 0 ? (
                    <p style={{ fontSize: '13px', color: '#94a3b8' }}>No reviews yet</p>
                  ) : reviews.map(r => (
                    <div key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ color: '#f59e0b', fontSize: '14px' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>{r.client?.contact_name || 'Client'}</span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                      {r.review_text && <p style={{ fontSize: '13px', color: '#374151', margin: 0 }}>{r.review_text}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && <div style={card}><p style={{ color: '#64748b', textAlign: 'center' }}>No drivers found</p></div>}
        </div>
      </div>
    </div>
  );
}
