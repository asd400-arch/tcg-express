'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import { supabase } from '../../../lib/supabase';
import useMobile from '../../components/useMobile';
import { getCategoryByKey, getEquipmentLabel } from '../../../lib/constants';
import { VEHICLE_MODES, ADDON_OPTIONS, legacyVehicleLabel } from '../../../lib/fares';

function getAreaFromAddress(addr) {
  if (!addr) return '—';
  // Try to extract a meaningful area: use the portion before the last comma (often "Street, Area, Country")
  const parts = addr.split(',').map(p => p.trim());
  if (parts.length >= 3) return parts[parts.length - 2];
  if (parts.length === 2) return parts[0];
  // Fallback: first 30 chars
  return addr.length > 35 ? addr.slice(0, 32) + '...' : addr;
}

function getVehicleLabel(key) {
  if (!key || key === 'any') return 'Any';
  const mode = VEHICLE_MODES.find(v => v.key === key);
  if (mode) return `${mode.icon} ${mode.label}`;
  return legacyVehicleLabel(key);
}

export default function DriverJobs() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [detailJob, setDetailJob] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidTime, setBidTime] = useState('');
  const [bidMsg, setBidMsg] = useState('');
  const [bidding, setBidding] = useState(false);
  const [accepting, setAccepting] = useState(null);
  const [myBids, setMyBids] = useState({});

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'driver') router.push('/');
    if (user && user.role === 'driver') loadData();
  }, [user, loading]);

  const loadData = async () => {
    const [jobsRes, bidsRes] = await Promise.all([
      supabase.from('express_jobs').select('*, client:client_id(contact_name, company_name)').in('status', ['open', 'bidding']).order('created_at', { ascending: false }),
      supabase.from('express_bids').select('*').eq('driver_id', user.id),
    ]);
    setJobs(jobsRes.data || []);
    const bm = {};
    (bidsRes.data || []).forEach(b => { bm[b.job_id] = b; });
    setMyBids(bm);
  };

  const submitBid = async () => {
    if (!bidAmount || !selectedJob) return;
    if (parseFloat(bidAmount) <= 0) { toast.error('Bid amount must be greater than 0'); return; }
    setBidding(true);
    try {
      const res = await fetch('/api/bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: selectedJob.id,
          amount: parseFloat(bidAmount),
          message: bidMsg || null,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Failed to submit bid');
        setBidding(false);
        if (res.status === 409) { setSelectedJob(null); loadData(); }
        return;
      }
      toast.success('Bid submitted!');
      setBidding(false); setSelectedJob(null); setBidAmount(''); setBidTime(''); setBidMsg('');
      loadData();
    } catch (e) {
      toast.error('Failed to submit bid');
      setBidding(false);
    }
  };

  const instantAccept = async (job) => {
    const maxBudget = parseFloat(job.budget_max) || parseFloat(job.budget_min);
    if (!maxBudget) { toast.error('Job has no valid budget'); return; }
    if (!confirm(`Accept this job at $${maxBudget.toFixed(2)}? The client will be charged immediately from their wallet.`)) return;
    setAccepting(job.id);
    try {
      const res = await fetch(`/api/jobs/${job.id}/instant-accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Failed to accept job');
        setAccepting(null);
        return;
      }
      toast.success(`Job accepted! You'll earn $${result.payout}`);
      setAccepting(null);
      loadData();
    } catch (e) {
      toast.error('Failed to accept job');
      setAccepting(null);
    }
  };

  if (loading || !user) return <Spinner />;

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' };
  const input = { width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' };
  const urgencyColor = { standard: '#64748b', express: '#f59e0b', urgent: '#ef4444' };
  const jobTypeColor = { spot: '#3b82f6', scheduled: '#8b5cf6', regular: '#059669' };
  const badge = (text, bg, fg) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', background: bg, color: fg, textTransform: 'uppercase', letterSpacing: '0.3px' });

  // Parse addons from special_requirements JSON
  const parseAddons = (job) => {
    const addons = [];
    if (job.special_requirements) {
      try {
        const parsed = JSON.parse(job.special_requirements);
        if (parsed.addons) {
          for (const [key, qty] of Object.entries(parsed.addons)) {
            if (qty > 0) {
              const opt = ADDON_OPTIONS.find(a => a.key === key);
              if (opt && key !== 'extra_manpower') addons.push(opt.label);
            }
          }
        }
      } catch {}
    }
    return addons;
  };

  // Parse notes from special_requirements JSON
  const parseNotes = (job) => {
    if (!job.special_requirements) return null;
    try {
      const parsed = JSON.parse(job.special_requirements);
      return parsed.notes || null;
    } catch {
      return job.special_requirements;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Available Jobs" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden' }}>

        {/* Bid Modal */}
        {selectedJob && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: 'white', borderRadius: '20px', padding: '30px', maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Place Bid</h3>
                <div onClick={() => setSelectedJob(null)} style={{ cursor: 'pointer', fontSize: '20px', color: '#94a3b8' }}>✕</div>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>{selectedJob.job_number || selectedJob.item_description}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>{getAreaFromAddress(selectedJob.pickup_address)} → {getAreaFromAddress(selectedJob.delivery_address)}</div>
                <div style={{ fontSize: '13px', color: '#10b981', fontWeight: '700', marginTop: '6px' }}>Budget: ${selectedJob.budget_min} - ${selectedJob.budget_max}</div>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Your Bid Amount ($) *</label>
                <input type="number" style={input} value={bidAmount} onChange={e => setBidAmount(e.target.value)} placeholder="Enter amount" required />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Estimated Time</label>
                <input style={input} value={bidTime} onChange={e => setBidTime(e.target.value)} placeholder="e.g. 30 mins, 1 hour" />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Message</label>
                <textarea style={{ ...input, height: '60px', resize: 'vertical' }} value={bidMsg} onChange={e => setBidMsg(e.target.value)} placeholder="Why should they choose you?" />
              </div>
              <button onClick={submitBid} disabled={bidding} style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", opacity: bidding ? 0.7 : 1 }}>{bidding ? 'Submitting...' : 'Submit Bid'}</button>
            </div>
          </div>
        )}

        {/* Detail View */}
        {detailJob ? (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <span onClick={() => setDetailJob(null)} style={{ color: '#64748b', fontSize: '13px', cursor: 'pointer' }}>← Back to Available Jobs</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', margin: 0 }}>{detailJob.job_number || 'Job Details'}</h1>
                  <span style={badge(detailJob.job_type || 'spot', `${jobTypeColor[detailJob.job_type] || jobTypeColor.spot}15`, jobTypeColor[detailJob.job_type] || jobTypeColor.spot)}>{detailJob.job_type || 'spot'}</span>
                  <span style={badge(detailJob.urgency || 'standard', `${urgencyColor[detailJob.urgency]}15`, urgencyColor[detailJob.urgency])}>{detailJob.urgency || 'standard'}</span>
                </div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#10b981' }}>${detailJob.budget_min} - ${detailJob.budget_max}</div>
              </div>
            </div>

            {/* Scheduled date banner */}
            {detailJob.pickup_by && (
              <div style={{ ...card, background: '#f5f3ff', border: '1px solid #ddd6fe', padding: '14px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>📅</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#6d28d9' }}>Scheduled Pickup</div>
                  <div style={{ fontSize: '14px', color: '#374151' }}>{new Date(detailJob.pickup_by).toLocaleString()}</div>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              {/* Pickup */}
              <div style={card}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#3b82f6', marginBottom: '10px' }}>PICKUP</h3>
                <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '600', marginBottom: '6px' }}>{detailJob.pickup_address}</div>
                {detailJob.pickup_contact && <div style={{ fontSize: '13px', color: '#64748b' }}>{detailJob.pickup_contact} {detailJob.pickup_phone ? `| ${detailJob.pickup_phone}` : ''}</div>}
                {detailJob.pickup_instructions && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>{detailJob.pickup_instructions}</div>}
              </div>
              {/* Delivery */}
              <div style={card}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#10b981', marginBottom: '10px' }}>DELIVERY</h3>
                <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '600', marginBottom: '6px' }}>{detailJob.delivery_address}</div>
                {detailJob.delivery_contact && <div style={{ fontSize: '13px', color: '#64748b' }}>{detailJob.delivery_contact} {detailJob.delivery_phone ? `| ${detailJob.delivery_phone}` : ''}</div>}
                {detailJob.delivery_instructions && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>{detailJob.delivery_instructions}</div>}
              </div>
            </div>

            {/* Item & Package Details */}
            <div style={{ ...card, marginBottom: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>Package Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>Item</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{detailJob.item_description || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>Category</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{getCategoryByKey(detailJob.item_category).icon} {getCategoryByKey(detailJob.item_category).label}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>Weight</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{detailJob.item_weight ? `${detailJob.item_weight} kg` : '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>Vehicle</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{getVehicleLabel(detailJob.vehicle_required)}</div>
                </div>
                {detailJob.item_dimensions && (
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>Dimensions</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{detailJob.item_dimensions}</div>
                  </div>
                )}
                {detailJob.manpower_count > 1 && (
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>Workers</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{detailJob.manpower_count} persons</div>
                  </div>
                )}
                {detailJob.distance_km && (
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>Distance</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{detailJob.distance_km} km</div>
                  </div>
                )}
                {detailJob.client?.company_name && (
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>Customer</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{detailJob.client.company_name}</div>
                  </div>
                )}
              </div>

              {/* Addons & Equipment badges */}
              {(() => {
                const addons = parseAddons(detailJob);
                const equip = detailJob.equipment_needed || [];
                if (addons.length === 0 && equip.length === 0) return null;
                return (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '14px' }}>
                    {equip.map(eq => (
                      <span key={eq} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: '#eef2ff', color: '#4f46e5' }}>{getEquipmentLabel(eq)}</span>
                    ))}
                    {addons.map(a => (
                      <span key={a} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: '#fef3c7', color: '#92400e' }}>{a}</span>
                    ))}
                  </div>
                );
              })()}

              {/* Notes / Special instructions */}
              {parseNotes(detailJob) && (
                <div style={{ marginTop: '14px', padding: '12px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px', color: '#374151' }}>
                  <strong>Notes:</strong> {parseNotes(detailJob)}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {myBids[detailJob.id] ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ padding: '10px 18px', borderRadius: '8px', background: myBids[detailJob.id].status === 'accepted' ? '#f0fdf4' : myBids[detailJob.id].status === 'rejected' ? '#fef2f2' : '#f0fdf4', color: myBids[detailJob.id].status === 'accepted' ? '#10b981' : myBids[detailJob.id].status === 'rejected' ? '#ef4444' : '#10b981', fontSize: '14px', fontWeight: '600' }}>
                    Bid: ${myBids[detailJob.id].amount} ({myBids[detailJob.id].status === 'outbid' ? 'another driver accepted' : myBids[detailJob.id].status})
                  </span>
                  {['rejected', 'outbid'].includes(myBids[detailJob.id].status) && (
                    <button onClick={() => setSelectedJob(detailJob)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #f59e0b', background: 'white', color: '#f59e0b', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Re-bid</button>
                  )}
                </div>
              ) : (
                <>
                  <button onClick={() => instantAccept(detailJob)} disabled={accepting === detailJob.id} style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", opacity: accepting === detailJob.id ? 0.7 : 1 }}>{accepting === detailJob.id ? 'Accepting...' : `Accept $${detailJob.budget_max || detailJob.budget_min}`}</button>
                  <button onClick={() => setSelectedJob(detailJob)} style={{ padding: '12px 24px', borderRadius: '10px', border: '1px solid #3b82f6', background: 'white', color: '#3b82f6', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Bid Custom</button>
                </>
              )}
            </div>
          </div>
        ) : (
          /* List View */
          <>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>Available Jobs ({jobs.length})</h1>

            {jobs.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
                <p style={{ color: '#64748b', fontSize: '14px' }}>No available jobs right now. Check back soon!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {jobs.map(job => {
                  const hasBid = myBids[job.id];
                  const jType = job.job_type || 'spot';
                  return (
                    <div key={job.id} onClick={() => setDetailJob(job)} style={{ ...card, cursor: 'pointer', transition: 'box-shadow 0.15s', borderLeft: `4px solid ${jobTypeColor[jType] || '#3b82f6'}` }}>
                      {/* Row 1: Job number + badges + budget */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{job.job_number || '—'}</span>
                          <span style={badge(jType, `${jobTypeColor[jType] || jobTypeColor.spot}15`, jobTypeColor[jType] || jobTypeColor.spot)}>{jType}</span>
                          <span style={badge(job.urgency || 'standard', `${urgencyColor[job.urgency]}15`, urgencyColor[job.urgency])}>{job.urgency || 'standard'}</span>
                        </div>
                        <div style={{ fontSize: '17px', fontWeight: '800', color: '#10b981', flexShrink: 0 }}>${job.budget_min} - ${job.budget_max}</div>
                      </div>

                      {/* Row 2: Route (area only) */}
                      <div style={{ fontSize: '14px', color: '#374151', marginBottom: '8px', fontWeight: '500' }}>
                        {getAreaFromAddress(job.pickup_address)} → {getAreaFromAddress(job.delivery_address)}
                      </div>

                      {/* Row 3: Key details */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>{getVehicleLabel(job.vehicle_required)}</span>
                        {job.item_weight && <span style={{ fontSize: '12px', color: '#64748b' }}>{job.item_weight} kg</span>}
                        {job.pickup_by && (
                          <span style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: '600' }}>📅 {new Date(job.pickup_by).toLocaleDateString()} {new Date(job.pickup_by).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </div>

                      {/* Row 4: Bid status or action buttons */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{new Date(job.created_at).toLocaleString()}</span>
                        {hasBid ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ padding: '6px 14px', borderRadius: '8px', background: hasBid.status === 'accepted' ? '#f0fdf4' : hasBid.status === 'outbid' ? '#fffbeb' : hasBid.status === 'rejected' ? '#fef2f2' : '#f0fdf4', color: hasBid.status === 'accepted' ? '#10b981' : hasBid.status === 'outbid' ? '#d97706' : hasBid.status === 'rejected' ? '#ef4444' : '#10b981', fontSize: '12px', fontWeight: '600' }}>
                              Bid: ${hasBid.amount} ({hasBid.status === 'outbid' ? 'not selected' : hasBid.status})
                            </span>
                            {['rejected', 'outbid'].includes(hasBid.status) && (
                              <button onClick={() => setSelectedJob(job)} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #f59e0b', background: 'white', color: '#f59e0b', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Re-bid</button>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => instantAccept(job)} disabled={accepting === job.id} style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", opacity: accepting === job.id ? 0.7 : 1 }}>{accepting === job.id ? '...' : `Accept $${job.budget_max || job.budget_min}`}</button>
                            <button onClick={() => setSelectedJob(job)} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #3b82f6', background: 'white', color: '#3b82f6', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Bid</button>
                          </div>
                        )}
                      </div>
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
