'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { supabase } from '../../../lib/supabase';
import useMobile from '../../components/useMobile';
import { VEHICLE_MODES, legacyVehicleLabel } from '../../../lib/fares';

const SG_POSTAL_AREAS = {
  '01': 'Raffles Place', '02': 'Cecil',
  '03': 'Telok Blangah', '04': 'Harbourfront',
  '05': 'Pasir Panjang',
  '06': 'Beach Road', '07': 'Bugis',
  '08': 'Little India',
  '09': 'Orchard', '10': 'River Valley',
  '11': 'Newton', '12': 'Novena',
  '13': 'Macpherson', '14': 'Toa Payoh',
  '15': 'Serangoon', '16': 'Bishan',
  '17': 'Changi',
  '18': 'Tampines', '19': 'Pasir Ris',
  '20': 'Ayer Rajah', '21': 'Buona Vista',
  '22': 'Boon Lay', '23': 'Jurong',
  '24': 'Kranji', '25': 'Woodlands',
  '26': 'Upper Thomson', '27': 'Mandai',
  '28': 'Yishun',
  '29': 'Admiralty', '30': 'Woodlands',
  '31': 'Bukit Batok', '32': 'Choa Chu Kang',
  '33': 'Bukit Timah', '34': 'Holland',
  '35': 'Ang Mo Kio', '36': 'Bishan',
  '37': 'Serangoon Garden', '38': 'Hougang',
  '39': 'Punggol', '40': 'Sengkang',
  '41': 'Bedok', '42': 'Chai Chee',
  '43': 'Katong', '44': 'Marine Parade',
  '45': 'Paya Lebar',
  '46': 'Simei', '47': 'Tampines',
  '48': 'Changi', '49': 'Loyang',
  '50': 'Bukit Merah', '51': 'Queenstown', '52': 'Queenstown',
  '53': 'Bukit Merah', '56': 'Bishan', '57': 'Ang Mo Kio',
  '58': 'Upper Bukit Timah', '59': 'Clementi',
  '60': 'Jurong', '61': 'Jurong', '62': 'Jurong', '63': 'Jurong', '64': 'Jurong',
  '65': 'Bukit Panjang', '66': 'Choa Chu Kang', '67': 'Bukit Panjang', '68': 'Choa Chu Kang',
  '72': 'Kranji', '73': 'Woodgrove', '75': 'Yishun', '76': 'Sembawang',
  '77': 'Upper Thomson', '78': 'Springleaf', '79': 'Seletar', '80': 'Seletar', '81': 'Changi', '82': 'Punggol',
};

function getAreaName(addr) {
  if (!addr) return '—';
  const match = addr.match(/(?:Singapore\s*)?(\d{6})(?:\s|,|$)/i);
  if (match) {
    const area = SG_POSTAL_AREAS[match[1].substring(0, 2)];
    if (area) return area;
  }
  const parts = addr.split(',').map(p => p.trim());
  if (parts.length >= 3) return parts[parts.length - 2];
  if (parts.length === 2) return parts[0];
  return addr.length > 30 ? addr.slice(0, 28) + '...' : addr;
}

function getVehicleLabel(key) {
  if (!key || key === 'any') return null;
  const mode = VEHICLE_MODES.find(v => v.key === key);
  if (mode) return `${mode.icon} ${mode.label}`;
  return legacyVehicleLabel(key);
}

function formatBudgetRange(job) {
  const max = parseFloat(job.budget_max);
  const min = parseFloat(job.budget_min);
  if (min > 0 && max > 0) return `$${min.toFixed(0)} - $${max.toFixed(0)}`;
  if (max > 0) return `$${max.toFixed(2)}`;
  if (min > 0) return `$${min.toFixed(2)}`;
  return 'Open bid';
}

function formatPickupTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getDate()} ${d.toLocaleDateString('en', { month: 'short' })}, ${d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

function getCountdown(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= -3600000) return 'Overdue';
  if (diff <= 0) return 'Now';
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 24) return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

// Sort by pickup urgency: pickup_by ASC (soonest first), null after, past at bottom
const sortByPickupUrgency = (a, b) => {
  const now = Date.now();
  const aTime = a.pickup_by ? new Date(a.pickup_by).getTime() : null;
  const bTime = b.pickup_by ? new Date(b.pickup_by).getTime() : null;
  const aPast = aTime && aTime < now;
  const bPast = bTime && bTime < now;
  if (aPast && !bPast) return 1;
  if (!aPast && bPast) return -1;
  if (aPast && bPast) return bTime - aTime;
  if (aTime && !bTime) return -1;
  if (!aTime && bTime) return 1;
  if (!aTime && !bTime) return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  return aTime - bTime;
};

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
      supabase.from('express_jobs').select('*').in('status', ['open', 'bidding']).limit(10),
      supabase.from('express_transactions').select('driver_payout').eq('driver_id', user.id).eq('payment_status', 'paid'),
      supabase.from('express_reviews').select('*, client:client_id(contact_name)').eq('driver_id', user.id).eq('reviewer_role', 'client').order('created_at', { ascending: false }).limit(5),
    ]);
    const mj = myJ.data || []; const oj = (openJ.data || []).sort(sortByPickupUrgency);
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
      <div style={{ flex: 1, padding: m ? '80px 16px 20px' : '30px', overflowX: 'hidden' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {availableJobs.slice(0, 5).map(job => {
                const budget = parseFloat(job.budget_min) || parseFloat(job.budget_max) || 0;
                const vLabel = getVehicleLabel(job.vehicle_required);
                const countdown = getCountdown(job.pickup_by);
                const urgBadge = { display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', background: `${urgencyColor[job.urgency] || '#64748b'}15`, color: urgencyColor[job.urgency] || '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' };
                return (
                  <a key={job.id} href="/driver/jobs" style={{ textDecoration: 'none', display: 'block', padding: '16px 20px', borderRadius: '14px', border: '1px solid #f1f5f9', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    {/* Row 1: Vehicle + Weight + Urgency + Amount */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
                        {vLabel && <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{vLabel}</span>}
                        {job.item_weight && <span style={{ fontSize: '13px', color: '#475569', fontWeight: '600' }}>{job.item_weight} kg</span>}
                        {!vLabel && !job.item_weight && <span style={{ fontSize: '13px', color: '#94a3b8' }}>—</span>}
                        <span style={urgBadge}>{job.urgency || 'standard'}</span>
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#10b981', flexShrink: 0, marginLeft: '10px' }}>{formatBudgetRange(job)}</div>
                    </div>
                    {/* Row 2: Date/Time + Countdown */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>📅 {formatPickupTime(job.pickup_by || job.created_at)}</span>
                      {countdown && (
                        <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', background: countdown === 'Overdue' ? '#fef2f2' : countdown === 'Now' ? '#fef2f2' : '#fef3c7', color: countdown === 'Overdue' ? '#dc2626' : countdown === 'Now' ? '#dc2626' : '#92400e' }}>
                          {countdown === 'Overdue' ? 'OVERDUE' : countdown === 'Now' ? 'ASAP' : `in ${countdown}`}
                        </span>
                      )}
                    </div>
                    {/* Row 3: Area → Area + distance */}
                    <div style={{ fontSize: '13px', color: '#374151', marginBottom: '8px' }}>
                      {getAreaName(job.pickup_address)} → {getAreaName(job.delivery_address)}
                      {job.distance_km ? <span style={{ color: '#94a3b8', marginLeft: '8px' }}>{parseFloat(job.distance_km).toFixed(1)} km</span> : ''}
                    </div>
                    {/* Row 4: Job ID + buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: '#b0b8c4' }}>{job.job_number || '—'}</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {budget > 0 && (
                          <span style={{ padding: '6px 14px', borderRadius: '8px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '12px', fontWeight: '600' }}>Accept ${budget.toFixed(2)}</span>
                        )}
                        <span style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #3b82f6', background: 'white', color: '#3b82f6', fontSize: '12px', fontWeight: '600' }}>{budget > 0 ? 'Bid' : 'Place Bid'}</span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* My Active Jobs */}
        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>📦 My Active Jobs</h3>
          {myJobs.filter(j => !['confirmed','completed','cancelled'].includes(j.status)).length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No active jobs. Browse available jobs to start bidding!</p>
          ) : (
            myJobs.filter(j => !['confirmed','completed','cancelled'].includes(j.status)).map(job => (
              <a key={job.id} href={`/driver/my-jobs?id=${job.id}`} style={{ textDecoration: 'none', display: 'block', padding: '14px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{job.job_number}</span>
                    <span style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '700', background: `${statusColor[job.status] || '#64748b'}15`, color: statusColor[job.status] || '#64748b', textTransform: 'uppercase' }}>{job.status.replace(/_/g, ' ')}</span>
                  </div>
                  {job.final_amount ? (
                    <span style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>${job.final_amount}</span>
                  ) : job.budget_min ? (
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#10b981' }}>{formatBudgetRange(job)}</span>
                  ) : null}
                </div>
                <div style={{ fontSize: '13px', color: '#374151', marginBottom: '2px' }}>
                  {getAreaName(job.pickup_address)} → {getAreaName(job.delivery_address)}
                </div>
                {job.pickup_by && (
                  <div style={{ fontSize: '12px', color: '#64748b' }}>📅 {formatPickupTime(job.pickup_by)}</div>
                )}
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
