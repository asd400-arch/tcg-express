'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { supabase } from '../../../lib/supabase';
import useMobile from '../../components/useMobile';

export default function AdminJobs() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const m = useMobile();
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'admin') router.push('/');
    if (user && user.role === 'admin') loadData();
  }, [user, loading]);

  const loadData = async () => {
    const { data } = await supabase.from('express_jobs').select('*, client:client_id(contact_name, company_name), driver:assigned_driver_id(contact_name)').order('created_at', { ascending: false });
    setJobs(data || []);
  };

  if (loading || !user) return <Spinner />;
  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' };
  const statusColor = { open: '#3b82f6', bidding: '#8b5cf6', assigned: '#f59e0b', pickup_confirmed: '#f59e0b', in_transit: '#06b6d4', delivered: '#10b981', confirmed: '#10b981', completed: '#059669', cancelled: '#ef4444' };
  const filtered = (filter === 'all' ? jobs : jobs.filter(j => {
    if (filter === 'active') return !['confirmed','completed','cancelled'].includes(j.status);
    return j.status === filter;
  })).filter(j => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (j.job_number || '').toLowerCase().includes(s) || (j.item_description || '').toLowerCase().includes(s) || (j.client?.contact_name || '').toLowerCase().includes(s) || (j.client?.company_name || '').toLowerCase().includes(s) || (j.driver?.contact_name || '').toLowerCase().includes(s);
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="All Jobs" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>📦 All Jobs ({jobs.length})</h1>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by job #, description, client, driver..." style={{ width: '100%', padding: '10px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', background: '#f8fafc', color: '#1e293b', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box', marginBottom: '12px' }} />
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {['all', 'active', 'open', 'bidding', 'assigned', 'in_transit', 'delivered', 'confirmed', 'cancelled'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: filter === f ? '#ef4444' : '#e2e8f0', color: filter === f ? 'white' : '#64748b',
              fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif", textTransform: 'capitalize',
            }}>{f.replace(/_/g, ' ')}</button>
          ))}
        </div>
        <div style={card}>
          {filtered.map(job => (
            <div key={job.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ minWidth: '200px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{job.job_number}</span>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', background: `${statusColor[job.status]}15`, color: statusColor[job.status], textTransform: 'uppercase' }}>{job.status.replace(/_/g, ' ')}</span>
                </div>
                <div style={{ fontSize: '13px', color: '#374151' }}>{job.item_description}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Client: {job.client?.company_name || job.client?.contact_name} {job.driver ? `• Driver: ${job.driver.contact_name}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {job.final_amount && <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>${job.final_amount}</div>}
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(job.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No jobs found</p>}
        </div>
      </div>
    </div>
  );
}
