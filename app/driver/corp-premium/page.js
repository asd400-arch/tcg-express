'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import useMobile from '../../components/useMobile';
import { VEHICLE_MODES } from '../../../lib/fares';

export default function DriverCorpPremium() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const [requests, setRequests] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [detailReq, setDetailReq] = useState(null);
  const [bidModal, setBidModal] = useState(null);
  const [myBids, setMyBids] = useState({});
  const [bidForm, setBidForm] = useState({ bid_amount: '', fleet_size: '1', proposed_vehicles: '', proposal_text: '', certifications: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'admin') router.push('/');
    if (user && user.role === 'admin') loadData();
  }, [user, loading]);

  const loadData = async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/corp-premium');
      const result = await res.json();
      setRequests(result.data || []);

      // Load my bids for each request
      const bidsMap = {};
      for (const req of (result.data || [])) {
        try {
          const bidsRes = await fetch(`/api/corp-premium/${req.id}/bids`);
          const bidsResult = await bidsRes.json();
          if (bidsResult.data) {
            const myBid = bidsResult.data.find(b => b.partner_id === user.id);
            if (myBid) bidsMap[req.id] = myBid;
          }
        } catch {}
      }
      setMyBids(bidsMap);
    } catch {
      toast.error('Failed to load Corp Premium requests');
    }
    setFetching(false);
  };

  const submitBid = async () => {
    if (!bidModal || !bidForm.bid_amount) return;
    if (parseFloat(bidForm.bid_amount) <= 0) { toast.error('Bid amount must be greater than 0'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/corp-premium/${bidModal.id}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          bid_amount: parseFloat(bidForm.bid_amount),
          fleet_size: parseInt(bidForm.fleet_size) || 1,
          proposed_vehicles: bidForm.proposed_vehicles ? bidForm.proposed_vehicles.split(',').map(v => v.trim()).filter(Boolean) : [],
          proposal_text: bidForm.proposal_text || null,
          certifications: bidForm.certifications ? bidForm.certifications.split(',').map(c => c.trim()).filter(Boolean) : [],
        }),
      });
      const result = await res.json();
      if (!res.ok) { toast.error(result.error || 'Failed to submit bid'); setSubmitting(false); return; }
      toast.success('Bid submitted successfully!');
      setBidModal(null);
      setBidForm({ bid_amount: '', fleet_size: '1', proposed_vehicles: '', proposal_text: '', certifications: '' });
      setSubmitting(false);
      loadData();
    } catch {
      toast.error('Failed to submit bid');
      setSubmitting(false);
    }
  };

  if (loading || !user) return <Spinner />;

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' };
  const input = { width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' };
  const label = { fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' };

  const getVehicleLabels = (modes) => {
    if (!modes || modes.length === 0) return 'Any';
    return modes.map(k => {
      const v = VEHICLE_MODES.find(vm => vm.key === k);
      return v ? `${v.icon} ${v.label}` : k;
    }).join(', ');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Corp Premium" />
      <div style={{ flex: 1, padding: m ? '80px 16px 20px' : '30px', overflowX: 'hidden' }}>

        {/* Bid Modal */}
        {bidModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: 'white', borderRadius: '20px', padding: '30px', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Submit Bid</h3>
                <div onClick={() => setBidModal(null)} style={{ cursor: 'pointer', fontSize: '20px', color: '#94a3b8' }}>&#10005;</div>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>{bidModal.title}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>{bidModal.client?.company_name || 'Corporate Client'}</div>
                {bidModal.estimated_budget > 0 && (
                  <div style={{ fontSize: '13px', color: '#10b981', fontWeight: '700', marginTop: '6px' }}>Budget: ${parseFloat(bidModal.estimated_budget).toLocaleString()}</div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={label}>Bid Amount ($) *</label>
                  <input type="number" style={input} value={bidForm.bid_amount} onChange={e => setBidForm(p => ({ ...p, bid_amount: e.target.value }))} placeholder="Total bid amount" />
                </div>
                <div>
                  <label style={label}>Fleet Size</label>
                  <input type="number" style={input} value={bidForm.fleet_size} onChange={e => setBidForm(p => ({ ...p, fleet_size: e.target.value }))} placeholder="Number of vehicles" min="1" />
                </div>
                <div>
                  <label style={label}>Proposed Vehicles</label>
                  <input style={input} value={bidForm.proposed_vehicles} onChange={e => setBidForm(p => ({ ...p, proposed_vehicles: e.target.value }))} placeholder="e.g. 2x 14ft Lorry, 1x Van (comma-separated)" />
                </div>
                <div>
                  <label style={label}>Certifications</label>
                  <input style={input} value={bidForm.certifications} onChange={e => setBidForm(p => ({ ...p, certifications: e.target.value }))} placeholder="e.g. HACCP, Cold Chain (comma-separated)" />
                </div>
                <div>
                  <label style={label}>Proposal</label>
                  <textarea style={{ ...input, height: '80px', resize: 'vertical' }} value={bidForm.proposal_text} onChange={e => setBidForm(p => ({ ...p, proposal_text: e.target.value }))} placeholder="Describe why your service is the best fit..." />
                </div>
              </div>
              <button onClick={submitBid} disabled={submitting || !bidForm.bid_amount} style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", marginTop: '20px', opacity: (submitting || !bidForm.bid_amount) ? 0.5 : 1 }}>{submitting ? 'Submitting...' : 'Submit Bid'}</button>
            </div>
          </div>
        )}

        {/* Detail View */}
        {detailReq ? (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <span onClick={() => setDetailReq(null)} style={{ color: '#64748b', fontSize: '13px', cursor: 'pointer' }}>← Back to Corp Premium</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '10px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', margin: 0 }}>{detailReq.title}</h1>
                {detailReq.estimated_budget > 0 && (
                  <div style={{ fontSize: '22px', fontWeight: '800', color: '#f59e0b' }}>${parseFloat(detailReq.estimated_budget).toLocaleString()}</div>
                )}
              </div>
            </div>

            {/* Company & Date Info */}
            <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div style={card}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#f59e0b', marginBottom: '10px' }}>COMPANY</h3>
                <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '600' }}>{detailReq.client?.company_name || 'Corporate Client'}</div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{detailReq.client?.contact_name || ''}</div>
              </div>
              <div style={card}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#8b5cf6', marginBottom: '10px' }}>SCHEDULE</h3>
                <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '600' }}>
                  {detailReq.start_date ? new Date(detailReq.start_date).toLocaleDateString() : 'TBD'} - {detailReq.end_date ? new Date(detailReq.end_date).toLocaleDateString() : 'TBD'}
                </div>
              </div>
            </div>

            {/* Full Details */}
            <div style={{ ...card, marginBottom: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>Details</h3>
              {detailReq.description && <p style={{ fontSize: '14px', color: '#374151', lineHeight: '1.6', marginBottom: '16px' }}>{detailReq.description}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr 1fr' : '1fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>Vehicle Modes</div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{getVehicleLabels(detailReq.vehicle_modes)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>Min Fleet Size</div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{detailReq.min_fleet_size || 1} vehicles</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>Min Rating</div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{detailReq.min_rating || 4.5} stars</div>
                </div>
              </div>

              {detailReq.locations && detailReq.locations.length > 0 && (
                <div style={{ marginTop: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>Locations</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {detailReq.locations.map((loc, i) => (
                      <span key={i} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', background: '#eff6ff', color: '#3b82f6' }}>{loc}</span>
                    ))}
                  </div>
                </div>
              )}

              {detailReq.certifications_required && detailReq.certifications_required.length > 0 && (
                <div style={{ marginTop: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>Certifications Required</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {detailReq.certifications_required.map((cert, i) => (
                      <span key={i} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', background: '#fef3c7', color: '#92400e' }}>{cert}</span>
                    ))}
                  </div>
                </div>
              )}

              {detailReq.special_requirements && (
                <div style={{ marginTop: '14px', padding: '12px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px', color: '#374151' }}>
                  <strong>Special Requirements:</strong> {detailReq.special_requirements}
                </div>
              )}
            </div>

            {/* Action */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {myBids[detailReq.id] ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ padding: '10px 18px', borderRadius: '8px', background: myBids[detailReq.id].status === 'accepted' ? '#f0fdf4' : myBids[detailReq.id].status === 'rejected' ? '#fef2f2' : myBids[detailReq.id].status === 'shortlisted' ? '#fffbeb' : '#f0f9ff', color: myBids[detailReq.id].status === 'accepted' ? '#10b981' : myBids[detailReq.id].status === 'rejected' ? '#ef4444' : myBids[detailReq.id].status === 'shortlisted' ? '#d97706' : '#3b82f6', fontSize: '14px', fontWeight: '600' }}>
                    Bid: ${parseFloat(myBids[detailReq.id].bid_amount).toLocaleString()} ({myBids[detailReq.id].status})
                  </span>
                </div>
              ) : (
                <button onClick={() => setBidModal(detailReq)} style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Submit Bid</button>
              )}
            </div>
          </div>
        ) : (
          /* List View */
          <>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>Corp Premium ({requests.length})</h1>

            {fetching ? (
              <Spinner />
            ) : requests.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>⭐</div>
                <p style={{ color: '#64748b', fontSize: '14px' }}>No Corp Premium requests open for bidding. Check back soon!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {requests.map(req => {
                  const hasBid = myBids[req.id];
                  return (
                    <div key={req.id} onClick={() => setDetailReq(req)} style={{ ...card, cursor: 'pointer', transition: 'box-shadow 0.15s', borderLeft: '4px solid #f59e0b' }}>
                      {/* Row 1: Title + budget */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{req.title}</span>
                          {hasBid && (
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', background: hasBid.status === 'accepted' ? '#dcfce7' : hasBid.status === 'shortlisted' ? '#fef9c3' : '#dbeafe', color: hasBid.status === 'accepted' ? '#16a34a' : hasBid.status === 'shortlisted' ? '#ca8a04' : '#2563eb', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                              {hasBid.status === 'pending' ? 'BID SENT' : hasBid.status}
                            </span>
                          )}
                        </div>
                        {req.estimated_budget > 0 && (
                          <div style={{ fontSize: '17px', fontWeight: '800', color: '#f59e0b', flexShrink: 0 }}>${parseFloat(req.estimated_budget).toLocaleString()}</div>
                        )}
                      </div>

                      {/* Row 2: Company */}
                      <div style={{ fontSize: '14px', color: '#374151', marginBottom: '8px', fontWeight: '500' }}>
                        {req.client?.company_name || 'Corporate Client'}
                      </div>

                      {/* Row 3: Key details */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                        {req.start_date && (
                          <span style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: '600' }}>
                            {new Date(req.start_date).toLocaleDateString()} - {req.end_date ? new Date(req.end_date).toLocaleDateString() : 'TBD'}
                          </span>
                        )}
                        <span style={{ fontSize: '12px', color: '#64748b' }}>{getVehicleLabels(req.vehicle_modes)}</span>
                        {req.min_fleet_size > 1 && <span style={{ fontSize: '12px', color: '#64748b' }}>{req.min_fleet_size}+ vehicles</span>}
                      </div>

                      {/* Row 4: Certifications */}
                      {req.certifications_required && req.certifications_required.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {req.certifications_required.map((cert, i) => (
                            <span key={i} style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', background: '#fef3c7', color: '#92400e' }}>{cert}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
