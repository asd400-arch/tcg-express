'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import { supabase } from '../../../lib/supabase';
import useMobile from '../../components/useMobile';

const TYPE_LABELS = { once: 'One-time', weekly: 'Weekly', biweekly: 'Biweekly', monthly: 'Monthly' };
const SCHEDULE_STATUS_COLORS = { active: '#10b981', paused: '#f59e0b', cancelled: '#ef4444', completed: '#6b7280' };

export default function AdminJobs() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const [jobs, setJobs] = useState([]);
  const [schedules, setSchedules] = useState([]);
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

    // Load schedules
    try {
      const res = await fetch('/api/schedules');
      const result = await res.json();
      if (res.ok) setSchedules(result.data || []);
    } catch {}
  };

  const forceCancel = async (job) => {
    if (!confirm(`Cancel job ${job.job_number}? This will refund any held escrow.`)) return;
    // For jobs with escrow (assigned, pickup_confirmed, in_transit, delivered)
    if (['assigned', 'pickup_confirmed', 'in_transit', 'delivered'].includes(job.status)) {
      try {
        const res = await fetch('/api/transactions/refund', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: job.id }),
        });
        const result = await res.json();
        if (!res.ok) {
          toast.error(result.error || 'Failed to cancel job');
          return;
        }
        toast.success('Job cancelled — escrow refunded');
      } catch (e) {
        toast.error('Failed to cancel job');
        return;
      }
    } else {
      // For open/bidding jobs — direct cancel, no escrow
      await supabase.from('express_jobs').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: 'admin' }).eq('id', job.id);
      toast.success('Job cancelled');
    }
    loadData();
  };

  const cancelSchedule = async (schedule) => {
    if (!confirm('Cancel this schedule? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/schedules/${schedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success('Schedule cancelled');
        loadData();
      } else {
        toast.error(result.error || 'Failed to cancel schedule');
      }
    } catch {
      toast.error('Failed to cancel schedule');
    }
  };

  if (loading || !user) return <Spinner />;
  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' };
  const statusColor = { open: '#3b82f6', bidding: '#8b5cf6', assigned: '#f59e0b', pickup_confirmed: '#f59e0b', in_transit: '#06b6d4', delivered: '#10b981', confirmed: '#10b981', completed: '#059669', cancelled: '#ef4444' };
  const filtered = filter === 'scheduled' ? [] : (filter === 'all' ? jobs : jobs.filter(j => {
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
          {['all', 'active', 'open', 'bidding', 'assigned', 'in_transit', 'delivered', 'confirmed', 'cancelled', 'scheduled'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: filter === f ? '#ef4444' : '#e2e8f0', color: filter === f ? 'white' : '#64748b',
              fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif", textTransform: 'capitalize',
            }}>{f.replace(/_/g, ' ')}{f === 'scheduled' ? ` (${schedules.length})` : ''}</button>
          ))}
        </div>

        {filter === 'scheduled' ? (
          <div style={card}>
            {schedules.length === 0 ? (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No schedules found</p>
            ) : schedules.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', background: '#3b82f615', color: '#3b82f6', textTransform: 'uppercase' }}>{TYPE_LABELS[s.schedule_type]}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', background: `${SCHEDULE_STATUS_COLORS[s.status]}15`, color: SCHEDULE_STATUS_COLORS[s.status], textTransform: 'uppercase' }}>{s.status}</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', marginTop: '4px' }}>{s.pickup_address} → {s.delivery_address}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{s.item_description}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Client: {s.client?.company_name || s.client?.contact_name || 'Unknown'}
                    {s.jobs_created > 0 && ` • ${s.jobs_created} job${s.jobs_created !== 1 ? 's' : ''} created`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ textAlign: 'right' }}>
                    {['active', 'paused'].includes(s.status) && s.next_run_at && (
                      <div style={{ fontSize: '12px', color: '#374151' }}>Next: {new Date(s.next_run_at).toLocaleDateString()}</div>
                    )}
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(s.created_at).toLocaleDateString()}</div>
                  </div>
                  {['active', 'paused'].includes(s.status) && (
                    <button onClick={(e) => { e.stopPropagation(); cancelSchedule(s); }} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #ef4444', background: 'white', color: '#ef4444', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap' }}>Cancel</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ textAlign: 'right' }}>
                    {job.final_amount && <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>${job.final_amount}</div>}
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(job.created_at).toLocaleDateString()}</div>
                  </div>
                  {!['confirmed', 'completed', 'cancelled'].includes(job.status) && (
                    <button onClick={(e) => { e.stopPropagation(); forceCancel(job); }} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #ef4444', background: 'white', color: '#ef4444', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap' }}>Cancel</button>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No jobs found</p>}
          </div>
        )}
      </div>
    </div>
  );
}
