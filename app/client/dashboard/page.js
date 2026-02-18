'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { supabase } from '../../../lib/supabase';
import useMobile from '../../components/useMobile';

export default function ClientDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const m = useMobile();
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, pending: 0 });
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'client') router.push('/');
    if (user) loadData();
  }, [user, loading]);

  const loadData = async () => {
    setDataLoading(true);
    const { data } = await supabase.from('express_jobs').select('*').eq('client_id', user.id).order('created_at', { ascending: false });
    const j = data || [];
    setJobs(j);
    setStats({
      total: j.length,
      active: j.filter(x => ['open','bidding','assigned','pickup_confirmed','in_transit'].includes(x.status)).length,
      completed: j.filter(x => ['confirmed','completed'].includes(x.status)).length,
      pending: j.filter(x => x.status === 'delivered').length,
    });
    setDataLoading(false);
  };

  if (loading || !user) return <Spinner />;

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' };
  const statusColor = { open: '#3b82f6', bidding: '#8b5cf6', assigned: '#f59e0b', pickup_confirmed: '#f59e0b', in_transit: '#06b6d4', delivered: '#10b981', confirmed: '#10b981', completed: '#059669', cancelled: '#ef4444', disputed: '#ef4444' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Dashboard" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden' }}>
        <div style={{ marginBottom: '25px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>Welcome, {user.contact_name}</h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>{user.company_name || 'Your delivery dashboard'}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: m ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '16px', marginBottom: '30px' }}>
          {[
            { label: 'Total Jobs', value: stats.total, color: '#3b82f6', icon: '📦' },
            { label: 'Active', value: stats.active, color: '#f59e0b', icon: '🚚' },
            { label: 'Completed', value: stats.completed, color: '#10b981', icon: '✅' },
            { label: 'Pending Confirm', value: stats.pending, color: '#8b5cf6', icon: '⏳' },
          ].map((s, i) => (
            <div key={i} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', marginBottom: '6px' }}>{s.label}</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: s.color }}>{s.value}</div>
                </div>
                <span style={{ fontSize: '24px' }}>{s.icon}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ ...card, marginBottom: '25px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <a href="/client/jobs/new" style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', fontSize: '14px', fontWeight: '600', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>➕ New Delivery Job</a>
          <a href="/client/jobs" style={{ padding: '12px 24px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#374151', fontSize: '14px', fontWeight: '600', textDecoration: 'none' }}>📋 View All Jobs</a>
        </div>

        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Recent Jobs</h3>
          {jobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📦</div>
              <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '16px' }}>No delivery jobs yet</p>
              <a href="/client/jobs/new" style={{ color: '#3b82f6', fontWeight: '600', fontSize: '14px', textDecoration: 'none' }}>Create your first job →</a>
            </div>
          ) : (
            <div>
              {jobs.slice(0, 5).map(job => (
                <a key={job.id} href={`/client/jobs/${job.id}`} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{job.job_number || 'Draft'}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{job.pickup_address} → {job.delivery_address}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: `${statusColor[job.status] || '#64748b'}15`, color: statusColor[job.status] || '#64748b', textTransform: 'capitalize' }}>{job.status}</span>
                    {job.final_amount && <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginTop: '4px' }}>${job.final_amount}</div>}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
