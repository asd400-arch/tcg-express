'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import { useToast } from '../../components/Toast';

const STATUS_COLORS = {
  draft: '#94a3b8', nda_pending: '#f59e0b', submitted: '#f59e0b', bidding_open: '#3b82f6', bidding_closed: '#8b5cf6',
  awarded: '#10b981', active: '#059669', completed: '#064e3b', cancelled: '#ef4444',
};

const BID_COLORS = { pending: '#f59e0b', shortlisted: '#3b82f6', accepted: '#10b981', rejected: '#ef4444', withdrawn: '#94a3b8' };

export default function AdminCorpPremiumPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [bids, setBids] = useState([]);
  const [bidsLoading, setBidsLoading] = useState(false);

  useEffect(() => { fetchRequests(); }, []);

  const fetchRequests = async () => {
    const res = await fetch('/api/corp-premium');
    const data = await res.json();
    setRequests(data.data || []);
  };

  const selectRequest = async (req) => {
    setSelected(req);
    setBidsLoading(true);
    try {
      const res = await fetch(`/api/corp-premium/${req.id}/bids`);
      const data = await res.json();
      setBids(data.data || []);
    } catch { setBids([]); }
    setBidsLoading(false);
  };

  const updateStatus = async (requestId, status) => {
    const res = await fetch(`/api/corp-premium/${requestId}/bids`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_status', status }),
    });
    if (res.ok) { toast.success(`Status updated to ${status.replace(/_/g, ' ')}`); fetchRequests(); setSelected({ ...selected, status }); }
    else toast.error('Update failed');
  };

  const handleBidAction = async (bidId, action) => {
    const res = await fetch(`/api/corp-premium/${selected.id}/bids`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, bid_id: bidId }),
    });
    if (res.ok) {
      toast.success(`Bid ${action}ed`);
      selectRequest(selected);
      if (action === 'accept') fetchRequests();
    } else toast.error('Action failed');
  };

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '16px' };
  const badge = (status, colorMap) => ({ padding: '3px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', background: `${colorMap[status] || '#94a3b8'}15`, color: colorMap[status] || '#94a3b8', textTransform: 'uppercase' });
  const sectionLabel = { fontSize: '11px', color: '#94a3b8', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' };

  if (!user || user.role !== 'admin') return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Corp Premium" />
      <div style={{ flex: 1, padding: '30px', maxWidth: '960px' }}>
        {!selected ? (
          <>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>🏆 Corp Premium Requests</h1>
            {requests.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: '40px' }}><p style={{ color: '#64748b' }}>No corp premium requests yet.</p></div>
            ) : requests.map(req => (
              <div key={req.id} onClick={() => selectRequest(req)} style={{ ...card, cursor: 'pointer', borderLeft: `4px solid ${STATUS_COLORS[req.status] || '#94a3b8'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{req.request_number || '—'}</span>
                      <span style={badge(req.status, STATUS_COLORS)}>{(req.status || '').replace(/_/g, ' ')}</span>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#374151' }}>{req.title}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                      {req.client?.company_name || req.client?.contact_name || '—'} | Budget: {req.estimated_budget ? `$${Number(req.estimated_budget).toLocaleString()}/mo` : '—'}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>{new Date(req.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            <span onClick={() => setSelected(null)} style={{ color: '#64748b', fontSize: '13px', cursor: 'pointer' }}>← Back to Requests</span>

            {/* Request Detail */}
            <div style={{ ...card, marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', margin: 0 }}>{selected.request_number}</h2>
                    <span style={badge(selected.status, STATUS_COLORS)}>{(selected.status || '').replace(/_/g, ' ')}</span>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#374151' }}>{selected.title}</div>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {new Date(selected.created_at).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>

              {/* Client Info */}
              {selected.client && (
                <div style={{ background: '#f0f9ff', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', border: '1px solid #bae6fd' }}>
                  <div style={sectionLabel}>👤 CLIENT</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{selected.client.company_name || selected.client.contact_name || '—'}</div>
                  {selected.client.company_name && selected.client.contact_name && <div style={{ fontSize: '12px', color: '#64748b' }}>{selected.client.contact_name}</div>}
                  {selected.client.email && <div style={{ fontSize: '12px', color: '#64748b' }}>{selected.client.email}</div>}
                  {selected.client.phone && <div style={{ fontSize: '12px', color: '#64748b' }}>{selected.client.phone}</div>}
                </div>
              )}

              {selected.description && <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 16px 0', lineHeight: '1.6' }}>{selected.description}</p>}

              {/* Budget / Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Budget</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>{selected.estimated_budget ? `$${Number(selected.estimated_budget).toLocaleString()}` : '—'}</div>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Start</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{selected.start_date || '—'}</div>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>End</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{selected.end_date || '—'}</div>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Duration</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{selected.contract_duration || '—'}</div>
                </div>
              </div>

              {/* Volume */}
              {selected.estimated_volume && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Estimated Volume</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{selected.estimated_volume}</div>
                </div>
              )}

              {/* Locations */}
              {selected.locations && selected.locations.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={sectionLabel}>📍 LOCATIONS</div>
                  {selected.locations.map((loc, i) => (
                    <div key={i} style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px', borderLeft: `3px solid ${loc.type === 'pickup' ? '#3b82f6' : '#10b981'}` }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: loc.type === 'pickup' ? '#3b82f6' : '#10b981', textTransform: 'uppercase' }}>{loc.type}</div>
                      <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: '500' }}>{loc.address || '—'}</div>
                      {(loc.contact || loc.phone) && <div style={{ fontSize: '11px', color: '#64748b' }}>{[loc.contact, loc.phone].filter(Boolean).join(' · ')}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* Regions */}
              {((selected.pickup_regions && selected.pickup_regions.length > 0) || (selected.delivery_regions && selected.delivery_regions.length > 0)) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  {selected.pickup_regions && selected.pickup_regions.length > 0 && (
                    <div><div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', marginBottom: '4px' }}>Pickup Regions</div><div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>{selected.pickup_regions.map(r => <span key={r} style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: '#dbeafe', color: '#1d4ed8' }}>{r}</span>)}</div></div>
                  )}
                  {selected.delivery_regions && selected.delivery_regions.length > 0 && (
                    <div><div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', marginBottom: '4px' }}>Delivery Regions</div><div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>{selected.delivery_regions.map(r => <span key={r} style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: '#d1fae5', color: '#059669' }}>{r}</span>)}</div></div>
                  )}
                </div>
              )}

              {/* Vehicles & Certifications */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {(selected.vehicle_modes || selected.vehicle_types || []).map(v => <span key={v} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: '#f1f5f9', color: '#475569' }}>🚛 {v}</span>)}
                {(selected.certifications_required || []).map(c => <span key={c} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: '#fef3c7', color: '#92400e' }}>📜 {c}</span>)}
              </div>

              {/* Special Requirements */}
              {selected.special_requirements && (
                <div style={{ background: '#fffbeb', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '11px', color: '#92400e', fontWeight: '700', marginBottom: '4px' }}>⚠️ SPECIAL REQUIREMENTS</div>
                  <div style={{ fontSize: '13px', color: '#78350f', lineHeight: '1.5' }}>{selected.special_requirements}</div>
                </div>
              )}

              {/* Attachments */}
              {selected.attachments && selected.attachments.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={sectionLabel}>📎 ATTACHMENTS</div>
                  {selected.attachments.map((att, i) => {
                    const name = typeof att === 'string' ? att.split('/').pop() : (att.name || att.filename || `Attachment ${i + 1}`);
                    const url = typeof att === 'string' ? att : att.url;
                    return (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', marginBottom: '4px', textDecoration: 'none', border: '1px solid #e2e8f0' }}>
                        <span>📄</span>
                        <span style={{ fontSize: '13px', color: '#3b82f6', fontWeight: '500' }}>{decodeURIComponent(name)}</span>
                      </a>
                    );
                  })}
                </div>
              )}

              <div style={{ fontSize: '12px', color: '#64748b', padding: '8px 0', borderTop: '1px solid #f1f5f9' }}>
                Min Fleet: {selected.min_fleet_size} | Min Rating: {selected.min_rating} | NDA: {selected.nda_accepted ? '✅ Accepted' : '⏳ Pending'}
              </div>

              {/* Status Actions */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                {['nda_pending', 'submitted'].includes(selected.status) && <button onClick={() => updateStatus(selected.id, 'bidding_open')} style={actionBtn('#3b82f6')}>Open Bidding</button>}
                {selected.status === 'bidding_open' && <button onClick={() => updateStatus(selected.id, 'bidding_closed')} style={actionBtn('#8b5cf6')}>Close Bidding</button>}
                {['bidding_open', 'bidding_closed'].includes(selected.status) && <button onClick={() => updateStatus(selected.id, 'cancelled')} style={actionBtn('#ef4444')}>Cancel</button>}
                {selected.status === 'awarded' && <button onClick={() => updateStatus(selected.id, 'active')} style={actionBtn('#059669')}>Activate</button>}
                {selected.status === 'active' && <button onClick={() => updateStatus(selected.id, 'completed')} style={actionBtn('#064e3b')}>Complete</button>}
              </div>
            </div>

            {/* Bids */}
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>Bids ({bids.length})</h3>
            {bidsLoading ? <p style={{ color: '#64748b' }}>Loading bids...</p> : bids.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: '30px' }}><p style={{ color: '#64748b' }}>No bids submitted yet.</p></div>
            ) : bids.map(bid => (
              <div key={bid.id} style={{ ...card, borderLeft: `4px solid ${BID_COLORS[bid.status] || '#94a3b8'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{bid.partner?.company_name || bid.partner?.contact_name || 'Partner'}</span>
                      <span style={badge(bid.status, BID_COLORS)}>{bid.status}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                      Fleet: {bid.fleet_size} | Rating: {bid.partner?.avg_rating || '—'} | Vehicles: {(bid.proposed_vehicles || []).join(', ') || '—'}
                    </div>
                    {bid.proposal_text && <div style={{ fontSize: '13px', color: '#475569', marginTop: '6px' }}>{bid.proposal_text}</div>}
                    {(bid.certifications || []).length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                        {bid.certifications.map(c => <span key={c} style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', background: '#fef3c7', color: '#92400e' }}>{c}</span>)}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>${bid.bid_amount?.toLocaleString()}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(bid.created_at).toLocaleDateString()}</div>
                    {['pending', 'shortlisted'].includes(bid.status) && ['bidding_open', 'bidding_closed'].includes(selected.status) && (
                      <div style={{ display: 'flex', gap: '4px', marginTop: '8px', justifyContent: 'flex-end' }}>
                        {bid.status === 'pending' && <button onClick={() => handleBidAction(bid.id, 'shortlist')} style={smallBtn('#3b82f6')}>Shortlist</button>}
                        <button onClick={() => handleBidAction(bid.id, 'accept')} style={smallBtn('#10b981')}>Accept</button>
                        <button onClick={() => handleBidAction(bid.id, 'reject')} style={smallBtn('#ef4444')}>Reject</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function actionBtn(color) {
  return { padding: '8px 16px', borderRadius: '8px', border: 'none', background: color, color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" };
}

function smallBtn(color) {
  return { padding: '4px 10px', borderRadius: '6px', border: `1px solid ${color}`, background: 'white', color, fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" };
}
