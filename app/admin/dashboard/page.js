'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import { supabase } from '../../../lib/supabase';
import useMobile from '../../components/useMobile';

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const [stats, setStats] = useState({ jobs: 0, activeJobs: 0, drivers: 0, pendingDrivers: 0, clients: 0, revenue: 0, openDisputes: 0 });
  const [recentJobs, setRecentJobs] = useState([]);
  const [pendingDrivers, setPendingDrivers] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'admin') router.push('/');
    if (user) loadData();
  }, [user, loading]);

  const loadData = async () => {
    setDataLoading(true);
    const [jobs, usersRes, txn, disputesRes] = await Promise.all([
      supabase.from('express_jobs').select('*').order('created_at', { ascending: false }),
      fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).then(r => r.json()),
      supabase.from('express_transactions').select('commission_amount').eq('payment_status', 'paid'),
      supabase.from('express_disputes').select('id').in('status', ['open', 'under_review']),
    ]);
    const j = jobs.data || []; const u = usersRes.data || []; const t = txn.data || [];
    const drivers = u.filter(x => x.role === 'driver');
    const clients = u.filter(x => x.role === 'client');
    const pd = drivers.filter(x => x.driver_status === 'pending');
    const revenue = t.reduce((sum, x) => sum + (parseFloat(x.commission_amount) || 0), 0);
    setStats({
      jobs: j.length,
      activeJobs: j.filter(x => !['confirmed','completed','cancelled'].includes(x.status)).length,
      drivers: drivers.length,
      pendingDrivers: pd.length,
      clients: clients.length,
      revenue,
      openDisputes: (disputesRes.data || []).length,
    });
    setRecentJobs(j.slice(0, 8));
    setPendingDrivers(pd);
    setDataLoading(false);
  };

  const approveDriver = async (id) => {
    await fetch('/api/admin/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id, updates: { driver_status: 'approved' } }),
    });
    toast.success('Driver approved');
    loadData();
  };

  const rejectDriver = async (id) => {
    await fetch('/api/admin/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id, updates: { driver_status: 'rejected' } }),
    });
    toast.success('Driver rejected');
    loadData();
  };

  if (loading || !user) return <Spinner />;

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' };
  const statusColor = { open: '#3b82f6', bidding: '#8b5cf6', assigned: '#f59e0b', pickup_confirmed: '#f59e0b', in_transit: '#06b6d4', delivered: '#10b981', confirmed: '#10b981', completed: '#059669', cancelled: '#ef4444' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Dashboard" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden' }}>
        <div style={{ marginBottom: '25px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>Admin Dashboard</h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>Tech Chain Express Platform Overview</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: m ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '16px', marginBottom: '30px' }}>
          {[
            { label: 'Total Jobs', value: stats.jobs, color: '#3b82f6', icon: '📦' },
            { label: 'Active Jobs', value: stats.activeJobs, color: '#f59e0b', icon: '🚚' },
            { label: 'Total Drivers', value: stats.drivers, color: '#10b981', icon: '🚗' },
            { label: 'Pending Drivers', value: stats.pendingDrivers, color: '#ef4444', icon: '⏳' },
            { label: 'Total Clients', value: stats.clients, color: '#8b5cf6', icon: '🏢' },
            { label: 'Open Disputes', value: stats.openDisputes, color: '#e11d48', icon: '⚖️' },
            { label: 'Revenue', value: `$${stats.revenue.toFixed(2)}`, color: '#059669', icon: '💰' },
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

        <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: '20px' }}>
          {/* Pending Driver Approvals */}
          <div style={card}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>⏳ Pending Driver Approvals</h3>
            {pendingDrivers.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No pending approvals</p>
            ) : (
              pendingDrivers.map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{d.contact_name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{d.vehicle_type} • {d.vehicle_plate}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => approveDriver(d.id)} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#10b981', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Approve</button>
                    <button onClick={() => rejectDriver(d.id)} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#ef4444', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Reject</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Recent Jobs */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>📦 Recent Jobs</h3>
              <a href="/admin/jobs" style={{ color: '#3b82f6', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>View All →</a>
            </div>
            {recentJobs.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No jobs yet</p>
            ) : (
              recentJobs.slice(0, 5).map(job => (
                <div key={job.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{job.job_number || 'Draft'}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{job.item_description}</div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: `${statusColor[job.status] || '#64748b'}15`, color: statusColor[job.status] || '#64748b', textTransform: 'capitalize' }}>{job.status}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
