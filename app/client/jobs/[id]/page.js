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
import DisputeModal from '../../../components/DisputeModal';
import DisputeResolveModal from '../../../components/DisputeResolveModal';
import EditJobModal from '../../../components/EditJobModal';
import CallButtons from '../../../components/CallButtons';
import { supabase } from '../../../../lib/supabase';
import useMobile from '../../../components/useMobile';
import { useUnreadMessages } from '../../../components/UnreadMessagesContext';
import { use } from 'react';
import { getCategoryByKey, getEquipmentLabel } from '../../../../lib/constants';
import useLocale from '../../../components/useLocale';

export default function ClientJobDetail({ params }) {
  const resolvedParams = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const { locale } = useLocale();
  const dateLocale = locale === 'id' ? 'id-ID' : 'en-SG';
  const { unreadByJob, markJobRead } = useUnreadMessages();
  const [jobId] = useState(resolvedParams.id);
  const [job, setJob] = useState(null);
  const [bids, setBids] = useState([]);
  const [tab, setTab] = useState('details');
  const [showRating, setShowRating] = useState(false);
  const [hasReview, setHasReview] = useState(false);
  const [heldTxn, setHeldTxn] = useState(null);
  const [dispute, setDispute] = useState(null);
  const [showDispute, setShowDispute] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [acceptingProposal, setAcceptingProposal] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [assignedDriver, setAssignedDriver] = useState(null);
  const [acceptingBid, setAcceptingBid] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [topUpModal, setTopUpModal] = useState(null); // { available, required, shortfall, bid }
  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (jobId && user) loadData();
  }, [jobId, user, loading]);

  // Auto-mark messages read when viewing Messages tab
  useEffect(() => {
    if (tab === 'messages' && jobId && unreadByJob[jobId] > 0) {
      markJobRead(jobId);
    }
  }, [tab, jobId, unreadByJob, markJobRead]);

  // Handle payment=success query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      toast.success('Payment successful! Bid accepted.');
      window.history.replaceState({}, '', window.location.pathname);
    }
    // Auto-retry bid acceptance after returning from wallet top-up
    const pending = sessionStorage.getItem('pendingBidAccept');
    if (pending) {
      try {
        const { jobId: pJobId, bidId: pBidId } = JSON.parse(pending);
        if (pJobId === jobId) {
          sessionStorage.removeItem('pendingBidAccept');
          // Small delay to let page load, then retry
          setTimeout(() => acceptBid({ id: pBidId }), 1000);
        }
      } catch { sessionStorage.removeItem('pendingBidAccept'); }
    }
  }, []);

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
    const [jobRes, bidsRes, reviewRes, txnRes, disputeRes] = await Promise.all([
      supabase.from('express_jobs').select('*').eq('id', jobId).single(),
      supabase.from('express_bids').select('*, driver:driver_id(id, contact_name, phone, email, vehicle_type, vehicle_plate, driver_rating, total_deliveries)').eq('job_id', jobId).order('created_at', { ascending: true }),
      supabase.from('express_reviews').select('id').eq('job_id', jobId).eq('reviewer_role', 'client').limit(1),
      supabase.from('express_transactions').select('*').eq('job_id', jobId).eq('payment_status', 'held').maybeSingle(),
      supabase.from('express_disputes').select('*').eq('job_id', jobId).in('status', ['open', 'under_review']).maybeSingle(),
    ]);
    setJob(jobRes.data);
    setBids(bidsRes.data || []);
    setHasReview((reviewRes.data || []).length > 0);
    setHeldTxn(txnRes.data || null);
    setDispute(disputeRes.data || null);
    // Load assigned driver contact info
    if (jobRes.data?.assigned_driver_id) {
      const { data: driverData } = await supabase.from('express_users')
        .select('contact_name, phone').eq('id', jobRes.data.assigned_driver_id).single();
      setAssignedDriver(driverData);
    }
  };

  const rejectBid = async (bid) => {
    if (!confirm(`Reject this bid of $${bid.amount} from ${bid.driver?.contact_name || 'driver'}? They can re-bid with a different price.`)) return;
    try {
      const res = await fetch(`/api/bids/${bid.id}/reject`, { method: 'POST' });
      const result = await res.json();
      if (res.ok) {
        toast.success('Bid rejected. Driver has been notified.');
        loadData();
      } else {
        toast.error(result.error || 'Failed to reject bid');
      }
    } catch {
      toast.error('Failed to reject bid');
    }
  };

  const acceptBid = async (bid) => {
    if (acceptingBid) return;
    setAcceptingBid(bid.id);
    try {
      const res = await fetch('/api/wallet/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, bidId: bid.id }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success(`Bid accepted! $${result.payment.finalPaid} paid from wallet.`);
        loadData();
        return;
      }
      if (result.error === 'Insufficient wallet balance') {
        const available = parseFloat(result.available || 0);
        const required = parseFloat(result.required || 0);
        const shortfall = Math.ceil((required - available) * 100) / 100;
        setTopUpModal({ available: available.toFixed(2), required: required.toFixed(2), shortfall: shortfall.toFixed(2), bid });
        return;
      }
      toast.error(result.error || 'Payment failed');
    } catch (e) {
      toast.error('Payment failed. Please try again.');
    } finally {
      setAcceptingBid(null);
    }
  };

  const handleTopUpAndRetry = () => {
    if (!topUpModal?.bid) return;
    // Save pending bid info to sessionStorage so we can retry after top-up
    sessionStorage.setItem('pendingBidAccept', JSON.stringify({ jobId, bidId: topUpModal.bid.id, amount: topUpModal.shortfall }));
    setTopUpModal(null);
    router.push(`/client/wallet?topup=${topUpModal.shortfall}`);
  };

  const confirmDelivery = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      // Single server call: updates status to 'confirmed' + auto-releases escrow to driver
      const res = await fetch(`/api/jobs/${jobId}/status`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Failed to confirm delivery. Please try again.');
        loadData();
        return;
      }
      toast.success('Delivery confirmed — driver has been paid');
      setShowRating(true);
      loadData();
    } catch (e) {
      toast.error('Failed to confirm delivery. Please try again.');
    } finally {
      setConfirming(false);
    }
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
        body: JSON.stringify({ jobId }),
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
  const statusColor = { open: '#3b82f6', bidding: '#8b5cf6', assigned: '#f59e0b', pickup_confirmed: '#f59e0b', in_transit: '#06b6d4', delivered: '#10b981', confirmed: '#10b981', completed: '#059669', cancelled: '#ef4444', disputed: '#e11d48' };
  const showMap = ['assigned', 'pickup_confirmed', 'in_transit'].includes(job.status);
  const showChat = job.assigned_driver_id;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="My Deliveries" />
      <div style={{ flex: 1, padding: m ? '80px 16px 20px' : '30px', overflowX: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <a href="/client/jobs" style={{ color: '#64748b', fontSize: '13px', textDecoration: 'none' }}>← Back to Jobs</a>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginTop: '6px' }}>{job.job_number || 'Job Details'}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', background: `${statusColor[job.status]}15`, color: statusColor[job.status], textTransform: 'uppercase' }}>{job.status.replace(/_/g, ' ')}</span>
            {!['confirmed', 'completed', 'cancelled', 'disputed'].includes(job.status) && (
              <button onClick={() => setShowEdit(true)} style={{
                padding: '6px 14px', borderRadius: '8px', border: '1px solid #e2e8f0',
                background: 'white', color: '#3b82f6', fontSize: '13px', fontWeight: '600',
                cursor: 'pointer', fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', gap: '4px',
              }}>✏️ Edit</button>
            )}
          </div>
        </div>

        {/* Tabs */}
        {(() => {
          const pendingBids = bids.filter(b => b.status === 'pending').length;
          return (
            <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#f1f5f9', borderRadius: '10px', padding: '4px', flexWrap: 'wrap' }}>
              {['details', 'bids', ...(showMap ? ['tracking'] : []), ...(showChat ? ['messages'] : [])].map(t => (
                <button key={t} onClick={() => { setTab(t); if (t === 'messages') markJobRead(jobId); }} style={{
                  flex: 1, minWidth: '70px', padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: tab === t ? 'white' : t === 'bids' && pendingBids > 0 ? '#fff7ed' : 'transparent',
                  color: tab === t ? '#1e293b' : t === 'bids' && pendingBids > 0 ? '#ea580c' : '#64748b',
                  fontSize: '13px', fontWeight: tab === t || (t === 'bids' && pendingBids > 0) ? '700' : '600',
                  fontFamily: "'Inter', sans-serif",
                  boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', textTransform: 'capitalize',
                  position: 'relative',
                  animation: t === 'bids' && pendingBids > 0 && tab !== 'bids' ? 'bidPulse 2s ease-in-out infinite' : 'none',
                }}>
                  {t === 'bids' ? (pendingBids > 0 ? `🔔 Bids (${pendingBids} new)` : `Bids (${bids.length})`) : t}
                  {t === 'bids' && pendingBids > 0 && (
                    <span style={{
                      position: 'absolute', top: '2px', right: '2px',
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: '#ef4444', border: '2px solid white',
                    }} />
                  )}
                  {t === 'messages' && unreadByJob[jobId] > 0 && (
                    <span style={{
                      position: 'absolute', top: '4px', right: '4px',
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: '#ef4444',
                    }} />
                  )}
                </button>
              ))}
              <style>{`@keyframes bidPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }`}</style>
            </div>
          );
        })()}

        {/* Details Tab */}
        {tab === 'details' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <div style={card}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>📍 Pickup</h3>
                <div style={{ fontSize: '14px', color: '#374151', marginBottom: '6px' }}>{job.pickup_address}</div>
                {job.pickup_by && <div style={{ fontSize: '13px', color: '#3b82f6', fontWeight: '600', marginBottom: '6px' }}>📅 Pickup by: {new Date(job.pickup_by).toLocaleDateString(dateLocale,{ day: 'numeric', month: 'short', year: 'numeric' })}, {new Date(job.pickup_by).toLocaleTimeString(dateLocale,{ hour: 'numeric', minute: '2-digit', hour12: true })}</div>}
                {job.pickup_contact && <div style={{ fontSize: '13px', color: '#64748b' }}>👤 {job.pickup_contact} {job.pickup_phone}</div>}
                {job.pickup_instructions && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>📝 {job.pickup_instructions}</div>}
              </div>
              <div style={card}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>📦 Delivery</h3>
                <div style={{ fontSize: '14px', color: '#374151', marginBottom: '6px' }}>{job.delivery_address}</div>
                {job.deliver_by && <div style={{ fontSize: '13px', color: '#10b981', fontWeight: '600', marginBottom: '6px' }}>📅 Deliver by: {new Date(job.deliver_by).toLocaleDateString(dateLocale,{ day: 'numeric', month: 'short', year: 'numeric' })}, {new Date(job.deliver_by).toLocaleTimeString(dateLocale,{ hour: 'numeric', minute: '2-digit', hour12: true })}</div>}
                {job.delivery_contact && <div style={{ fontSize: '13px', color: '#64748b' }}>👤 {job.delivery_contact} {job.delivery_phone}</div>}
                {job.delivery_instructions && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>📝 {job.delivery_instructions}</div>}
              </div>
            </div>
            <div style={card}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>📋 Item & Preferences</h3>
              <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr 1fr' : '1fr 1fr 1fr', gap: '12px' }}>
                <div><span style={{ fontSize: '12px', color: '#94a3b8' }}>Description</span><div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{job.item_description}</div></div>
                <div><span style={{ fontSize: '12px', color: '#94a3b8' }}>Category</span><div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{getCategoryByKey(job.item_category).icon} {getCategoryByKey(job.item_category).label}</div></div>
                <div><span style={{ fontSize: '12px', color: '#94a3b8' }}>Urgency</span><div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', textTransform: 'capitalize' }}>{job.urgency}</div></div>
                <div><span style={{ fontSize: '12px', color: '#94a3b8' }}>Budget</span><div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>${job.budget_min} - ${job.budget_max}</div></div>
                <div><span style={{ fontSize: '12px', color: '#94a3b8' }}>Vehicle</span><div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', textTransform: 'capitalize' }}>{job.vehicle_required}</div></div>
                {job.item_weight && <div><span style={{ fontSize: '12px', color: '#94a3b8' }}>Weight</span><div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{job.item_weight} kg</div></div>}
                {job.manpower_count > 1 && <div><span style={{ fontSize: '12px', color: '#94a3b8' }}>Workers</span><div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{job.manpower_count} workers</div></div>}
              </div>
              {job.equipment_needed && job.equipment_needed.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Equipment</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {job.equipment_needed.map(eq => (
                      <span key={eq} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', background: '#eef2ff', color: '#4f46e5' }}>{getEquipmentLabel(eq)}</span>
                    ))}
                  </div>
                </div>
              )}
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
            {(job.pickup_photo || job.delivery_photo || job.invoice_file || job.customer_signature_url) && (
              <div style={card}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>📸 Delivery Evidence</h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {job.pickup_photo && <div><div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Pickup</div><img src={job.pickup_photo} alt="Pickup evidence" style={{ width: '160px', height: '120px', objectFit: 'cover', borderRadius: '10px' }} /></div>}
                  {job.delivery_photo && <div><div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Delivery</div><img src={job.delivery_photo} alt="Delivery evidence" style={{ width: '160px', height: '120px', objectFit: 'cover', borderRadius: '10px' }} /></div>}
                  {job.customer_signature_url && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Customer Signature</div>
                      <img src={job.customer_signature_url} alt="Customer signature" style={{ width: '160px', height: '100px', objectFit: 'contain', borderRadius: '10px', background: '#f8fafc', padding: '6px', border: '1px solid #e2e8f0' }} />
                      {job.signer_name && <div style={{ fontSize: '12px', color: '#374151', marginTop: '4px' }}>Signed by: {job.signer_name}</div>}
                      {job.signed_at && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{new Date(job.signed_at).toLocaleString()}</div>}
                    </div>
                  )}
                  {job.invoice_file && <div><div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Invoice</div><a href={job.invoice_file} target="_blank" style={{ color: '#3b82f6', fontSize: '14px' }}>📄 View Invoice</a></div>}
                </div>
              </div>
            )}
            {/* Download Receipt */}
            {['delivered', 'confirmed', 'completed'].includes(job.status) && (
              <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: job.invoice_url ? '#f0fdf4' : '#f8fafc', border: job.invoice_url ? '1px solid #bbf7d0' : '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: job.invoice_url ? '#059669' : '#374151' }}>{job.invoice_url ? 'Delivery Receipt' : 'Invoice'}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{job.invoice_url ? 'Auto-generated PDF receipt with proof of delivery' : 'Generate a PDF receipt for this delivery'}</div>
                </div>
                {job.invoice_url ? (
                  <a href={job.invoice_url} target="_blank" rel="noopener noreferrer" style={{
                    padding: '10px 20px', borderRadius: '8px', border: 'none',
                    background: '#059669', color: 'white', fontSize: '13px', fontWeight: '600',
                    textDecoration: 'none', display: 'inline-block',
                  }}>Download Receipt</a>
                ) : (
                  <button onClick={async () => {
                    try {
                      const res = await fetch(`/api/jobs/${job.id}/invoice`, { method: 'POST' });
                      const result = await res.json();
                      if (!res.ok) { toast.error(result.error || 'Failed to generate invoice'); return; }
                      toast.success('Invoice generated');
                      window.open(result.url, '_blank');
                      loadData();
                    } catch { toast.error('Failed to generate invoice'); }
                  }} style={{
                    padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white',
                    fontSize: '13px', fontWeight: '600', fontFamily: "'Inter', sans-serif",
                  }}>Generate Invoice</button>
                )}
              </div>
            )}
            {/* Dispute info card */}
            {dispute && (
              <div style={{ ...card, border: '1px solid #fecaca', background: '#fef2f2' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '18px' }}>⚠️</span>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#991b1b' }}>Active Dispute</h3>
                  <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', background: dispute.status === 'open' ? '#ef444420' : dispute.status === 'resolved' ? '#10b98120' : '#f59e0b20', color: dispute.status === 'open' ? '#ef4444' : dispute.status === 'resolved' ? '#10b981' : '#d97706', textTransform: 'uppercase' }}>{dispute.status.replace(/_/g, ' ')}</span>
                </div>
                <div style={{ fontSize: '13px', color: '#991b1b', marginBottom: '4px' }}><strong>Reason:</strong> {dispute.reason.replace(/_/g, ' ')}</div>
                <div style={{ fontSize: '13px', color: '#7f1d1d' }}>{dispute.description}</div>
                {dispute.evidence_photos && dispute.evidence_photos.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {dispute.evidence_photos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Evidence ${i + 1}`} style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #fecaca' }} />
                      </a>
                    ))}
                  </div>
                )}
                {/* Proposal status */}
                {dispute.proposed_by && dispute.proposed_resolution && dispute.status !== 'resolved' && (
                  <div style={{ marginTop: '10px', padding: '10px 12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                    <div style={{ fontSize: '13px', color: '#92400e', fontWeight: '600' }}>
                      {dispute.proposed_by === user?.id ? 'You' : 'Driver'} proposed: {dispute.proposed_resolution === 'full_refund' ? 'Full refund to customer' : dispute.proposed_resolution === 'full_release' ? 'Full payment to driver' : `Adjusted amount: $${parseFloat(dispute.proposed_amount).toFixed(2)} to driver`}
                    </div>
                    {dispute.proposed_by !== user?.id && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button onClick={async () => {
                          setAcceptingProposal(true);
                          try {
                            const res = await fetch('/api/disputes/propose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disputeId: dispute.id, action: 'accept' }) });
                            const result = await res.json();
                            if (res.ok) { toast.success('Settlement accepted!'); loadData(); } else { toast.error(result.error || 'Failed'); }
                          } catch { toast.error('Failed to accept'); }
                          setAcceptingProposal(false);
                        }} disabled={acceptingProposal} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", opacity: acceptingProposal ? 0.7 : 1 }}>{acceptingProposal ? 'Processing...' : 'Accept'}</button>
                        <button onClick={() => setShowResolve(true)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #f59e0b', background: 'white', color: '#f59e0b', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Counter</button>
                      </div>
                    )}
                    {dispute.proposed_by === user?.id && (
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>Waiting for the other party to accept or counter...</div>
                    )}
                  </div>
                )}
                {/* Resolve button */}
                {['open', 'under_review'].includes(dispute.status) && !dispute.proposed_by && (
                  <button onClick={() => setShowResolve(true)} style={{ marginTop: '10px', padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Resolve Dispute</button>
                )}
                {dispute.resolution_type && (
                  <div style={{ marginTop: '10px', padding: '10px 12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '13px', color: '#059669', fontWeight: '600' }}>
                      Resolved: {dispute.resolution_type === 'full_refund' ? 'Full refund to customer' : dispute.resolution_type === 'full_release' ? 'Full payment to driver' : `Adjusted: $${parseFloat(dispute.resolved_amount).toFixed(2)}`}
                    </div>
                  </div>
                )}
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>Opened {new Date(dispute.created_at).toLocaleString()}</div>
              </div>
            )}

            {/* Contact Driver */}
            {assignedDriver && job.assigned_driver_id && !['cancelled', 'completed'].includes(job.status) && (
              <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: '700', color: 'white' }}>{assignedDriver.contact_name?.[0] || 'D'}</div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{assignedDriver.contact_name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Assigned Driver</div>
                  </div>
                </div>
                <CallButtons phone={assignedDriver.phone} name={assignedDriver.contact_name} compact />
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {showMap && (
                <a href={`/client/track/${jobId}`} style={{
                  padding: '12px 24px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white',
                  fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                  textDecoration: 'none', display: 'inline-block',
                }}>🗺️ Track Live</a>
              )}
              {job.status === 'delivered' && (
                <button onClick={confirmDelivery} disabled={confirming} style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '14px', fontWeight: '600', cursor: confirming ? 'not-allowed' : 'pointer', fontFamily: "'Inter', sans-serif", opacity: confirming ? 0.7 : 1 }}>{confirming ? 'Processing...' : '✅ Confirm Delivery & Pay'}</button>
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
              {['assigned', 'pickup_confirmed', 'in_transit', 'delivered'].includes(job.status) && !dispute && (
                <button onClick={() => setShowDispute(true)} style={{ padding: '12px 24px', borderRadius: '10px', border: '1px solid #e11d48', background: 'white', color: '#e11d48', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>⚠️ Open Dispute</button>
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
                        <a href={`/profile/driver/${bid.driver?.id}`} style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', textDecoration: 'none' }}>{bid.driver?.contact_name || 'Driver'}</a>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{bid.driver?.vehicle_type} • {bid.driver?.vehicle_plate} • ⭐ {bid.driver?.driver_rating || '5.0'} • {bid.driver?.total_deliveries || 0} jobs</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {bid.equipment_charges && bid.equipment_charges.length > 0 ? (
                        <div>
                          <div style={{ fontSize: '13px', color: '#64748b' }}>Bid: ${parseFloat(bid.amount).toFixed(2)}</div>
                          {bid.equipment_charges.map((eq, i) => (
                            <div key={i} style={{ fontSize: '12px', color: '#64748b' }}>+ {eq.name}: ${parseFloat(eq.amount).toFixed(2)}</div>
                          ))}
                          <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '4px', paddingTop: '4px', fontSize: '20px', fontWeight: '800', color: '#059669' }}>
                            ${(parseFloat(bid.amount) + bid.equipment_charges.reduce((s, e) => s + parseFloat(e.amount), 0)).toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669' }}>${bid.amount}</div>
                      )}
                      {bid.estimated_time && <div style={{ fontSize: '12px', color: '#64748b' }}>⏱ {bid.estimated_time}</div>}
                    </div>
                  </div>
                  {bid.message && <div style={{ fontSize: '13px', color: '#374151', padding: '10px', background: '#f8fafc', borderRadius: '8px', marginBottom: '12px' }}>{bid.message}</div>}
                  {bid.driver?.phone && (
                    <div style={{ marginBottom: '12px' }}>
                      <CallButtons phone={bid.driver.phone} name={bid.driver.contact_name} compact />
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>{new Date(bid.created_at).toLocaleString()}</span>
                    {bid.status === 'pending' && ['open', 'bidding'].includes(job.status) ? (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => rejectBid(bid)} disabled={!!acceptingBid} style={{ padding: '12px 24px', borderRadius: '10px', border: '2px solid #ef4444', background: 'white', color: '#ef4444', fontSize: '15px', fontWeight: '700', cursor: acceptingBid ? 'not-allowed' : 'pointer', fontFamily: "'Inter', sans-serif", opacity: acceptingBid ? 0.5 : 1 }}>✕ Reject</button>
                        <button onClick={() => acceptBid(bid)} disabled={!!acceptingBid} style={{ padding: '12px 28px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '15px', fontWeight: '700', cursor: acceptingBid ? 'not-allowed' : 'pointer', fontFamily: "'Inter', sans-serif", opacity: acceptingBid === bid.id ? 0.7 : 1, boxShadow: '0 4px 14px rgba(16,185,129,0.3)' }}>{acceptingBid === bid.id ? 'Processing...' : '✅ Accept Bid'}</button>
                      </div>
                    ) : (
                      <span style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', background: bid.status === 'accepted' ? '#f0fdf4' : bid.status === 'outbid' ? '#fffbeb' : '#fef2f2', color: bid.status === 'accepted' ? '#10b981' : bid.status === 'outbid' ? '#d97706' : '#ef4444', textTransform: 'capitalize' }}>{bid.status === 'outbid' ? 'not selected' : bid.status}</span>
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
            <LiveMap jobId={jobId} driverId={job.assigned_driver_id} isDriver={false} locale={locale} />
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

        {/* Edit Job Modal */}
        {showEdit && (
          <EditJobModal
            job={job}
            onClose={() => setShowEdit(false)}
            onSaved={(updated, result) => {
              setJob(updated);
              setShowEdit(false);
              if (result?.assignmentCancelled) {
                toast.info('Job updated — vehicle changed, driver unassigned. Job re-opened for bidding.');
                loadData();
              } else if (result?.fareChanged) {
                const diff = result.newFare - result.oldFare;
                toast.success(`Job updated. Fare: $${result.oldFare.toFixed(2)} → $${result.newFare.toFixed(2)}${diff > 0 ? ` (+$${diff.toFixed(2)} charged)` : ` ($${Math.abs(diff).toFixed(2)} refunded)`}`);
              } else {
                toast.success('Job updated successfully');
              }
            }}
          />
        )}

        {/* Dispute Modal */}
        {showDispute && (
          <DisputeModal
            jobId={jobId}
            onClose={() => setShowDispute(false)}
            onSubmitted={() => loadData()}
          />
        )}

        {/* Dispute Resolve Modal */}
        {showResolve && dispute && (
          <DisputeResolveModal
            dispute={dispute}
            jobAmount={job.final_amount}
            onClose={() => setShowResolve(false)}
            onResolved={() => loadData()}
          />
        )}

        {/* Insufficient Balance Modal */}
        {topUpModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setTopUpModal(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '16px', padding: '28px', maxWidth: '400px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '8px' }}>💳</div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: 0 }}>Insufficient Balance</h3>
              </div>
              <div style={{ background: '#fef2f2', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#64748b', fontSize: '14px' }}>Required</span>
                  <span style={{ color: '#ef4444', fontSize: '14px', fontWeight: '700' }}>${topUpModal.required}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#64748b', fontSize: '14px' }}>Your balance</span>
                  <span style={{ color: '#1e293b', fontSize: '14px', fontWeight: '600' }}>${topUpModal.available}</span>
                </div>
                <div style={{ borderTop: '1px solid #fecaca', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#ef4444', fontSize: '14px', fontWeight: '600' }}>Shortfall</span>
                  <span style={{ color: '#ef4444', fontSize: '16px', fontWeight: '800' }}>${topUpModal.shortfall}</span>
                </div>
              </div>
              <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', marginBottom: '20px', lineHeight: '1.4' }}>
                Top up at least <strong>${topUpModal.shortfall}</strong> to accept this bid. After top-up, the bid will be accepted automatically.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setTopUpModal(null)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleTopUpAndRetry} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>Top Up Now</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
