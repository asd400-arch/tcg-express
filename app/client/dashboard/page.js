'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import PromoBanner from '../../components/PromoBanner';
import { supabase } from '../../../lib/supabase';
import useMobile from '../../components/useMobile';

const SG_POSTAL_AREAS = {
  '01': 'Raffles Place', '02': 'Cecil', '03': 'Telok Blangah', '04': 'Harbourfront',
  '05': 'Pasir Panjang', '06': 'Beach Road', '07': 'Bugis', '08': 'Little India',
  '09': 'Orchard', '10': 'River Valley', '11': 'Newton', '12': 'Novena',
  '13': 'Macpherson', '14': 'Toa Payoh', '15': 'Serangoon', '16': 'Bishan',
  '17': 'Changi', '18': 'Tampines', '19': 'Pasir Ris',
  '20': 'Ayer Rajah', '21': 'Buona Vista', '22': 'Boon Lay', '23': 'Jurong',
  '24': 'Kranji', '25': 'Woodlands', '26': 'Upper Thomson', '27': 'Mandai',
  '28': 'Yishun', '29': 'Admiralty', '30': 'Woodlands',
  '31': 'Bukit Batok', '32': 'Choa Chu Kang', '33': 'Bukit Timah', '34': 'Holland',
  '35': 'Ang Mo Kio', '36': 'Bishan', '37': 'Serangoon Garden', '38': 'Hougang',
  '39': 'Punggol', '40': 'Sengkang', '41': 'Bedok', '42': 'Chai Chee',
  '43': 'Katong', '44': 'Marine Parade', '45': 'Paya Lebar',
  '46': 'Simei', '47': 'Tampines', '48': 'Changi', '49': 'Loyang',
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

function formatPickupTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getDate()} ${d.toLocaleDateString('en', { month: 'short' })}, ${d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

export default function ClientDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const m = useMobile();
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, pending: 0 });
  const [driverReviews, setDriverReviews] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'client') router.push('/');
    if (user) loadData();
  }, [user, loading]);

  const loadData = async () => {
    setDataLoading(true);
    const [jobsRes, revRes] = await Promise.all([
      supabase.from('express_jobs').select('*').eq('client_id', user.id).order('created_at', { ascending: false }),
      supabase.from('express_reviews').select('*, driver:driver_id(contact_name)').eq('client_id', user.id).eq('reviewer_role', 'driver').order('created_at', { ascending: false }).limit(5),
    ]);
    const j = jobsRes.data || [];
    setJobs(j);
    setDriverReviews(revRes.data || []);
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
        <PromoBanner />
        <div style={{ marginBottom: '25px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>Welcome, {user.contact_name || 'there'}</h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>{user.company_name || 'Your delivery dashboard'}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: m ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: '16px', marginBottom: '30px' }}>
          {[
            { label: 'Total Jobs', value: stats.total, color: '#3b82f6', icon: '📦' },
            { label: 'Active', value: stats.active, color: '#f59e0b', icon: '🚚' },
            { label: 'Completed', value: stats.completed, color: '#10b981', icon: '✅' },
            { label: 'Pending Confirm', value: stats.pending, color: '#8b5cf6', icon: '⏳' },
            { label: 'Your Rating', value: (user.client_rating != null ? user.client_rating : 5.0).toFixed(1), color: '#f59e0b', icon: '⭐' },
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
                <a key={job.id} href={`/client/jobs/${job.id}`} style={{ textDecoration: 'none', display: 'block', padding: '14px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{job.job_number || 'Draft'}</span>
                      <span style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '700', background: `${statusColor[job.status] || '#64748b'}15`, color: statusColor[job.status] || '#64748b', textTransform: 'uppercase' }}>{job.status.replace(/_/g, ' ')}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {job.final_amount ? (
                        <span style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>${job.final_amount}</span>
                      ) : job.budget_min ? (
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#94a3b8' }}>${job.budget_min}–${job.budget_max || job.budget_min}</span>
                      ) : null}
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', color: '#374151', marginBottom: '2px' }}>
                    {getAreaName(job.pickup_address)} → {getAreaName(job.delivery_address)}
                  </div>
                  {job.pickup_by && (
                    <div style={{ fontSize: '12px', color: '#64748b' }}>📅 {formatPickupTime(job.pickup_by)}</div>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Reviews from Drivers */}
        <div style={{ ...card, marginTop: '25px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>⭐ Reviews from Drivers</h3>
          {driverReviews.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No reviews from drivers yet</p>
          ) : (
            driverReviews.map(r => (
              <div key={r.id} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#f59e0b', fontSize: '14px' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{r.driver?.contact_name || 'Driver'}</span>
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
