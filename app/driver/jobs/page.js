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
import { VEHICLE_MODES, ADDON_OPTIONS, legacyVehicleLabel, checkVehicleFit } from '../../../lib/fares';

function getAreaFromAddress(addr) {
  if (!addr) return '—';
  const parts = addr.split(',').map(p => p.trim());
  if (parts.length >= 3) return parts[parts.length - 2];
  if (parts.length === 2) return parts[0];
  return addr.length > 35 ? addr.slice(0, 32) + '...' : addr;
}

// Singapore postal code first-2-digits → area name
const SG_POSTAL_AREAS = {
  '01': 'Raffles Place', '02': 'Cecil', '03': 'Marina', '04': 'Marina',
  '05': "People's Park", '06': 'City Hall',
  '07': 'Tanjong Pagar', '08': 'Tanjong Pagar',
  '09': 'Telok Blangah', '10': 'Harbourfront',
  '11': 'Pasir Panjang', '12': 'Clementi', '13': 'Clementi',
  '14': 'Queenstown', '15': 'Tiong Bahru', '16': 'Tiong Bahru',
  '17': 'Beach Road', '18': 'Golden Mile', '19': 'Golden Mile',
  '20': 'Little India', '21': 'Little India',
  '22': 'Orchard', '23': 'River Valley',
  '24': 'Holland', '25': 'Bukit Timah', '26': 'Tanglin', '27': 'Holland',
  '28': 'Novena', '29': 'Thomson', '30': 'Novena',
  '31': 'Balestier', '32': 'Toa Payoh', '33': 'Toa Payoh',
  '34': 'Macpherson', '35': 'Braddell', '36': 'Macpherson', '37': 'Macpherson',
  '38': 'Geylang', '39': 'Geylang', '40': 'Eunos', '41': 'Eunos',
  '42': 'Katong', '43': 'Joo Chiat', '44': 'Katong', '45': 'Amber Rd',
  '46': 'Bedok', '47': 'Bedok', '48': 'East Coast',
  '49': 'Changi', '50': 'Changi',
  '51': 'Tampines', '52': 'Pasir Ris',
  '53': 'Hougang', '54': 'Hougang', '55': 'Punggol',
  '56': 'Bishan', '57': 'Ang Mo Kio',
  '58': 'Upper Bukit Timah', '59': 'Clementi Park',
  '60': 'Jurong', '61': 'Jurong', '62': 'Jurong', '63': 'Jurong West', '64': 'Jurong',
  '65': 'Bukit Panjang', '66': 'Choa Chu Kang', '67': 'Bukit Panjang', '68': 'Choa Chu Kang',
  '69': 'Lim Chu Kang', '70': 'Tengah', '71': 'Tengah',
  '72': 'Kranji', '73': 'Woodgrove',
  '75': 'Yishun', '76': 'Sembawang',
  '77': 'Upper Thomson', '78': 'Springleaf',
  '79': 'Seletar', '80': 'Seletar',
  '81': 'Changi', '82': 'Punggol',
};

function getAreaName(addr) {
  if (!addr) return '—';
  // Try Singapore 6-digit postal code
  const match = addr.match(/(?:Singapore\s*)?(\d{6})(?:\s|,|$)/i);
  if (match) {
    const area = SG_POSTAL_AREAS[match[1].substring(0, 2)];
    if (area) return area;
  }
  return getAreaFromAddress(addr);
}

function formatPickupTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = d.getDate();
  const mon = d.toLocaleDateString('en', { month: 'short' });
  const time = d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${day} ${mon}, ${time}`;
}

function getVehicleLabel(key) {
  if (!key || key === 'any') return 'Any';
  const mode = VEHICLE_MODES.find(v => v.key === key);
  if (mode) return `${mode.icon} ${mode.label}`;
  return legacyVehicleLabel(key);
}

/** Get the instant-accept price for a job (minimum budget = base rate) */
function getJobBudget(job) {
  const min = parseFloat(job.budget_min);
  const max = parseFloat(job.budget_max);
  if (min > 0) return min;
  if (max > 0) return max;
  return null;
}

function formatBudgetRange(job) {
  const max = parseFloat(job.budget_max);
  const min = parseFloat(job.budget_min);
  if (min > 0 && max > 0) return `$${min.toFixed(0)} - $${max.toFixed(0)}`;
  if (max > 0) return `$${max.toFixed(2)}`;
  if (min > 0) return `$${min.toFixed(2)}`;
  return 'Open bid';
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
  const [bidMsg, setBidMsg] = useState('');
  const [bidding, setBidding] = useState(false);
  const [bidErrors, setBidErrors] = useState({});
  const [accepting, setAccepting] = useState(null);
  const [myBids, setMyBids] = useState({});
  const [equipmentCharges, setEquipmentCharges] = useState([]);
  const [customEquipName, setCustomEquipName] = useState('');
  const [customEquipAmount, setCustomEquipAmount] = useState('');
  const [activeTab, setActiveTab] = useState('spot');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'driver') router.push('/');
    if (user && user.role === 'driver') loadData();
  }, [user, loading]);

  const loadData = async () => {
    const [jobsRes, bidsRes] = await Promise.all([
      supabase.from('express_jobs').select('*').in('status', ['open', 'bidding']).order('created_at', { ascending: false }),
      supabase.from('express_bids').select('*').eq('driver_id', user.id),
    ]);
    if (jobsRes.error) console.error('[driver/jobs] Jobs query error:', jobsRes.error.message);
    // Filter out corp_premium/RFQ jobs and jobs requiring a larger vehicle
    const allJobs = (jobsRes.data || []).filter(j => {
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

  // Categorize jobs into tabs — Spot is catch-all so no jobs fall through
  const urgencyRank = { urgent: 0, rush: 0, express: 1, standard: 2 };
  const sortByUrgencyThenTime = (a, b) => {
    const ua = urgencyRank[a.urgency] ?? 2;
    const ub = urgencyRank[b.urgency] ?? 2;
    if (ua !== ub) return ua - ub;
    const ta = a.pickup_by ? new Date(a.pickup_by).getTime() : Infinity;
    const tb = b.pickup_by ? new Date(b.pickup_by).getTime() : Infinity;
    return ta - tb;
  };

  const regularJobs = jobs.filter(j => j.job_type === 'regular').sort(sortByUrgencyThenTime);
  const regularIds = new Set(regularJobs.map(j => j.id));
  const scheduledJobs = jobs.filter(j => !regularIds.has(j.id) && j.job_type === 'scheduled' && (j.pickup_by || j.schedule_date)).sort((a, b) => {
    const ua = urgencyRank[a.urgency] ?? 2;
    const ub = urgencyRank[b.urgency] ?? 2;
    if (ua !== ub) return ua - ub;
    const ta = new Date(a.pickup_by || a.schedule_date || a.created_at).getTime();
    const tb = new Date(b.pickup_by || b.schedule_date || b.created_at).getTime();
    return ta - tb;
  });
  const scheduledIds = new Set(scheduledJobs.map(j => j.id));
  // Spot = everything not in regular or scheduled (catch-all)
  const spotJobs = jobs.filter(j => !regularIds.has(j.id) && !scheduledIds.has(j.id)).sort(sortByUrgencyThenTime);

  const filteredJobs = activeTab === 'spot' ? spotJobs : activeTab === 'scheduled' ? scheduledJobs : regularJobs;
  const tabCounts = { spot: spotJobs.length, scheduled: scheduledJobs.length, regular: regularJobs.length };

  const getCountdown = (dateStr) => {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff <= 0) return 'Now';
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hrs > 24) return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

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
                <div style={{ fontSize: '12px', color: '#64748b' }}>{getAreaFromAddress(selectedJob.pickup_address)} → {getAreaFromAddress(selectedJob.delivery_address)}</div>
                <div style={{ fontSize: '13px', color: '#10b981', fontWeight: '700', marginTop: '6px' }}>Budget: {formatBudgetRange(selectedJob)}</div>
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
                  {/* Other custom equipment */}
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
                  {/* Show custom items added */}
                  {equipmentCharges.filter(e => !['Pallet Jack', 'Lift Truck', 'Crane'].includes(e.name)).map((eq, i) => (
                    <div key={`custom-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #86efac' }}>
                      <span style={{ fontSize: '13px', color: '#1e293b', flex: 1 }}>{eq.name}</span>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#059669' }}>${eq.amount}</span>
                      <span onClick={() => setEquipmentCharges(prev => prev.filter((_, idx) => idx !== prev.indexOf(eq)))} style={{ cursor: 'pointer', color: '#ef4444', fontSize: '14px' }}>✕</span>
                    </div>
                  ))}
                </div>
                {/* Running total */}
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
                  <span style={badge(detailJob.job_type || 'spot', `${jobTypeColor[detailJob.job_type] || jobTypeColor.spot}15`, jobTypeColor[detailJob.job_type] || jobTypeColor.spot)}>{detailJob.job_type || 'spot'}</span>
                  <span style={badge(detailJob.urgency || 'standard', `${urgencyColor[detailJob.urgency]}15`, urgencyColor[detailJob.urgency])}>{detailJob.urgency || 'standard'}</span>
                </div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#10b981' }}>{formatBudgetRange(detailJob)}</div>
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
                  {getJobBudget(detailJob) && <button onClick={() => instantAccept(detailJob)} disabled={accepting === detailJob.id} style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", opacity: accepting === detailJob.id ? 0.7 : 1 }}>{accepting === detailJob.id ? 'Accepting...' : `Accept $${getJobBudget(detailJob).toFixed(2)}`}</button>}
                  <button onClick={() => setSelectedJob(detailJob)} style={{ padding: '12px 24px', borderRadius: '10px', border: '1px solid #3b82f6', background: 'white', color: '#3b82f6', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>{getJobBudget(detailJob) ? 'Bid Custom' : 'Place Bid'}</button>
                </>
              )}
            </div>
          </div>
        ) : (
          /* List View */
          <>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Available Jobs ({jobs.length})</h1>

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

            {filteredJobs.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>{activeTab === 'spot' ? '🚚' : activeTab === 'scheduled' ? '📅' : '🔁'}</div>
                <p style={{ color: '#64748b', fontSize: '14px' }}>No {activeTab === 'spot' ? 'immediate' : activeTab === 'scheduled' ? 'scheduled' : 'recurring'} jobs available. Check back soon!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredJobs.map(job => {
                  const hasBid = myBids[job.id];
                  const countdown = getCountdown(job.pickup_by);
                  const urgencyBg = job.urgency === 'urgent' ? '#fef2f2' : job.urgency === 'express' ? '#fffbeb' : '';
                  return (
                    <div key={job.id} onClick={() => setDetailJob(job)} style={{
                      ...card, cursor: 'pointer', transition: 'box-shadow 0.15s', padding: '16px 20px',
                      ...(job.urgency === 'urgent' ? { borderLeft: '4px solid #ef4444' } : job.urgency === 'express' ? { borderLeft: '4px solid #f59e0b' } : {}),
                    }}>
                      {/* Row 1: Vehicle + Weight + Amount */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{getVehicleLabel(job.vehicle_required)}</span>
                          {job.item_weight && (
                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', background: '#f1f5f9', color: '#475569' }}>{job.item_weight} kg</span>
                          )}
                          <span style={badge(job.urgency || 'standard', `${urgencyColor[job.urgency]}15`, urgencyColor[job.urgency])}>{job.urgency || 'standard'}</span>
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: '800', color: '#10b981', flexShrink: 0 }}>{formatBudgetRange(job)}</div>
                      </div>

                      {/* Row 2: Date/Time + Countdown */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>
                          {job.pickup_by
                            ? `📅 ${formatPickupTime(job.pickup_by)}`
                            : `Posted ${formatPickupTime(job.created_at)}`}
                        </span>
                        {countdown && (
                          <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', background: countdown === 'Now' ? '#fef2f2' : '#fef3c7', color: countdown === 'Now' ? '#dc2626' : '#92400e' }}>
                            {countdown === 'Now' ? 'ASAP' : `in ${countdown}`}
                          </span>
                        )}
                      </div>

                      {/* Row 3: Area → Area + Distance */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>
                          {getAreaName(job.pickup_address)} → {getAreaName(job.delivery_address)}
                        </span>
                        {job.distance_km && (
                          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', flexShrink: 0, marginLeft: '8px' }}>{parseFloat(job.distance_km).toFixed(1)} km</span>
                        )}
                      </div>

                      {/* Row 4: Job ID (small) + Actions */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                        <span style={{ fontSize: '11px', color: '#b0b8c4', fontWeight: '500' }}>{job.job_number || '—'}</span>
                        {hasBid ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ padding: '5px 12px', borderRadius: '8px', background: hasBid.status === 'accepted' ? '#f0fdf4' : hasBid.status === 'outbid' ? '#fffbeb' : hasBid.status === 'rejected' ? '#fef2f2' : '#f0fdf4', color: hasBid.status === 'accepted' ? '#10b981' : hasBid.status === 'outbid' ? '#d97706' : hasBid.status === 'rejected' ? '#ef4444' : '#10b981', fontSize: '12px', fontWeight: '600' }}>
                              ${hasBid.amount} ({hasBid.status === 'outbid' ? 'not selected' : hasBid.status})
                            </span>
                            {['rejected', 'outbid'].includes(hasBid.status) && (
                              <button onClick={() => setSelectedJob(job)} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #f59e0b', background: 'white', color: '#f59e0b', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Re-bid</button>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {getJobBudget(job) && <button onClick={() => instantAccept(job)} disabled={accepting === job.id} style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", opacity: accepting === job.id ? 0.7 : 1 }}>{accepting === job.id ? '...' : `Accept $${getJobBudget(job).toFixed(2)}`}</button>}
                            <button onClick={() => setSelectedJob(job)} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #3b82f6', background: 'white', color: '#3b82f6', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>{getJobBudget(job) ? 'Bid' : 'Place Bid'}</button>
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
