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
import { ADDON_OPTIONS, checkVehicleFit } from '../../../lib/fares';
import { getAreaName, formatPickupTime, formatBudgetRange, getCountdown, getVehicleLabel, getJobBudget, sortByPickupUrgency } from '../../../lib/job-helpers';
import JobCard from '../../components/JobCard';
import useLocale from '../../components/useLocale';

// Parse addons from special_requirements JSON
function parseAddons(job) {
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
}

// Parse notes from special_requirements JSON
function parseNotes(job) {
  if (!job.special_requirements) return null;
  try {
    const parsed = JSON.parse(job.special_requirements);
    return parsed.notes || null;
  } catch {
    return job.special_requirements;
  }
}

// Parse special equipment comment (Other Request detail)
function parseEquipComment(job) {
  if (!job.special_requirements) return null;
  try {
    const parsed = JSON.parse(job.special_requirements);
    return parsed.special_equipment_comment || null;
  } catch { return null; }
}

export default function DriverJobs() {
  const { user, loading } = useAuth();
  const { locale } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [detailJob, setDetailJob] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidMsg, setBidMsg] = useState('');
  const [bidding, setBidding] = useState(false);
  const [bidErrors, setBidErrors] = useState({});
  const [accepting, setAccepting] = useState(null);
  const [myBids, setMyBids] = useState({});
  const [equipmentCharges, setEquipmentCharges] = useState([]);
  const [customEquipName, setCustomEquipName] = useState('');
  const [customEquipAmount, setCustomEquipAmount] = useState('');
  const [activeTab, setActiveTab] = useState('spot');
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'driver') router.push('/');
    if (user && user.role === 'driver') loadData();
  }, [user, loading]);

  const loadData = async () => {
    setDataLoading(true);
    try {
      const [jobsRes, bidsRes] = await Promise.all([
        supabase.from('express_jobs').select('*').in('status', ['open', 'bidding']).order('pickup_by', { ascending: true, nullsLast: true }),
        supabase.from('express_bids').select('*').eq('driver_id', user.id),
      ]);

      if (jobsRes.error) {
        console.error('[driver/jobs] Jobs query FAILED:', jobsRes.error);
        setDataLoading(false);
        return;
      }

      const rawJobs = jobsRes.data || [];
      const allJobs = rawJobs.filter(j => {
        if (j.is_corp_premium) return false;
        if (j.vehicle_required && j.vehicle_required !== 'any' && user.vehicle_type) {
          const fit = checkVehicleFit(user.vehicle_type, j.vehicle_required);
          if (!fit.ok) return false;
        }
        return true;
      });

      setJobs(allJobs);
      const bm = {};
      (bidsRes.data || []).forEach(b => { bm[b.job_id] = b; });
      setMyBids(bm);
    } catch (err) {
      console.error('[driver/jobs] loadData CRASHED:', err);
    }
    setDataLoading(false);
  };

  const submitBid = async () => {
    const errs = {};
    if (!bidAmount) errs.bidAmount = 'Bid amount is required';
    else if (parseFloat(bidAmount) <= 0) errs.bidAmount = 'Must be greater than 0';
    if (Object.keys(errs).length > 0) { setBidErrors(errs); return; }
    if (!selectedJob) return;
    setBidding(true);
    try {
      const res = await fetch('/api/bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: selectedJob.id,
          amount: parseFloat(bidAmount),
          message: bidMsg || null,
          equipment_charges: equipmentCharges.length > 0 ? equipmentCharges : null,
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
      setBidding(false); setSelectedJob(null); setBidAmount(''); setBidMsg(''); setBidErrors({}); setEquipmentCharges([]); setCustomEquipName(''); setCustomEquipAmount('');
      loadData();
    } catch (e) {
      toast.error('Failed to submit bid');
      setBidding(false);
    }
  };

  const instantAccept = async (job) => {
    const maxBudget = getJobBudget(job);
    if (!maxBudget) { toast.error('Job has no valid budget'); return; }
    if (!confirm(`Accept this job at $${maxBudget.toFixed(2)}? The client will be charged immediately from their wallet.`)) return;
    setAccepting(job.id);
    try {
      const res = await fetch(`/api/jobs/${job.id}/instant-accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
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
  const jobTypeColor = { spot: '#3b82f6', regular: '#8b5cf6', scheduled: '#8b5cf6', recurring: '#059669' };
  const badgeStyle = (text, bg, fg) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', background: bg, color: fg, textTransform: 'uppercase', letterSpacing: '0.3px' });

  // Categorize jobs into tabs by job_type, sorted by pickup urgency
  const spotJobs = jobs.filter(j => !j.job_type || j.job_type === 'spot').sort(sortByPickupUrgency);
  const scheduledJobs = jobs.filter(j => j.job_type === 'regular' || j.job_type === 'scheduled').sort(sortByPickupUrgency);
  const regularJobs = jobs.filter(j => j.job_type === 'recurring').sort(sortByPickupUrgency);

  const filteredJobs = activeTab === 'spot' ? spotJobs : activeTab === 'scheduled' ? scheduledJobs : regularJobs;
  const tabCounts = { spot: spotJobs.length, scheduled: scheduledJobs.length, regular: regularJobs.length };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Available Jobs" />
      <div style={{ flex: 1, padding: m ? '80px 16px 20px' : '30px', overflowX: 'hidden' }}>

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
                <div style={{ fontSize: '12px', color: '#64748b' }}>{getAreaName(selectedJob.pickup_address)} → {getAreaName(selectedJob.delivery_address)}</div>
                <div style={{ fontSize: '13px', color: '#10b981', fontWeight: '700', marginTop: '6px' }}>Budget: {formatBudgetRange(selectedJob, locale)}</div>
                {selectedJob.equipment_needed && selectedJob.equipment_needed.length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Requested:</span>
                    {selectedJob.equipment_needed.map(eq => (
                      <span key={eq} style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: '#eef2ff', color: '#4f46e5' }}>{getEquipmentLabel(eq)}</span>
                    ))}
                  </div>
                )}
                {parseEquipComment(selectedJob) && (
                  <div style={{ marginTop: '6px', padding: '8px 10px', borderRadius: '6px', background: '#fef3c7', border: '1px solid #fde68a', fontSize: '12px', color: '#92400e' }}>
                    ⚠️ <strong>Other Request:</strong> {parseEquipComment(selectedJob)}
                  </div>
                )}
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Your Bid Amount ($)<span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span></label>
                <input type="number" style={{ ...input, border: bidErrors.bidAmount ? '1.5px solid #ef4444' : '1px solid #e2e8f0' }} value={bidAmount} onChange={e => { setBidAmount(e.target.value); setBidErrors(prev => { const n = { ...prev }; delete n.bidAmount; return n; }); }} placeholder="Enter amount" />
                {bidErrors.bidAmount && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>{bidErrors.bidAmount}</div>}
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Message</label>
                <textarea style={{ ...input, height: '60px', resize: 'vertical' }} value={bidMsg} onChange={e => setBidMsg(e.target.value)} placeholder="Why should they choose you?" />
              </div>

              {/* Special Equipment Charges */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '8px' }}>Special Equipment (optional)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                  {[
                    { name: 'Pallet Jack', amount: 50 },
                    { name: 'Lift Truck', amount: 80 },
                    { name: 'Crane', amount: 150 },
                  ].map(eq => {
                    const isSelected = equipmentCharges.some(e => e.name === eq.name);
                    return (
                      <label key={eq.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px', background: isSelected ? '#f0fdf4' : '#f8fafc', border: `1px solid ${isSelected ? '#86efac' : '#e2e8f0'}` }}>
                        <input type="checkbox" checked={isSelected} onChange={() => {
                          setEquipmentCharges(prev =>
                            isSelected ? prev.filter(e => e.name !== eq.name) : [...prev, { name: eq.name, amount: eq.amount }]
                          );
                        }} style={{ accentColor: '#10b981' }} />
                        <span style={{ fontSize: '13px', color: '#1e293b', flex: 1 }}>{eq.name}</span>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#059669' }}>${eq.amount}</span>
                      </label>
                    );
                  })}
                  <div style={{ padding: '8px 12px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>Other equipment</div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input type="text" placeholder="Name" value={customEquipName} onChange={e => setCustomEquipName(e.target.value)} style={{ ...input, flex: 2, padding: '8px 10px', fontSize: '13px' }} />
                      <input type="number" placeholder="$" value={customEquipAmount} onChange={e => setCustomEquipAmount(e.target.value)} style={{ ...input, flex: 1, padding: '8px 10px', fontSize: '13px' }} />
                      <button type="button" onClick={() => {
                        if (customEquipName.trim() && parseFloat(customEquipAmount) > 0) {
                          setEquipmentCharges(prev => [...prev, { name: customEquipName.trim(), amount: parseFloat(customEquipAmount) }]);
                          setCustomEquipName(''); setCustomEquipAmount('');
                        }
                      }} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>Add</button>
                    </div>
                  </div>
                  {equipmentCharges.filter(e => !['Pallet Jack', 'Lift Truck', 'Crane'].includes(e.name)).map((eq, i) => (
                    <div key={`custom-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #86efac' }}>
                      <span style={{ fontSize: '13px', color: '#1e293b', flex: 1 }}>{eq.name}</span>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#059669' }}>${eq.amount}</span>
                      <span onClick={() => setEquipmentCharges(prev => prev.filter((_, idx) => idx !== prev.indexOf(eq)))} style={{ cursor: 'pointer', color: '#ef4444', fontSize: '14px' }}>✕</span>
                    </div>
                  ))}
                </div>
                {equipmentCharges.length > 0 && bidAmount && (
                  <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#fffbeb', border: '1px solid #fde68a', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#64748b' }}>Bid</span>
                      <span style={{ color: '#1e293b', fontWeight: '600' }}>${parseFloat(bidAmount).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#64748b' }}>Equipment</span>
                      <span style={{ color: '#1e293b', fontWeight: '600' }}>${equipmentCharges.reduce((s, e) => s + e.amount, 0).toFixed(2)}</span>
                    </div>
                    <div style={{ borderTop: '1px solid #fde68a', paddingTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#92400e', fontWeight: '700' }}>Total</span>
                      <span style={{ color: '#92400e', fontWeight: '800' }}>${(parseFloat(bidAmount) + equipmentCharges.reduce((s, e) => s + e.amount, 0)).toFixed(2)}</span>
                    </div>
                  </div>
                )}
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
                  <span style={badgeStyle(detailJob.job_type || 'spot', `${jobTypeColor[detailJob.job_type] || jobTypeColor.spot}15`, jobTypeColor[detailJob.job_type] || jobTypeColor.spot)}>{detailJob.job_type || 'spot'}</span>
                  <span style={badgeStyle(detailJob.urgency || 'standard', `${urgencyColor[detailJob.urgency]}15`, urgencyColor[detailJob.urgency])}>{detailJob.urgency || 'standard'}</span>
                </div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#10b981' }}>{formatBudgetRange(detailJob, locale)}</div>
              </div>
            </div>

            {(detailJob.pickup_by || detailJob.deliver_by) && (
              <div style={{ ...card, background: '#f5f3ff', border: '1px solid #ddd6fe', padding: '14px 20px', marginBottom: '16px' }}>
                {detailJob.pickup_by && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: detailJob.deliver_by ? '8px' : 0 }}>
                    <span style={{ fontSize: '18px' }}>📦</span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#3b82f6' }}>
                        {detailJob.delivery_mode === 'save_mode' ? `SaveMode Pickup (${detailJob.save_mode_window || ''}h window)` : detailJob.job_type === 'scheduled' ? 'Scheduled Pickup' : detailJob.job_type === 'recurring' ? 'Recurring Pickup' : 'Pickup By'}
                      </div>
                      <div style={{ fontSize: '14px', color: '#374151' }}>{new Date(detailJob.pickup_by).toLocaleString()} {getCountdown(detailJob.pickup_by) ? `(${getCountdown(detailJob.pickup_by) === 'Overdue' ? 'OVERDUE' : getCountdown(detailJob.pickup_by) === 'Now' ? 'NOW' : `in ${getCountdown(detailJob.pickup_by)}`})` : ''}</div>
                    </div>
                  </div>
                )}
                {detailJob.deliver_by ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>🏠</span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#10b981' }}>Deliver By</div>
                      <div style={{ fontSize: '14px', color: '#374151' }}>{new Date(detailJob.deliver_by).toLocaleString()} {getCountdown(detailJob.deliver_by) ? `(${getCountdown(detailJob.deliver_by) === 'Overdue' ? 'OVERDUE' : getCountdown(detailJob.deliver_by) === 'Now' ? 'NOW' : `in ${getCountdown(detailJob.deliver_by)}`})` : ''}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>🏠</span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#10b981' }}>Delivery Deadline</div>
                      <div style={{ fontSize: '14px', color: '#94a3b8' }}>Flexible</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div style={card}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#3b82f6', marginBottom: '10px' }}>PICKUP</h3>
                <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '600', marginBottom: '6px' }}>{detailJob.pickup_address}</div>
                {detailJob.pickup_contact && <div style={{ fontSize: '13px', color: '#64748b' }}>{detailJob.pickup_contact} {detailJob.pickup_phone ? `| ${detailJob.pickup_phone}` : ''}</div>}
                {detailJob.pickup_instructions && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>{detailJob.pickup_instructions}</div>}
              </div>
              <div style={card}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#10b981', marginBottom: '10px' }}>DELIVERY</h3>
                <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '600', marginBottom: '6px' }}>{detailJob.delivery_address}</div>
                {detailJob.delivery_contact && <div style={{ fontSize: '13px', color: '#64748b' }}>{detailJob.delivery_contact} {detailJob.delivery_phone ? `| ${detailJob.delivery_phone}` : ''}</div>}
                {detailJob.delivery_instructions && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>{detailJob.delivery_instructions}</div>}
              </div>
            </div>

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

              {parseNotes(detailJob) && (
                <div style={{ marginTop: '14px', padding: '12px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px', color: '#374151' }}>
                  <strong>Notes:</strong> {parseNotes(detailJob)}
                </div>
              )}
              {parseEquipComment(detailJob) && (
                <div style={{ marginTop: '10px', padding: '12px', background: '#fef3c7', borderRadius: '8px', fontSize: '13px', color: '#92400e', border: '1px solid #fde68a' }}>
                  <strong>⚠️ Special Equipment Request:</strong> {parseEquipComment(detailJob)}
                </div>
              )}
            </div>

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
                  {getJobBudget(detailJob) && <button onClick={() => instantAccept(detailJob)} disabled={accepting === detailJob.id} style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", opacity: accepting === detailJob.id ? 0.7 : 1 }}>{accepting === detailJob.id ? 'Accepting...' : `Accept $${getJobBudget(detailJob).toFixed(2)}`}</button>}
                  <button onClick={() => setSelectedJob(detailJob)} style={{ padding: '12px 24px', borderRadius: '10px', border: '1px solid #3b82f6', background: 'white', color: '#3b82f6', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>{getJobBudget(detailJob) ? 'Bid Custom' : 'Place Bid'}</button>
                </>
              )}
            </div>
          </div>
        ) : (
          /* List View */
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', margin: 0 }}>Available Jobs ({jobs.length})</h1>
              <button onClick={loadData} disabled={dataLoading} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", opacity: dataLoading ? 0.5 : 1 }}>{dataLoading ? 'Loading...' : 'Refresh'}</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {[
                { key: 'spot', label: 'Immediate', icon: '🚚' },
                { key: 'scheduled', label: 'Scheduled', icon: '📅' },
                { key: 'regular', label: 'Recurring', icon: '🔁' },
              ].map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                  padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  background: activeTab === tab.key ? '#1e293b' : '#f1f5f9',
                  color: activeTab === tab.key ? 'white' : '#64748b',
                  fontSize: '13px', fontWeight: '600', fontFamily: "'Inter', sans-serif",
                  display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s',
                }}>
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  <span style={{
                    padding: '1px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: '700',
                    background: activeTab === tab.key ? 'rgba(255,255,255,0.2)' : (tabCounts[tab.key] > 0 ? '#e11d48' : '#cbd5e1'),
                    color: activeTab === tab.key ? 'white' : (tabCounts[tab.key] > 0 ? 'white' : '#94a3b8'),
                  }}>{tabCounts[tab.key]}</span>
                </button>
              ))}
            </div>

            {dataLoading ? (
              <div style={{ ...card, textAlign: 'center', padding: '40px' }}>
                <Spinner />
              </div>
            ) : filteredJobs.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>{activeTab === 'spot' ? '🚚' : activeTab === 'scheduled' ? '📅' : '🔁'}</div>
                <p style={{ color: '#64748b', fontSize: '14px' }}>No {activeTab === 'spot' ? 'immediate' : activeTab === 'scheduled' ? 'scheduled' : 'recurring'} jobs available. Check back soon!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredJobs.map(job => (
                  <JobCard
                    key={job.id}
                    job={job}
                    myBid={myBids[job.id]}
                    accepting={accepting}
                    onClick={() => setDetailJob(job)}
                    onAccept={instantAccept}
                    onBid={(j) => setSelectedJob(j)}
                    onReBid={(j) => setSelectedJob(j)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
