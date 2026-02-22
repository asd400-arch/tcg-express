'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { supabase } from '../../../lib/supabase';
import useMobile from '../../components/useMobile';

export default function DriverDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const m = useMobile();
  const [myJobs, setMyJobs] = useState([]);
  const [availableJobs, setAvailableJobs] = useState([]);
  const [stats, setStats] = useState({ active: 0, completed: 0, earnings: 0, rating: 5.0 });
  const [recentReviews, setRecentReviews] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [evStats, setEvStats] = useState({ monthSavings: 0, totalCo2: 0 });

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'driver') router.push('/');
    if (user) loadData();
  }, [user, loading]);

  const loadData = async () => {
    setDataLoading(true);
    const [myJ, openJ, txn, revRes] = await Promise.all([
      supabase.from('express_jobs').select('*').eq('assigned_driver_id', user.id).order('created_at', { ascending: false }),
      supabase.from('express_jobs').select('*').in('status', ['open', 'bidding']).order('created_at', { ascending: false }).limit(5),
      supabase.from('express_transactions').select('driver_payout').eq('driver_id', user.id).eq('payment_status', 'paid'),
      supabase.from('express_reviews').select('*, client:client_id(contact_name)').eq('driver_id', user.id).eq('reviewer_role', 'client').order('created_at', { ascending: false }).limit(5),
    ]);
    const mj = myJ.data || []; const oj = openJ.data || [];
    const totalEarnings = (txn.data || []).reduce((sum, t) => sum + (parseFloat(t.driver_payout) || 0), 0);
    setMyJobs(mj);
    setAvailableJobs(oj);
    setRecentReviews(revRes.data || []);
    setStats({
      active: mj.filter(x => ['assigned','pickup_confirmed','in_transit'].includes(x.status)).length,
      completed: mj.filter(x => ['confirmed','completed'].includes(x.status)).length,
      earnings: totalEarnings,
      rating: user.driver_rating || 5.0,
    });

    // Calculate EV stats if driver is EV-certified
    if (user.is_ev_vehicle) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const completedJobs = mj.filter(x => ['confirmed', 'completed'].includes(x.status));
      // Monthly commission savings: difference between 15% and 10% on this month's jobs
      const monthJobs = completedJobs.filter(j => j.completed_at && j.completed_at >= monthStart);
      const monthSavings = monthJobs.reduce((sum, j) => {
        const amount = parseFloat(j.final_amount) || 0;
        return sum + (amount * 0.05); // 5% saving (15% - 10%)
      }, 0);
      // Total CO2 saved from all EV deliveries
      const totalCo2 = completedJobs.reduce((sum, j) => sum + (parseFloat(j.co2_saved_kg) || 0), 0);
      setEvStats({ monthSavings, totalCo2 });
    }
    setDataLoading(false);
  };

  if (loading || !user) return <Spinner />;

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' };
  const statusColor = { open: '#3b82f6', bidding: '#8b5cf6', assigned: '#f59e0b', pickup_confirmed: '#f59e0b', in_transit: '#06b6d4', delivered: '#10b981', confirmed: '#10b981', completed: '#059669' };
  const urgencyColor = { standard: '#64748b', express: '#f59e0b', urgent: '#ef4444' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Dashboard" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden' }}>
        <div style={{ marginBottom: '25px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>Hi, {user.contact_name} 🚗</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>{user.vehicle_type} • {user.vehicle_plate}</p>
            <span style={{
              padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
              background: user.is_ev_vehicle ? '#dcfce7' : '#f1f5f9',
              color: user.is_ev_vehicle ? '#16a34a' : '#64748b',
            }}>
              {user.is_ev_vehicle ? 'EV Partner • 10% Commission' : 'Standard • 15% Commission'}
            </span>
          </div>
        </div>

        {/* EV Savings Card */}
        {user.is_ev_vehicle && (
          <div style={{
            ...card, marginBottom: '25px',
            background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
            border: '1px solid #bbf7d0',
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#16a34a', marginBottom: '14px' }}>
              EV Partner Benefits
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr 1fr' : '1fr 1fr 1fr', gap: '14px' }}>
              <div style={{ background: 'white', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', marginBottom: '4px' }}>Commission Rate</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#16a34a' }}>10%</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>vs 15% standard</div>
              </div>
              <div style={{ background: 'white', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', marginBottom: '4px' }}>Saved This Month</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#16a34a' }}>${evStats.monthSavings.toFixed(2)}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>from lower commission</div>
              </div>
              <div style={{ background: 'white', borderRadius: '10px', padding: '14px', textAlign: 'center', ...(m ? { gridColumn: 'span 2' } : {}) }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', marginBottom: '4px' }}>CO2 Prevented</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#16a34a' }}>{evStats.totalCo2.toFixed(1)} kg</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>total from EV deliveries</div>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: m ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '16px', marginBottom: '30px' }}>
          {[
            { label: 'Active Jobs', value: stats.active, color: '#f59e0b', icon: '🚚' },
            { label: 'Completed', value: stats.completed, color: '#10b981', icon: '✅' },
            { label: 'Total Earnings', value: `$${stats.earnings.toFixed(2)}`, color: '#3b82f6', icon: '💰' },
            { label: 'Rating', value: stats.rating.toFixed(1), color: '#f59e0b', icon: '⭐' },
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

        {/* Available Jobs */}
        <div style={{ ...card, marginBottom: '25px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>🔍 Available Jobs</h3>
            <a href="/driver/jobs" style={{ color: '#3b82f6', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>View All →</a>
          </div>
          {availableJobs.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No available jobs right now. Check back later!</p>
          ) : (
            availableJobs.map(job => (
              <a key={job.id} href={`/driver/jobs?id=${job.id}`} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{job.item_description}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', background: `${urgencyColor[job.urgency]}15`, color: urgencyColor[job.urgency], textTransform: 'uppercase' }}>{job.urgency}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>📍 {job.pickup_address} → {job.delivery_address}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#10b981' }}>${job.budget_min} - ${job.budget_max}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>{job.vehicle_required || 'Any vehicle'}</div>
                </div>
              </a>
            ))
          )}
        </div>

        {/* My Active Jobs */}
        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>📦 My Active Jobs</h3>
          {myJobs.filter(j => !['confirmed','completed','cancelled'].includes(j.status)).length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No active jobs. Browse available jobs to start bidding!</p>
          ) : (
            myJobs.filter(j => !['confirmed','completed','cancelled'].includes(j.status)).map(job => (
              <a key={job.id} href={`/driver/my-jobs?id=${job.id}`} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{job.job_number}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{job.item_description}</div>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: `${statusColor[job.status] || '#64748b'}15`, color: statusColor[job.status] || '#64748b', textTransform: 'capitalize' }}>{job.status.replace(/_/g, ' ')}</span>
              </a>
            ))
          )}
        </div>

        {/* Recent Reviews */}
        <div style={{ ...card, marginTop: '25px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>⭐ Recent Reviews</h3>
          {recentReviews.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No reviews yet. Complete deliveries to receive ratings!</p>
          ) : (
            recentReviews.map(r => (
              <div key={r.id} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#f59e0b', fontSize: '14px' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{r.client?.contact_name || 'Client'}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                {r.review_text && <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>{r.review_text}</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
