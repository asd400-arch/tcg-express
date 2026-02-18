'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import useMobile from '../../components/useMobile';

const STATUS_COLORS = {
  active: '#10b981',
  paused: '#f59e0b',
  cancelled: '#ef4444',
  completed: '#6b7280',
};

const TYPE_LABELS = {
  once: 'One-time',
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
};

const TABS = ['all', 'active', 'paused', 'completed', 'cancelled'];

export default function ClientSchedules() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const [schedules, setSchedules] = useState([]);
  const [filter, setFilter] = useState('all');
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'client') router.push('/');
    if (user && user.role === 'client') loadSchedules();
  }, [user, loading]);

  const loadSchedules = async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/schedules');
      const result = await res.json();
      if (res.ok) {
        setSchedules(result.data || []);
      } else {
        toast.error(result.error || 'Failed to load schedules');
      }
    } catch {
      toast.error('Failed to load schedules');
    }
    setFetching(false);
  };

  const handleAction = async (id, action) => {
    const labels = { pause: 'Pause', resume: 'Resume', cancel: 'Cancel' };
    if (action === 'cancel' && !confirm('Cancel this schedule? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(`Schedule ${action === 'pause' ? 'paused' : action === 'resume' ? 'resumed' : 'cancelled'}`);
        loadSchedules();
      } else {
        toast.error(result.error || `Failed to ${action} schedule`);
      }
    } catch {
      toast.error(`Failed to ${action} schedule`);
    }
  };

  if (loading || !user) return <Spinner />;

  const card = { background: 'white', borderRadius: '14px', padding: m ? '16px' : '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '12px' };
  const badge = (text, color) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', background: `${color}15`, color, textTransform: 'uppercase', marginRight: '6px' });

  const filtered = filter === 'all' ? schedules : schedules.filter(s => s.status === filter);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const formatNextRun = (s) => {
    if (!s.next_run_at) return 'N/A';
    return new Date(s.next_run_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };

  const formatRecurrence = (s) => {
    if (s.schedule_type === 'once') return 'One-time';
    if (s.schedule_type === 'weekly') return `Every ${dayNames[s.day_of_week] || ''} ${s.run_time ? 'at ' + s.run_time : ''}`.trim();
    if (s.schedule_type === 'biweekly') return `Every other ${dayNames[s.day_of_week] || ''} ${s.run_time ? 'at ' + s.run_time : ''}`.trim();
    if (s.schedule_type === 'monthly') return `Monthly on day ${s.day_of_month || ''} ${s.run_time ? 'at ' + s.run_time : ''}`.trim();
    return s.schedule_type;
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Schedules" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>📅 Scheduled Deliveries</h1>
          <a href="/client/jobs/new" style={{ padding: '10px 20px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>+ New Schedule</a>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{
              padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: filter === t ? '#3b82f6' : '#e2e8f0', color: filter === t ? 'white' : '#64748b',
              fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif", textTransform: 'capitalize',
            }}>{t}</button>
          ))}
        </div>

        {fetching ? <Spinner /> : filtered.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📅</div>
            <p style={{ color: '#64748b', fontSize: '15px', marginBottom: '16px' }}>No scheduled deliveries yet</p>
            <a href="/client/jobs/new" style={{ padding: '10px 24px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>Create Your First Schedule</a>
          </div>
        ) : (
          filtered.map(s => (
            <div key={s.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  {/* Badges */}
                  <div style={{ marginBottom: '8px' }}>
                    <span style={badge(TYPE_LABELS[s.schedule_type], '#3b82f6')}>{TYPE_LABELS[s.schedule_type]}</span>
                    <span style={badge(s.status, STATUS_COLORS[s.status])}>{s.status}</span>
                  </div>

                  {/* Route */}
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>
                    {s.pickup_address} → {s.delivery_address}
                  </div>

                  {/* Item */}
                  <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>
                    {s.item_description}
                  </div>

                  {/* Schedule info */}
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {s.schedule_type !== 'once' && <div>{formatRecurrence(s)}</div>}
                    {['active', 'paused'].includes(s.status) && (
                      <div>Next run: {formatNextRun(s)}</div>
                    )}
                    {s.jobs_created > 0 && (
                      <div>{s.jobs_created} job{s.jobs_created !== 1 ? 's' : ''} created{s.last_run_at ? ` • Last: ${new Date(s.last_run_at).toLocaleDateString()}` : ''}</div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  {s.status === 'active' && (
                    <>
                      <button onClick={() => handleAction(s.id, 'pause')} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #f59e0b', background: 'white', color: '#f59e0b', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Pause</button>
                      <button onClick={() => handleAction(s.id, 'cancel')} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #ef4444', background: 'white', color: '#ef4444', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Cancel</button>
                    </>
                  )}
                  {s.status === 'paused' && (
                    <>
                      <button onClick={() => handleAction(s.id, 'resume')} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #10b981', background: 'white', color: '#10b981', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Resume</button>
                      <button onClick={() => handleAction(s.id, 'cancel')} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #ef4444', background: 'white', color: '#ef4444', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Cancel</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
