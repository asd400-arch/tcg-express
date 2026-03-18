'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import useLocale from '../../components/useLocale';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import ChatBox from '../../components/ChatBox';
import LiveMap from '../../components/LiveMap';
import useGpsTracking from '../../components/useGpsTracking';
import { useToast } from '../../components/Toast';
import DisputeModal from '../../components/DisputeModal';
import DisputeResolveModal from '../../components/DisputeResolveModal';
import RatingModal from '../../components/RatingModal';
import SignaturePad from '../../components/SignaturePad';
import CallButtons from '../../components/CallButtons';
import { supabase } from '../../../lib/supabase';
import useMobile from '../../components/useMobile';
import { useUnreadMessages } from '../../components/UnreadMessagesContext';

export default function DriverMyJobs() {
  const { user, loading } = useAuth();
  const { locale } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const [jobs, setJobs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('active');
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [dispute, setDispute] = useState(null);
  const [showDispute, setShowDispute] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [acceptingProposal, setAcceptingProposal] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [hasReviewedClient, setHasReviewedClient] = useState(false);
  const [clientInfo, setClientInfo] = useState(null);
  const [pickupCoords, setPickupCoords] = useState(null);
  const [deliveryCoords, setDeliveryCoords] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [navModal, setNavModal] = useState(null);
  const { unreadByJob, markJobRead } = useUnreadMessages();
  const gps = useGpsTracking(user?.id, selected?.id, pickupCoords, deliveryCoords);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'driver') router.push('/');
    if (user && user.role === 'driver') { loadJobs(); loadQueue(); }
  }, [user, loading]);

  const loadJobs = async () => {
    const { data } = await supabase.from('express_jobs').select('*').eq('assigned_driver_id', user.id).order('created_at', { ascending: false });
    setJobs(data || []);
  };

  const loadQueue = async () => {
    setQueueLoading(true);
    try {
      const res = await fetch('/api/driver/queue');
      const result = await res.json();
      setQueue(result.data || []);
    } catch { setQueue([]); }
    setQueueLoading(false);
  };

  const completeQueueItem = async (queueItemId) => {
    const res = await fetch('/api/driver/queue', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', queue_item_id: queueItemId }),
    });
    const result = await res.json();
    if (result.nextJob) {
      toast.success('Next job auto-advanced to active!');
    }
    loadQueue();
  };

  const geocodeAddress = async (address) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`);
      const data = await res.json();
      if (data && data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch {}
    return null;
  };

  const selectJob = async (job) => {
    setSelected(job);
    setActiveTab('info');
    setPickupCoords(null);
    setDeliveryCoords(null);
    // Load dispute data, existing review, and client contact info
    const [disputeRes, reviewRes, clientRes] = await Promise.all([
      supabase.from('express_disputes').select('*').eq('job_id', job.id).in('status', ['open', 'under_review']).maybeSingle(),
      supabase.from('express_reviews').select('id').eq('job_id', job.id).eq('reviewer_role', 'driver').limit(1),
      supabase.from('express_users').select('contact_name, phone').eq('id', job.client_id).single(),
    ]);
    setDispute(disputeRes.data || null);
    setHasReviewedClient((reviewRes.data || []).length > 0);
    setClientInfo(clientRes.data || null);
    // Geocode pickup/delivery addresses for proximity detection
    if (job.pickup_address) geocodeAddress(job.pickup_address).then(setPickupCoords);
    if (job.delivery_address) geocodeAddress(job.delivery_address).then(setDeliveryCoords);
  };

  // Auto-mark messages read when viewing Messages tab
  useEffect(() => {
    if (activeTab === 'messages' && selected?.id && unreadByJob[selected.id] > 0) {
      markJobRead(selected.id);
    }
  }, [activeTab, selected?.id, unreadByJob, markJobRead]);

  // Auto-start GPS when viewing an in_transit job (handles page refresh)
  useEffect(() => {
    if (selected?.status === 'in_transit' && !gps.tracking) {
      gps.startTracking();
    }
  }, [selected?.id, selected?.status]);

  const handleSignatureSubmit = async (dataUrl, signerName) => {
    setShowSignature(false);
    try {
      // Convert base64 data URL to blob — use Blob constructor fallback for mobile browsers
      let blob;
      try {
        if (dataUrl.startsWith('data:')) {
          const parts = dataUrl.split(',');
          const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
          const byteStr = atob(parts[1]);
          const ab = new ArrayBuffer(byteStr.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
          blob = new Blob([ab], { type: mime });
        } else {
          const res = await fetch(dataUrl);
          blob = await res.blob();
        }
      } catch (blobErr) {
        console.error('Signature blob conversion failed:', blobErr);
        toast.error(`Signature capture failed: ${blobErr.message}`);
        return;
      }

      if (!blob || blob.size === 0) {
        toast.error('Signature is empty — please draw again');
        return;
      }

      const file = new File([blob], `signature_${Date.now()}.png`, { type: 'image/png' });
      const path = `delivery/${selected.id}/signature_${Date.now()}.png`;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', path);

      let uploadRes;
      try {
        uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      } catch (netErr) {
        console.error('Signature upload network error:', netErr);
        toast.error(`Upload network error: ${netErr.message}`);
        return;
      }

      const uploadResult = await uploadRes.json();
      if (!uploadRes.ok || !uploadResult.url) {
        console.error('Signature upload failed:', uploadResult);
        toast.error(`Signature upload failed: ${uploadResult.error || 'no URL returned'}`);
        return;
      }

      // Save signature data to job
      const signedAt = new Date().toISOString();
      const { error: dbErr } = await supabase.from('express_jobs').update({
        customer_signature_url: uploadResult.url,
        signer_name: signerName,
        signed_at: signedAt,
      }).eq('id', selected.id);

      if (dbErr) {
        console.error('Signature DB save failed:', dbErr);
        toast.error(`Signature saved to storage but DB update failed: ${dbErr.message}`);
        return;
      }

      setSelected(prev => ({ ...prev, customer_signature_url: uploadResult.url, signer_name: signerName, signed_at: signedAt }));
      toast.success('Signature captured');

      // Auto-proceed to mark delivered
      await updateStatus('delivered', true);
    } catch (e) {
      console.error('Signature save error:', e);
      toast.error(`Failed to save signature: ${e.message}`);
    }
  };

  const updateStatus = async (status, skipSignatureCheck) => {
    // Photo proof enforcement
    if (status === 'pickup_confirmed' && !selected.pickup_photo) {
      toast.error('Please upload a pickup photo first');
      setActiveTab('uploads');
      return;
    }
    if (status === 'delivered' && !selected.delivery_photo) {
      toast.error('Please upload a delivery photo first');
      setActiveTab('uploads');
      return;
    }
    // Signature enforcement for delivery
    if (status === 'delivered' && !skipSignatureCheck && !selected.customer_signature_url) {
      setShowSignature(true);
      return;
    }
    if (statusUpdating) return;
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/jobs/${selected.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Failed to update status');
        return;
      }
      // Auto-start GPS on in_transit, auto-stop on delivered
      if (status === 'in_transit') gps.startTracking();
      if (status === 'delivered') {
        gps.stopTracking();
        // Auto-complete queue item and advance next job
        const queueItem = queue.find(q => q.job_id === selected.id && ['active', 'picked_up'].includes(q.status));
        if (queueItem) await completeQueueItem(queueItem.id);
      }
      setSelected({ ...selected, ...(result.data || { status }) });
      loadJobs();
      loadQueue();
    } catch (e) {
      toast.error('Failed to update status');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `jobs/${selected.id}/${type}_${Date.now()}.${ext}`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const result = await res.json();
    if (!result.url) { toast.error('Upload failed'); setUploading(false); return; }
    const field = type === 'pickup' ? 'pickup_photo' : type === 'delivery' ? 'delivery_photo' : 'invoice_file';
    await supabase.from('express_jobs').update({ [field]: result.url }).eq('id', selected.id);
    setSelected({ ...selected, [field]: result.url });
    setUploading(false);
  };

  if (loading || !user) return <Spinner />;

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '16px' };
  const statusColor = { assigned: '#f59e0b', pickup_confirmed: '#f59e0b', in_transit: '#06b6d4', delivered: '#10b981', confirmed: '#10b981', completed: '#059669', cancelled: '#ef4444', disputed: '#e11d48' };
  const statusFlow = {
    assigned: { next: 'pickup_confirmed', label: '📸 Confirm Pickup', color: '#f59e0b' },
    pickup_confirmed: { next: 'in_transit', label: '🚚 Start Delivery', color: '#06b6d4' },
    in_transit: { next: 'delivered', label: '✅ Mark Delivered', color: '#10b981' },
  };

  const expressCount = queue.filter(q => q.job?.delivery_mode !== 'save_mode').length;
  const saveCount = queue.filter(q => q.job?.delivery_mode === 'save_mode').length;
  const hasSaveMode = saveCount > 0;
  const maxSlots = hasSaveMode ? 8 : 3;
  const totalQueued = queue.length;

  const openNavigation = (lat, lng, address) => {
    setNavModal({ lat, lng, address });
  };
  const navTo = (app) => {
    if (!navModal) return;
    const { lat, lng, address } = navModal;
    const dest = (lat && lng) ? `${lat},${lng}` : encodeURIComponent(address);
    const hasCoords = lat && lng;
    let url;
    if (app === 'google') {
      url = hasCoords
        ? `https://www.google.com/maps/dir/?api=1&destination=${dest}`
        : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
    } else {
      url = hasCoords
        ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
        : `https://waze.com/ul?q=${dest}&navigate=yes`;
    }
    window.open(url, '_blank');
    setNavModal(null);
  };

  const filtered = jobs.filter(j => {
    if (filter === 'active') return ['assigned','pickup_confirmed','in_transit','delivered','disputed'].includes(j.status);
    if (filter === 'cancelled') return j.status === 'cancelled';
    return ['confirmed','completed'].includes(j.status);
  });

  const showMap = selected && ['assigned','pickup_confirmed','in_transit'].includes(selected.status);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="My Jobs" />
      <div style={{ flex: 1, padding: m ? '80px 16px 20px' : '30px', overflowX: 'hidden' }}>
        {!selected ? (
          <>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>My Jobs</h1>

            {/* Queue Panel */}
            {queue.length > 0 && (
              <div style={{ ...card, background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)', border: '1px solid #bbf7d0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#059669', margin: 0 }}>Active Queue</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {expressCount > 0 && (
                      <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', background: '#06b6d420', color: '#0891b2' }}>
                        {expressCount}/{hasSaveMode ? '—' : '3'} Express
                      </span>
                    )}
                    {saveCount > 0 && (
                      <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', background: '#10b98120', color: '#059669' }}>
                        {saveCount}/8 SaveMode
                      </span>
                    )}
                    <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', background: '#64748b15', color: '#64748b' }}>
                      {totalQueued}/{maxSlots} slots
                    </span>
                  </div>
                </div>
                {/* Capacity bar */}
                <div style={{ height: '6px', background: '#d1fae5', borderRadius: '3px', marginBottom: '14px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min((totalQueued / maxSlots) * 100, 100)}%`, background: totalQueued >= maxSlots ? '#ef4444' : '#10b981', borderRadius: '3px', transition: 'width 0.3s' }} />
                </div>
                {/* Queue items */}
                {queue.map((item, idx) => {
                  const job = item.job || {};
                  const isActive = item.status === 'active' || item.status === 'picked_up';
                  const badge = isActive ? { label: 'ACTIVE', bg: '#10b98120', color: '#059669' }
                    : idx === 1 || (idx === 0 && !isActive) ? { label: 'NEXT UP', bg: '#f59e0b20', color: '#d97706' }
                    : { label: 'QUEUED', bg: '#64748b15', color: '#64748b' };
                  return (
                    <div key={item.id} onClick={() => selectJob(job)} style={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
                      background: isActive ? 'white' : '#f8faf9', borderRadius: '10px', marginBottom: idx < queue.length - 1 ? '8px' : 0,
                      cursor: 'pointer', border: isActive ? '1px solid #10b981' : '1px solid transparent',
                    }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isActive ? '#10b981' : '#e2e8f0', color: isActive ? 'white' : '#64748b',
                        fontSize: '13px', fontWeight: '800', flexShrink: 0,
                      }}>{item.queue_position}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>{job.job_number || '—'}</span>
                          <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '700', background: badge.bg, color: badge.color }}>{badge.label}</span>
                          {job.delivery_mode === 'save_mode' && (
                            <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '700', background: '#8b5cf620', color: '#7c3aed' }}>SAVE</span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {job.pickup_address || '—'} → {job.delivery_address || '—'}
                        </div>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#059669', flexShrink: 0 }}>${job.driver_payout || job.final_amount || '—'}</div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {['active', 'completed', 'cancelled'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: filter === f ? '#10b981' : '#e2e8f0', color: filter === f ? 'white' : '#64748b',
                  fontSize: '13px', fontWeight: '600', fontFamily: "'Inter', sans-serif", textTransform: 'capitalize',
                }}>{f}</button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: '40px' }}>
                <p style={{ color: '#64748b' }}>No {filter} jobs</p>
              </div>
            ) : filtered.map(job => (
              <div key={job.id} onClick={() => selectJob(job)} style={{ ...card, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{job.job_number}</span>
                      <span style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '700', background: `${statusColor[job.status]}15`, color: statusColor[job.status], textTransform: 'uppercase' }}>{job.status.replace(/_/g, ' ')}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#374151' }}>{job.item_description}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>📍 {job.pickup_address} → {job.delivery_address}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {unreadByJob[job.id] > 0 && (
                      <span style={{
                        fontSize: '10px', fontWeight: '700', minWidth: '18px', textAlign: 'center',
                        padding: '2px 6px', borderRadius: '10px', background: '#ef4444', color: 'white',
                      }}>{unreadByJob[job.id]}</span>
                    )}
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#059669' }}>${job.driver_payout || job.final_amount || '—'}</div>
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            {/* Header */}
            <div style={{ marginBottom: '20px' }}>
              <span onClick={() => setSelected(null)} style={{ color: '#64748b', fontSize: '13px', cursor: 'pointer' }}>← Back to My Jobs</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b' }}>{selected.job_number}</h1>
                <span style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', background: `${statusColor[selected.status]}15`, color: statusColor[selected.status], textTransform: 'uppercase' }}>{selected.status.replace(/_/g, ' ')}</span>
              </div>
            </div>

            {/* Status Action - Top Priority */}
            {statusFlow[selected.status] && (() => {
              const nextStatus = statusFlow[selected.status].next;
              const needsPhoto = (nextStatus === 'pickup_confirmed' && !selected.pickup_photo)
                || (nextStatus === 'delivered' && !selected.delivery_photo);
              const photoHint = nextStatus === 'pickup_confirmed' ? '⚠️ Upload pickup photo first'
                : nextStatus === 'delivered' ? '⚠️ Upload delivery photo first' : null;
              const isDisabled = needsPhoto || statusUpdating;
              return (
                <div style={{ marginBottom: '10px' }}>
                  <button onClick={() => !isDisabled && updateStatus(nextStatus)} disabled={isDisabled} style={{
                    padding: '16px 28px', borderRadius: '12px', border: 'none', width: '100%',
                    background: isDisabled
                      ? `linear-gradient(135deg, ${statusFlow[selected.status].color}80, ${statusFlow[selected.status].color}60)`
                      : `linear-gradient(135deg, ${statusFlow[selected.status].color}, ${statusFlow[selected.status].color}cc)`,
                    color: 'white', fontSize: '18px', fontWeight: '700', cursor: isDisabled ? 'not-allowed' : 'pointer', fontFamily: "'Inter', sans-serif",
                    boxShadow: isDisabled ? 'none' : `0 4px 14px ${statusFlow[selected.status].color}40`,
                    opacity: isDisabled ? 0.7 : 1,
                  }}>{statusUpdating ? 'Processing...' : statusFlow[selected.status].label}</button>
                  {needsPhoto && photoHint && (
                    <div style={{ textAlign: 'center', fontSize: '13px', color: '#ef4444', fontWeight: '700', marginTop: '6px' }}>
                      {photoHint}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Navigation Button */}
            {['assigned', 'pickup_confirmed'].includes(selected.status) && selected.pickup_address && (
              <button onClick={() => openNavigation(selected.pickup_lat, selected.pickup_lng, selected.pickup_address)} style={{
                width: '100%', padding: '14px 24px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white',
                fontSize: '16px', fontWeight: '700', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                boxShadow: '0 4px 14px rgba(59,130,246,0.3)', marginBottom: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}>🧭 Navigate to Pickup</button>
            )}
            {selected.status === 'in_transit' && selected.delivery_address && (
              <button onClick={() => openNavigation(selected.delivery_lat, selected.delivery_lng, selected.delivery_address)} style={{
                width: '100%', padding: '14px 24px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white',
                fontSize: '16px', fontWeight: '700', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                boxShadow: '0 4px 14px rgba(16,185,129,0.3)', marginBottom: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}>🧭 Navigate to Delivery</button>
            )}

            {/* GPS Tracking indicator */}
            {gps.tracking && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 2s infinite' }}></span>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#059669' }}>GPS Tracking Active</span>
                </div>
                <button onClick={gps.stopTracking} style={{
                  padding: '4px 12px', borderRadius: '6px', border: '1px solid #ef4444', background: 'white',
                  color: '#ef4444', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                }}>Stop GPS</button>
              </div>
            )}
            {gps.error && (
              <div style={{ padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', marginBottom: '10px', fontSize: '13px', color: '#dc2626' }}>
                ⚠️ GPS Error: {gps.error}
              </div>
            )}

            {/* Proximity alerts */}
            {gps.proximity.nearPickup && ['assigned', 'pickup_confirmed'].includes(selected.status) && (
              <div style={{ padding: '10px 16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', marginBottom: '10px', fontSize: '13px', fontWeight: '600', color: '#059669' }}>
                You are within {gps.proximity.pickupDistance}m of the pickup location
              </div>
            )}
            {gps.proximity.nearDelivery && ['in_transit'].includes(selected.status) && (
              <div style={{ padding: '10px 16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', marginBottom: '10px', fontSize: '13px', fontWeight: '600', color: '#059669' }}>
                You are within {gps.proximity.deliveryDistance}m of the delivery location
              </div>
            )}
            {gps.currentLocation && !gps.proximity.nearPickup && gps.proximity.pickupDistance !== null && ['assigned', 'pickup_confirmed'].includes(selected.status) && (
              <div style={{ padding: '8px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '10px', fontSize: '12px', color: '#64748b' }}>
                {(gps.proximity.pickupDistance / 1000).toFixed(1)}km to pickup
              </div>
            )}
            {gps.currentLocation && !gps.proximity.nearDelivery && gps.proximity.deliveryDistance !== null && ['in_transit'].includes(selected.status) && (
              <div style={{ padding: '8px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '10px', fontSize: '12px', color: '#64748b' }}>
                {(gps.proximity.deliveryDistance / 1000).toFixed(1)}km to delivery
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#f1f5f9', borderRadius: '10px', padding: '4px' }}>
              {['info', ...(showMap ? ['tracking'] : []), 'uploads', 'messages'].map(t => (
                <button key={t} onClick={() => { setActiveTab(t); if (t === 'messages' && selected) markJobRead(selected.id); }} style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: activeTab === t ? 'white' : 'transparent', color: activeTab === t ? '#1e293b' : '#64748b',
                  fontSize: '13px', fontWeight: '600', fontFamily: "'Inter', sans-serif",
                  boxShadow: activeTab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', textTransform: 'capitalize',
                  position: 'relative',
                }}>
                  {t === 'info' ? 'Job Info' : t}
                  {t === 'messages' && selected && unreadByJob[selected.id] > 0 && (
                    <span style={{
                      position: 'absolute', top: '4px', right: '4px',
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: '#ef4444',
                    }} />
                  )}
                </button>
              ))}
            </div>

            {/* Info Tab */}
            {activeTab === 'info' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: '16px' }}>
                  <div style={card}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '10px' }}>📍 Pickup</h3>
                    <div style={{ fontSize: '14px', color: '#374151' }}>{selected.pickup_address}</div>
                    {selected.pickup_contact && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>👤 {selected.pickup_contact} {selected.pickup_phone}</div>}
                    {selected.pickup_instructions && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>📝 {selected.pickup_instructions}</div>}
                    {['assigned', 'pickup_confirmed'].includes(selected.status) && selected.pickup_address && (
                      <button onClick={() => openNavigation(selected.pickup_lat, selected.pickup_lng, selected.pickup_address)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '10px', padding: '8px 14px',
                        borderRadius: '8px', background: '#3b82f6', color: 'white', fontSize: '12px', fontWeight: '600',
                        border: 'none', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                      }}>🧭 Navigate</button>
                    )}
                  </div>
                  <div style={card}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '10px' }}>📦 Delivery</h3>
                    <div style={{ fontSize: '14px', color: '#374151' }}>{selected.delivery_address}</div>
                    {selected.delivery_contact && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>👤 {selected.delivery_contact} {selected.delivery_phone}</div>}
                    {selected.delivery_instructions && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>📝 {selected.delivery_instructions}</div>}
                    {selected.status === 'in_transit' && selected.delivery_address && (
                      <button onClick={() => openNavigation(selected.delivery_lat, selected.delivery_lng, selected.delivery_address)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '10px', padding: '8px 14px',
                        borderRadius: '8px', background: '#10b981', color: 'white', fontSize: '12px', fontWeight: '600',
                        border: 'none', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                      }}>🧭 Navigate</button>
                    )}
                  </div>
                </div>

                {/* Contact Client */}
                {clientInfo && !['cancelled', 'completed'].includes(selected.status) && (
                  <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: '700', color: 'white' }}>{clientInfo.contact_name?.[0] || 'C'}</div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{clientInfo.contact_name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>Client</div>
                      </div>
                    </div>
                    <CallButtons phone={clientInfo.phone} name={clientInfo.contact_name} compact />
                  </div>
                )}

                <div style={{ ...card, display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                  <div><div style={{ fontSize: '12px', color: '#94a3b8' }}>Total</div><div style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>${selected.final_amount || '—'}</div></div>
                  <div><div style={{ fontSize: '12px', color: '#94a3b8' }}>Commission ({selected.commission_rate || 0}%)</div><div style={{ fontSize: '20px', fontWeight: '800', color: '#ef4444' }}>-${selected.commission_amount || '0'}</div></div>
                  <div><div style={{ fontSize: '12px', color: '#94a3b8' }}>Your Payout</div><div style={{ fontSize: '20px', fontWeight: '800', color: '#059669' }}>${selected.driver_payout || '—'}</div></div>
                </div>

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
                          {dispute.proposed_by === user?.id ? 'You' : 'Customer'} proposed: {dispute.proposed_resolution === 'full_refund' ? 'Full refund to customer' : dispute.proposed_resolution === 'full_release' ? 'Full payment to driver' : `Adjusted amount: $${parseFloat(dispute.proposed_amount).toFixed(2)} to driver`}
                        </div>
                        {dispute.proposed_by !== user?.id && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <button onClick={async () => {
                              setAcceptingProposal(true);
                              try {
                                const res = await fetch('/api/disputes/propose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disputeId: dispute.id, action: 'accept' }) });
                                const result = await res.json();
                                if (res.ok) { toast.success('Settlement accepted!'); loadJobs(); selectJob({ ...selected }); } else { toast.error(result.error || 'Failed'); }
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

                {/* Dispute: drivers cannot open disputes — only clients and admins can */}

                {/* Rate Client button */}
                {['confirmed', 'completed'].includes(selected.status) && !hasReviewedClient && (
                  <button onClick={() => setShowRating(true)} style={{
                    padding: '12px 24px', borderRadius: '10px', border: 'none',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white',
                    fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                  }}>⭐ Rate Client</button>
                )}
              </>
            )}

            {/* Tracking Tab */}
            {activeTab === 'tracking' && showMap && (
              <LiveMap jobId={selected.id} driverId={user.id} isDriver={true} driverLocation={gps.currentLocation} locationHistory={gps.locationHistory} locale={locale} />
            )}

            {/* Uploads Tab */}
            {activeTab === 'uploads' && (<>
              <div style={card}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>📸 Upload Evidence</h3>
                <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr 1fr', gap: '16px' }}>
                  {[
                    { key: 'pickup', label: 'Pickup Photo', field: 'pickup_photo' },
                    { key: 'delivery', label: 'Delivery Photo', field: 'delivery_photo' },
                    { key: 'invoice', label: 'Invoice/Receipt', field: 'invoice_file' },
                  ].map(item => (
                    <div key={item.key} style={{ border: '2px dashed #e2e8f0', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '10px' }}>{item.label}</label>
                      {selected[item.field] ? (
                        <div>
                          {item.key !== 'invoice' ? (
                            <img src={selected[item.field]} alt={item.label} style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '8px' }} />
                          ) : (
                            <a href={selected[item.field]} target="_blank" style={{ color: '#3b82f6', fontSize: '14px', fontWeight: '600' }}>📄 View File</a>
                          )}
                          <div style={{ fontSize: '11px', color: '#10b981', fontWeight: '600', marginTop: '8px' }}>✓ Uploaded</div>
                        </div>
                      ) : (
                        <label style={{ cursor: 'pointer', display: 'block' }}>
                          <div style={{ fontSize: '32px', marginBottom: '8px' }}>{item.key === 'invoice' ? '📄' : '📷'}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>Tap to upload</div>
                          <input type="file" accept={item.key === 'invoice' ? '.pdf,.jpg,.png' : 'image/*'} capture={item.key !== 'invoice' ? 'environment' : undefined} onChange={e => handleFileUpload(e, item.key)} style={{ display: 'none' }} disabled={uploading} />
                        </label>
                      )}
                    </div>
                  ))}
                </div>
                {uploading && <div style={{ marginTop: '12px', color: '#3b82f6', fontSize: '13px', fontWeight: '600', textAlign: 'center' }}>Uploading...</div>}

                {/* Customer Signature Preview */}
                {selected.customer_signature_url && (
                  <div style={{ marginTop: '16px', padding: '16px', border: '1px solid #d1fae5', borderRadius: '12px', background: '#f0fdf4' }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#059669', display: 'block', marginBottom: '10px' }}>Customer Signature</label>
                    <img src={selected.customer_signature_url} alt="Customer signature" style={{ maxWidth: '200px', maxHeight: '100px', borderRadius: '8px', background: 'white', padding: '8px', border: '1px solid #e2e8f0' }} />
                    {selected.signer_name && <div style={{ fontSize: '12px', color: '#374151', marginTop: '6px' }}>Signed by: {selected.signer_name}</div>}
                    {selected.signed_at && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{new Date(selected.signed_at).toLocaleString()}</div>}
                  </div>
                )}
              </div>

              {/* Download Receipt */}
              {selected.invoice_url && ['delivered', 'confirmed', 'completed'].includes(selected.status) && (
                <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#059669' }}>Delivery Receipt</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Auto-generated PDF receipt</div>
                  </div>
                  <a href={selected.invoice_url} target="_blank" rel="noopener noreferrer" style={{
                    padding: '8px 16px', borderRadius: '8px', border: 'none',
                    background: '#059669', color: 'white', fontSize: '13px', fontWeight: '600',
                    textDecoration: 'none', display: 'inline-block',
                  }}>Download</a>
                </div>
              )}
            </>)}

            {/* Messages Tab */}
            {activeTab === 'messages' && (
              <ChatBox jobId={selected.id} userId={user.id} receiverId={selected.client_id} userRole="driver" />
            )}
          </>
        )}

        {/* Rating Modal */}
        {showRating && selected && (
          <RatingModal
            jobId={selected.id}
            clientId={selected.client_id}
            driverId={user.id}
            reviewerRole="driver"
            onClose={() => setShowRating(false)}
            onSubmitted={() => { setHasReviewedClient(true); }}
          />
        )}

        {/* Dispute Modal */}
        {showDispute && selected && (
          <DisputeModal
            jobId={selected.id}
            onClose={() => setShowDispute(false)}
            onSubmitted={() => { loadJobs(); selectJob({ ...selected, status: 'disputed' }); }}
          />
        )}

        {/* Dispute Resolve Modal */}
        {showResolve && dispute && selected && (
          <DisputeResolveModal
            dispute={dispute}
            jobAmount={selected.final_amount}
            onClose={() => setShowResolve(false)}
            onResolved={() => { loadJobs(); selectJob(selected); }}
          />
        )}

        {/* Signature Pad Modal */}
        {showSignature && selected && (
          <SignaturePad
            onSave={handleSignatureSubmit}
            onClose={() => setShowSignature(false)}
          />
        )}

        {/* Navigation App Picker */}
        {navModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '20px' }} onClick={() => setNavModal(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '20px 20px 16px 16px', padding: '24px', maxWidth: '400px', width: '100%' }}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', textAlign: 'center', marginBottom: '18px' }}>Open with</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={() => navTo('google')} style={{
                  padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white',
                  fontSize: '15px', fontWeight: '600', color: '#1e293b', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                }}>
                  <span style={{ fontSize: '20px' }}>🗺️</span> Google Maps
                </button>
                <button onClick={() => navTo('waze')} style={{
                  padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white',
                  fontSize: '15px', fontWeight: '600', color: '#1e293b', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                }}>
                  <span style={{ fontSize: '20px' }}>🚗</span> Waze
                </button>
              </div>
              <button onClick={() => setNavModal(null)} style={{
                width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: '#f1f5f9',
                color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", marginTop: '10px',
              }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
