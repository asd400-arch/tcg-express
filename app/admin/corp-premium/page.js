'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import { useToast } from '../../components/Toast';

const STATUS_COLORS = {
  draft: '#94a3b8', nda_pending: '#f59e0b', bidding_open: '#3b82f6', bidding_closed: '#8b5cf6',
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
                      <span style={badge(req.status, STATUS_COLORS)}>{req.status.replace(/_/g, ' ')}</span>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#374151' }}>{req.title}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                      {req.client?.company_name || req.client?.contact_name || '—'} | Budget: ${req.estimated_budget?.toLocaleString() || '—'}
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
                    <span style={badge(selected.status, STATUS_COLORS)}>{selected.status.replace(/_/g, ' ')}</span>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#374151' }}>{selected.title}</div>
                </div>
              </div>
              {selected.description && <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 12px 0' }}>{selected.description}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                <div><div style={{ fontSize: '11px', color: '#94a3b8' }}>Budget</div><div style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>${selected.estimated_budget?.toLocaleString() || '—'}</div></div>
                <div><div style={{ fontSize: '11px', color: '#94a3b8' }}>Start</div><div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{selected.start_date || '—'}</div></div>
                <div><div style={{ fontSize: '11px', color: '#94a3b8' }}>End</div><div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{selected.end_date || '—'}</div></div>
              </div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {(selected.vehicle_modes || []).map(v => <span key={v} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: '#f1f5f9', color: '#475569' }}>{v}</span>)}
                {(selected.certifications_required || []).map(c => <span key={c} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: '#fef3c7', color: '#92400e' }}>{c}</span>)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Min Fleet: {selected.min_fleet_size} | Min Rating: {selected.min_rating} | NDA: {selected.nda_accepted ? 'Accepted' : 'Pending'}</div>

              {/* Status Actions */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                {selected.status === 'nda_pending' && <button onClick={() => updateStatus(selected.id, 'bidding_open')} style={actionBtn('#3b82f6')}>Open Bidding</button>}
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
