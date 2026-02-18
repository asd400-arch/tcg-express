'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthContext';
import Sidebar from '../../../components/Sidebar';
import Spinner from '../../../components/Spinner';
import ChatBox from '../../../components/ChatBox';
import LiveMap from '../../../components/LiveMap';
import { useToast } from '../../../components/Toast';
import RatingModal from '../../../components/RatingModal';
import { supabase } from '../../../../lib/supabase';
import useMobile from '../../../components/useMobile';
import { use } from 'react';

export default function ClientJobDetail({ params }) {
  const resolvedParams = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const [jobId] = useState(resolvedParams.id);
  const [job, setJob] = useState(null);
  const [bids, setBids] = useState([]);
  const [tab, setTab] = useState('details');
  const [showRating, setShowRating] = useState(false);
  const [hasReview, setHasReview] = useState(false);
  const [heldTxn, setHeldTxn] = useState(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (jobId && user) loadData();
  }, [jobId, user, loading]);

  // Real-time job status updates
  useEffect(() => {
    if (!jobId) return;
    const channel = supabase
      .channel(`job-${jobId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'express_jobs',
        filter: `id=eq.${jobId}`,
      }, (payload) => {
        setJob(payload.new);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [jobId]);

  // Real-time bids
  useEffect(() => {
    if (!jobId) return;
    const channel = supabase
      .channel(`bids-${jobId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'express_bids',
        filter: `job_id=eq.${jobId}`,
      }, async (payload) => {
        const bid = payload.new;
        const { data: driver } = await supabase.from('express_users')
          .select('id, contact_name, phone, vehicle_type, vehicle_plate, driver_rating, total_deliveries')
          .eq('id', bid.driver_id).single();
        bid.driver = driver;
        setBids(prev => [...prev, bid]);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [jobId]);

  const loadData = async () => {
    const [jobRes, bidsRes, reviewRes, txnRes] = await Promise.all([
      supabase.from('express_jobs').select('*').eq('id', jobId).single(),
      supabase.from('express_bids').select('*, driver:driver_id(id, contact_name, phone, email, vehicle_type, vehicle_plate, driver_rating, total_deliveries)').eq('job_id', jobId).order('created_at', { ascending: true }),
      supabase.from('express_reviews').select('id').eq('job_id', jobId).limit(1),
      supabase.from('express_transactions').select('*').eq('job_id', jobId).eq('payment_status', 'held').maybeSingle(),
    ]);
    setJob(jobRes.data);
    setBids(bidsRes.data || []);
    setHasReview((reviewRes.data || []).length > 0);
    setHeldTxn(txnRes.data || null);
  };

  const acceptBid = async (bid) => {
    let rate = 15;
    try {
      const settingsRes = await fetch('/api/admin/settings');
      const settingsData = await settingsRes.json();
      if (settingsData.data?.commission_rate) {
        rate = parseFloat(settingsData.data.commission_rate);
      }
    } catch (e) {}
    const commission = parseFloat(bid.amount) * (rate / 100);
    const payout = parseFloat(bid.amount) - commission;
    await supabase.from('express_bids').update({ status: 'accepted' }).eq('id', bid.id);
    await supabase.from('express_bids').update({ status: 'rejected' }).eq('job_id', jobId).neq('id', bid.id);
    await supabase.from('express_jobs').update({
      status: 'assigned', assigned_driver_id: bid.driver_id, assigned_bid_id: bid.id,
      final_amount: bid.amount, commission_rate: rate, commission_amount: commission.toFixed(2), driver_payout: payout.toFixed(2),
    }).eq('id', jobId);
    // Create held transaction (escrow)
    await supabase.from('express_transactions').insert([{
      job_id: jobId, client_id: user.id, driver_id: bid.driver_id,
      total_amount: bid.amount, commission_amount: commission.toFixed(2), driver_payout: payout.toFixed(2),
      payment_status: 'held', held_at: new Date().toISOString(),
    }]);
    // Notify driver in-app
    fetch('/api/notifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: bid.driver_id, type: 'job', title: 'Bid accepted!', message: `Your bid of $${bid.amount} has been accepted` }),
    }).catch(() => {});
    // Email driver
    if (bid.driver?.email) {
      fetch('/api/notifications/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: bid.driver.email, type: 'bid_accepted', data: { jobNumber: job.job_number, amount: bid.amount, pickupAddress: job.pickup_address } }),
      }).catch(() => {});
    }
    toast.success('Bid accepted — payment held in escrow');
    loadData();
  };

  const confirmDelivery = async () => {
    await supabase.from('express_jobs').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', jobId);
    // Release held payment via server API
    await fetch('/api/transactions/release', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, jobId }),
    });
    // Notify driver in-app
    fetch('/api/notifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: job.assigned_driver_id, type: 'delivery', title: 'Delivery confirmed!', message: `Delivery for ${job.job_number} confirmed. Payout: $${job.driver_payout}` }),
    }).catch(() => {});
    // Email driver - find driver email from accepted bid
    const acceptedBid = bids.find(b => b.status === 'accepted');
    if (acceptedBid?.driver?.email) {
      fetch('/api/notifications/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: acceptedBid.driver.email, type: 'delivery_confirmed', data: { jobNumber: job.job_number, payout: job.driver_payout } }),
      }).catch(() => {});
    }
    toast.success('Delivery confirmed');
    setShowRating(true);
    loadData();
  };

  const cancelJob = async () => {
    if (!confirm('Cancel this job?')) return;
    await supabase.from('express_jobs').update({ status: 'cancelled' }).eq('id', jobId);
    toast.info('Job cancelled');
    loadData();
  };

  const cancelJobWithEscrow = async () => {
    const amount = heldTxn ? `$${parseFloat(heldTxn.total_amount).toFixed(2)}` : '';
    if (!confirm(`Cancel this job and refund escrow${amount ? ` of ${amount}` : ''}? This cannot be undone.`)) return;
    try {
      const res = await fetch('/api/transactions/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, jobId, role: 'client' }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Failed to cancel job');
        return;
      }
      toast.success('Job cancelled — escrow refunded');
      loadData();
    } catch (e) {
      toast.error('Failed to cancel job');
    }
  };

  if (loading || !user || !job) return <Spinner />;

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '16px' };
  const statusColor = { open: '#3b82f6', bidding: '#8b5cf6', assigned: '#f59e0b', pickup_confirmed: '#f59e0b', in_transit: '#06b6d4', delivered: '#10b981', confirmed: '#10b981', completed: '#059669', cancelled: '#ef4444' };
  const showMap = ['assigned', 'pickup_confirmed', 'in_transit'].includes(job.status);
  const showChat = job.assigned_driver_id;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="My Jobs" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <a href="/client/jobs" style={{ color: '#64748b', fontSize: '13px', textDecoration: 'none' }}>← Back to Jobs</a>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginTop: '6px' }}>{job.job_number || 'Job Details'}</h1>
          </div>
          <span style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', background: `${statusColor[job.status]}15`, color: statusColor[job.status], textTransform: 'uppercase' }}>{job.status.replace(/_/g, ' ')}</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#f1f5f9', borderRadius: '10px', padding: '4px', flexWrap: 'wrap' }}>
          {['details', 'bids', ...(showMap ? ['tracking'] : []), ...(showChat ? ['messages'] : [])].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, minWidth: '70px', padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: tab === t ? 'white' : 'transparent', color: tab === t ? '#1e293b' : '#64748b',
              fontSize: '13px', fontWeight: '600', fontFamily: "'Inter', sans-serif",
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', textTransform: 'capitalize',
            }}>{t} {t === 'bids' ? `(${bids.length})` : ''}</button>
          ))}
        </div>

        {/* Details Tab */}
        {tab === 'details' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <div style={card}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>📍 Pickup</h3>
                <div style={{ fontSize: '14px', color: '#374151', marginBottom: '6px' }}>{job.pickup_address}</div>
                {job.pickup_contact && <div style={{ fontSize: '13px', color: '#64748b' }}>👤 {job.pickup_contact} {job.pickup_phone}</div>}
                {job.pickup_instructions && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>📝 {job.pickup_instructions}</div>}
              </div>
              <div style={card}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>📦 Delivery</h3>
                <div style={{ fontSize: '14px', color: '#374151', marginBottom: '6px' }}>{job.delivery_address}</div>
                {job.delivery_contact && <div style={{ fontSize: '13px', color: '#64748b' }}>👤 {job.delivery_contact} {job.delivery_phone}</div>}
                {job.delivery_instructions && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>📝 {job.delivery_instructions}</div>}
              </div>
            </div>
            <div style={card}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>📋 Item & Preferences</h3>
              <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr 1fr' : '1fr 1fr 1fr', gap: '12px' }}>
                <div><span style={{ fontSize: '12px', color: '#94a3b8' }}>Description</span><div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{job.item_description}</div></div>
                <div><span style={{ fontSize: '12px', color: '#94a3b8' }}>Category</span><div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', textTransform: 'capitalize' }}>{job.item_category}</div></div>
                <div><span style={{ fontSize: '12px', color: '#94a3b8' }}>Urgency</span><div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', textTransform: 'capitalize' }}>{job.urgency}</div></div>
                <div><span style={{ fontSize: '12px', color: '#94a3b8' }}>Budget</span><div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>${job.budget_min} - ${job.budget_max}</div></div>
                <div><span style={{ fontSize: '12px', color: '#94a3b8' }}>Vehicle</span><div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', textTransform: 'capitalize' }}>{job.vehicle_required}</div></div>
                {job.item_weight && <div><span style={{ fontSize: '12px', color: '#94a3b8' }}>Weight</span><div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{job.item_weight} kg</div></div>}
              </div>
              {job.final_amount && (
                <div style={{ marginTop: '16px', padding: '14px', background: '#f0fdf4', borderRadius: '10px' }}>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>Final Amount</div>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: '#059669' }}>${job.final_amount}</div>
                </div>
              )}
              {heldTxn && ['assigned', 'pickup_confirmed', 'in_transit', 'delivered'].includes(job.status) && (
                <div style={{ marginTop: '12px', padding: '12px 14px', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', background: '#f59e0b20', color: '#d97706' }}>HELD</span>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#92400e' }}>Payment held in escrow: ${parseFloat(heldTxn.total_amount).toFixed(2)}</span>
                </div>
              )}
            </div>
            {(job.pickup_photo || job.delivery_photo || job.invoice_file) && (
              <div style={card}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>📸 Delivery Evidence</h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {job.pickup_photo && <div><div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Pickup</div><img src={job.pickup_photo} alt="Pickup evidence" style={{ width: '160px', height: '120px', objectFit: 'cover', borderRadius: '10px' }} /></div>}
                  {job.delivery_photo && <div><div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Delivery</div><img src={job.delivery_photo} alt="Delivery evidence" style={{ width: '160px', height: '120px', objectFit: 'cover', borderRadius: '10px' }} /></div>}
                  {job.invoice_file && <div><div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Invoice</div><a href={job.invoice_file} target="_blank" style={{ color: '#3b82f6', fontSize: '14px' }}>📄 View Invoice</a></div>}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {job.status === 'delivered' && (
                <button onClick={confirmDelivery} style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>✅ Confirm Delivery & Pay</button>
              )}
              {job.status === 'confirmed' && !hasReview && (
                <button onClick={() => setShowRating(true)} style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>⭐ Rate Driver</button>
              )}
              {['open', 'bidding'].includes(job.status) && (
                <button onClick={cancelJob} style={{ padding: '12px 24px', borderRadius: '10px', border: '1px solid #ef4444', background: 'white', color: '#ef4444', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Cancel Job</button>
              )}
              {['assigned', 'pickup_confirmed'].includes(job.status) && (
                <button onClick={cancelJobWithEscrow} style={{ padding: '12px 24px', borderRadius: '10px', border: '1px solid #ef4444', background: 'white', color: '#ef4444', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Cancel Job & Refund</button>
              )}
            </div>
          </>
        )}

        {/* Bids Tab */}
        {tab === 'bids' && (
          <div>
            {bids.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>⏳</div>
                <p style={{ color: '#64748b', fontSize: '14px' }}>No bids yet. Drivers will start bidding soon!</p>
              </div>
            ) : (
              bids.map(bid => (
                <div key={bid.id} style={{ ...card, border: bid.status === 'accepted' ? '2px solid #10b981' : '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700', color: '#64748b' }}>{bid.driver?.contact_name?.[0] || 'D'}</div>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{bid.driver?.contact_name || 'Driver'}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{bid.driver?.vehicle_type} • {bid.driver?.vehicle_plate} • ⭐ {bid.driver?.driver_rating || '5.0'} • {bid.driver?.total_deliveries || 0} jobs</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669' }}>${bid.amount}</div>
                      {bid.estimated_time && <div style={{ fontSize: '12px', color: '#64748b' }}>⏱ {bid.estimated_time}</div>}
                    </div>
                  </div>
                  {bid.message && <div style={{ fontSize: '13px', color: '#374151', padding: '10px', background: '#f8fafc', borderRadius: '8px', marginBottom: '12px' }}>{bid.message}</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>{new Date(bid.created_at).toLocaleString()}</span>
                    {bid.status === 'pending' && ['open', 'bidding'].includes(job.status) ? (
                      <button onClick={() => acceptBid(bid)} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>✅ Accept Bid</button>
                    ) : (
                      <span style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', background: bid.status === 'accepted' ? '#f0fdf4' : '#fef2f2', color: bid.status === 'accepted' ? '#10b981' : '#ef4444', textTransform: 'capitalize' }}>{bid.status}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tracking Tab */}
        {tab === 'tracking' && showMap && (
          <div>
            <LiveMap jobId={jobId} driverId={job.assigned_driver_id} isDriver={false} />
          </div>
        )}

        {/* Messages Tab */}
        {tab === 'messages' && showChat && (
          <ChatBox jobId={jobId} userId={user.id} receiverId={job.assigned_driver_id} userRole="client" />
        )}

        {/* Rating Modal */}
        {showRating && job.assigned_driver_id && (
          <RatingModal
            jobId={jobId}
            clientId={user.id}
            driverId={job.assigned_driver_id}
            onClose={() => setShowRating(false)}
            onSubmitted={() => { setHasReview(true); loadData(); }}
          />
        )}
      </div>
    </div>
  );
}
