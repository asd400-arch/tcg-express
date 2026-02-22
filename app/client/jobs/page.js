'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { supabase } from '../../../lib/supabase';
import useMobile from '../../components/useMobile';

export default function ClientJobs() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const m = useMobile();
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'client') router.push('/');
    if (user && user.role === 'client') loadJobs();
  }, [user, loading]);

  const loadJobs = async () => {
    const { data } = await supabase.from('express_jobs').select('*').eq('client_id', user.id).order('created_at', { ascending: false });
    setJobs(data || []);
  };

  if (loading || !user) return <Spinner />;

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' };
  const statusColor = { open: '#3b82f6', bidding: '#8b5cf6', assigned: '#f59e0b', pickup_confirmed: '#f59e0b', in_transit: '#06b6d4', delivered: '#10b981', confirmed: '#10b981', completed: '#059669', cancelled: '#ef4444' };
  const filtered = (filter === 'all' ? jobs : jobs.filter(j => {
    if (filter === 'active') return ['open','bidding','assigned','pickup_confirmed','in_transit'].includes(j.status);
    if (filter === 'completed') return ['confirmed','completed'].includes(j.status);
    if (filter === 'pending') return j.status === 'delivered';
    return true;
  })).filter(j => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (j.job_number || '').toLowerCase().includes(s) || (j.item_description || '').toLowerCase().includes(s) || (j.pickup_address || '').toLowerCase().includes(s) || (j.delivery_address || '').toLowerCase().includes(s);
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="My Deliveries" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>My Deliveries ({jobs.length})</h1>
          <a href="/client/jobs/new" style={{ padding: '10px 20px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>➕ New Delivery</a>
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs..." style={{ width: '100%', padding: '10px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', background: '#f8fafc', color: '#1e293b', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box', marginBottom: '12px' }} />

        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {['all', 'active', 'pending', 'completed'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: filter === f ? '#3b82f6' : '#e2e8f0', color: filter === f ? 'white' : '#64748b',
              fontSize: '13px', fontWeight: '600', fontFamily: "'Inter', sans-serif", textTransform: 'capitalize',
            }}>{f}</button>
          ))}
        </div>

        <div style={card}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: '#64748b', fontSize: '14px' }}>No jobs found</p>
            </div>
          ) : (
            filtered.map(job => (
              <a key={job.id} href={`/client/jobs/${job.id}`} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{job.job_number || 'Draft'}</span>
                    <span style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '700', background: `${statusColor[job.status] || '#64748b'}15`, color: statusColor[job.status] || '#64748b', textTransform: 'uppercase' }}>{job.status.replace(/_/g, ' ')}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>{job.item_description}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>📍 {job.pickup_address} → {job.delivery_address}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {job.final_amount ? (
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>${job.final_amount}</div>
                  ) : job.budget_min ? (
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#94a3b8' }}>${job.budget_min}–${job.budget_max || job.budget_min}</div>
                  ) : null}
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>{new Date(job.created_at).toLocaleDateString()}</div>
                </div>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
