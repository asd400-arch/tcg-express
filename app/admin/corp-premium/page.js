'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { useToast } from '../../components/Toast';

const STATUS_COLORS = {
  draft: '#94a3b8', nda_pending: '#f59e0b', submitted: '#f59e0b', under_review: '#f97316',
  quote_sent: '#8b5cf6', bidding_open: '#3b82f6', bidding_closed: '#8b5cf6',
  awarded: '#10b981', accepted: '#10b981', active: '#059669', completed: '#064e3b',
  cancelled: '#ef4444', rejected: '#ef4444',
};

const BID_COLORS = { pending: '#f59e0b', shortlisted: '#3b82f6', accepted: '#10b981', rejected: '#ef4444', withdrawn: '#94a3b8' };

// Helper: safely convert pickup_regions / delivery_regions to array
// Handles: array, JSON string, comma-separated string, null/undefined
const toArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { const parsed = JSON.parse(val); if (Array.isArray(parsed)) return parsed; } catch {}
    return val.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
};

export default function AdminCorpPremiumPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [bids, setBids] = useState([]);
  const [bidsLoading, setBidsLoading] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quote, setQuote] = useState({
    monthly_rate: '', setup_fee: '', per_delivery_rate: '',
    validity_days: '30', payment_terms: 'net_30',
    notes: '', line_items: [{ description: '', amount: '' }],
  });

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'admin') router.push('/');
    if (user && user.role === 'admin') fetchRequests();
  }, [user, loading]);

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

  const resetQuoteForm = () => {
    setQuote({ monthly_rate: '', setup_fee: '', per_delivery_rate: '', validity_days: '30', payment_terms: 'net_30', notes: '', line_items: [{ description: '', amount: '' }] });
    setShowQuoteForm(false);
  };

  const addLineItem = () => setQuote(prev => ({ ...prev, line_items: [...prev.line_items, { description: '', amount: '' }] }));
  const removeLineItem = (idx) => setQuote(prev => ({ ...prev, line_items: prev.line_items.filter((_, i) => i !== idx) }));
  const updateLineItem = (idx, field, val) => setQuote(prev => ({ ...prev, line_items: prev.line_items.map((item, i) => i === idx ? { ...item, [field]: val } : item) }));

  const submitQuote = async () => {
    if (!quote.monthly_rate && !quote.per_delivery_rate && quote.line_items.every(li => !li.amount)) {
      toast.error('Please enter at least one pricing field');
      return;
    }
    setQuoteSubmitting(true);
    try {
      const quoteData = {
        monthly_rate: quote.monthly_rate ? parseFloat(quote.monthly_rate) : null,
        setup_fee: quote.setup_fee ? parseFloat(quote.setup_fee) : null,
        per_delivery_rate: quote.per_delivery_rate ? parseFloat(quote.per_delivery_rate) : null,
        validity_days: parseInt(quote.validity_days) || 30,
        payment_terms: quote.payment_terms,
        notes: quote.notes,
        line_items: quote.line_items.filter(li => li.description && li.amount).map(li => ({ description: li.description, amount: parseFloat(li.amount) })),
        quoted_at: new Date().toISOString(),
        quoted_by: user.id,
      };
      const res = await fetch(`/api/corp-premium/${selected.id}/bids`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_quote', quote: quoteData }),
      });
      if (res.ok) {
        toast.success('Quote sent to client!');
        resetQuoteForm();
        setSelected({ ...selected, status: 'quote_sent', admin_quote: quoteData });
        fetchRequests();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to send quote');
      }
    } catch { toast.error('Failed to send quote'); }
    setQuoteSubmitting(false);
  };

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '16px' };
  const badge = (status, colorMap) => ({ padding: '3px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', background: `${colorMap[status] || '#94a3b8'}15`, color: colorMap[status] || '#94a3b8', textTransform: 'uppercase' });
  const sectionLabel = { fontSize: '11px', color: '#94a3b8', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' };
  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', fontFamily: "'Inter', sans-serif", color: '#1e293b', background: 'white', outline: 'none', boxSizing: 'border-box' };

  if (loading || !user) return <Spinner />;
  if (user.role !== 'admin') return null;

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
              {(() => {
                const pickupArr = toArray(selected.pickup_regions);
                const deliveryArr = toArray(selected.delivery_regions);
                return (pickupArr.length > 0 || deliveryArr.length > 0) ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    {pickupArr.length > 0 && (
                      <div><div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', marginBottom: '4px' }}>Pickup Regions</div><div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>{pickupArr.map(r => <span key={r} style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: '#dbeafe', color: '#1d4ed8' }}>{r}</span>)}</div></div>
                    )}
                    {deliveryArr.length > 0 && (
                      <div><div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', marginBottom: '4px' }}>Delivery Regions</div><div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>{deliveryArr.map(r => <span key={r} style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: '#d1fae5', color: '#059669' }}>{r}</span>)}</div></div>
                    )}
                  </div>
                ) : null;
              })()}

              {/* Vehicles & Certifications */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {toArray(selected.vehicle_modes || selected.vehicle_types).map(v => <span key={v} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: '#f1f5f9', color: '#475569' }}>🚛 {v}</span>)}
                {toArray(selected.certifications_required).map(c => <span key={c} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: '#fef3c7', color: '#92400e' }}>📜 {c}</span>)}
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
                {['nda_pending', 'submitted'].includes(selected.status) && <button onClick={() => updateStatus(selected.id, 'under_review')} style={actionBtn('#f59e0b')}>Mark Under Review</button>}
                {['submitted', 'under_review'].includes(selected.status) && <button onClick={() => setShowQuoteForm(true)} style={actionBtn('#8b5cf6')}>📝 Send Quote</button>}
                {['nda_pending', 'submitted'].includes(selected.status) && <button onClick={() => updateStatus(selected.id, 'bidding_open')} style={actionBtn('#3b82f6')}>Open Bidding</button>}
                {selected.status === 'bidding_open' && <button onClick={() => updateStatus(selected.id, 'bidding_closed')} style={actionBtn('#8b5cf6')}>Close Bidding</button>}
                {['bidding_open', 'bidding_closed'].includes(selected.status) && <button onClick={() => updateStatus(selected.id, 'cancelled')} style={actionBtn('#ef4444')}>Cancel</button>}
                {selected.status === 'awarded' && <button onClick={() => updateStatus(selected.id, 'active')} style={actionBtn('#059669')}>Activate</button>}
                {selected.status === 'active' && <button onClick={() => updateStatus(selected.id, 'completed')} style={actionBtn('#064e3b')}>Complete</button>}
              </div>
            </div>

            {/* Existing Quote Display */}
            {selected.admin_quote && (
              <div style={{ ...card, borderLeft: '4px solid #8b5cf6', background: '#faf5ff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: 0 }}>📝 Sent Quote</h3>
                  <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', background: selected.status === 'accepted' ? '#dcfce7' : selected.status === 'rejected' ? '#fee2e2' : '#f3e8ff', color: selected.status === 'accepted' ? '#16a34a' : selected.status === 'rejected' ? '#ef4444' : '#7c3aed', textTransform: 'uppercase' }}>
                    {selected.status === 'accepted' ? '✅ Accepted' : selected.status === 'rejected' ? '❌ Rejected' : '⏳ Pending Response'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  {selected.admin_quote.monthly_rate && (
                    <div style={{ background: 'white', borderRadius: '10px', padding: '12px', border: '1px solid #e9d5ff' }}>
                      <div style={{ fontSize: '10px', color: '#7c3aed', fontWeight: '700', textTransform: 'uppercase' }}>Monthly Rate</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>${Number(selected.admin_quote.monthly_rate).toLocaleString()}</div>
                    </div>
                  )}
                  {selected.admin_quote.per_delivery_rate && (
                    <div style={{ background: 'white', borderRadius: '10px', padding: '12px', border: '1px solid #e9d5ff' }}>
                      <div style={{ fontSize: '10px', color: '#7c3aed', fontWeight: '700', textTransform: 'uppercase' }}>Per Delivery</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>${Number(selected.admin_quote.per_delivery_rate).toLocaleString()}</div>
                    </div>
                  )}
                  {selected.admin_quote.setup_fee && (
                    <div style={{ background: 'white', borderRadius: '10px', padding: '12px', border: '1px solid #e9d5ff' }}>
                      <div style={{ fontSize: '10px', color: '#7c3aed', fontWeight: '700', textTransform: 'uppercase' }}>Setup Fee</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>${Number(selected.admin_quote.setup_fee).toLocaleString()}</div>
                    </div>
                  )}
                  <div style={{ background: 'white', borderRadius: '10px', padding: '12px', border: '1px solid #e9d5ff' }}>
                    <div style={{ fontSize: '10px', color: '#7c3aed', fontWeight: '700', textTransform: 'uppercase' }}>Valid For</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>{selected.admin_quote.validity_days} days</div>
                  </div>
                </div>
                {selected.admin_quote.line_items?.length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase' }}>Line Items</div>
                    {selected.admin_quote.line_items.map((li, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'white', borderRadius: '6px', marginBottom: '4px', border: '1px solid #e9d5ff', fontSize: '13px' }}>
                        <span style={{ color: '#374151' }}>{li.description}</span>
                        <span style={{ fontWeight: '700', color: '#1e293b' }}>${Number(li.amount).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                {selected.admin_quote.notes && <div style={{ fontSize: '13px', color: '#6b21a8', background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #e9d5ff', lineHeight: '1.5' }}>{selected.admin_quote.notes}</div>}
                {selected.admin_quote.quoted_at && <div style={{ fontSize: '11px', color: '#a78bfa', marginTop: '8px' }}>Sent: {new Date(selected.admin_quote.quoted_at).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>}
                {['quote_sent', 'under_review'].includes(selected.status) && (
                  <button onClick={() => { setQuote({ monthly_rate: selected.admin_quote.monthly_rate || '', setup_fee: selected.admin_quote.setup_fee || '', per_delivery_rate: selected.admin_quote.per_delivery_rate || '', validity_days: selected.admin_quote.validity_days || '30', payment_terms: selected.admin_quote.payment_terms || 'net_30', notes: selected.admin_quote.notes || '', line_items: selected.admin_quote.line_items?.length > 0 ? selected.admin_quote.line_items.map(li => ({ description: li.description, amount: String(li.amount) })) : [{ description: '', amount: '' }] }); setShowQuoteForm(true); }} style={{ marginTop: '10px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #8b5cf6', background: 'white', color: '#8b5cf6', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                    ✏️ Revise Quote
                  </button>
                )}
              </div>
            )}

            {/* Quote Form Modal */}
            {showQuoteForm && (
              <div style={{ ...card, borderLeft: '4px solid #8b5cf6', border: '2px solid #c4b5fd' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: 0 }}>📝 Create Quote for {selected.title}</h3>
                  <button onClick={resetQuoteForm} style={{ width: '30px', height: '30px', borderRadius: '8px', border: 'none', background: '#f1f5f9', cursor: 'pointer', fontSize: '14px', color: '#64748b' }}>✕</button>
                </div>

                {/* Pricing */}
                <div style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase' }}>💰 Pricing</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Monthly Rate ($)</label>
                    <input type="number" value={quote.monthly_rate} onChange={e => setQuote(p => ({ ...p, monthly_rate: e.target.value }))} placeholder="0.00" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Per Delivery ($)</label>
                    <input type="number" value={quote.per_delivery_rate} onChange={e => setQuote(p => ({ ...p, per_delivery_rate: e.target.value }))} placeholder="0.00" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Setup Fee ($)</label>
                    <input type="number" value={quote.setup_fee} onChange={e => setQuote(p => ({ ...p, setup_fee: e.target.value }))} placeholder="0.00" style={inputStyle} />
                  </div>
                </div>

                {/* Line Items */}
                <div style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase' }}>📋 Line Items (Optional)</div>
                {quote.line_items.map((li, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input value={li.description} onChange={e => updateLineItem(idx, 'description', e.target.value)} placeholder="Description" style={{ ...inputStyle, flex: 2 }} />
                    <input type="number" value={li.amount} onChange={e => updateLineItem(idx, 'amount', e.target.value)} placeholder="Amount" style={{ ...inputStyle, flex: 1 }} />
                    {quote.line_items.length > 1 && (
                      <button onClick={() => removeLineItem(idx)} style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1px solid #fca5a5', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}>✕</button>
                    )}
                  </div>
                ))}
                <button onClick={addLineItem} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px dashed #c4b5fd', background: '#faf5ff', color: '#7c3aed', fontSize: '12px', fontWeight: '600', cursor: 'pointer', marginBottom: '16px', fontFamily: "'Inter', sans-serif" }}>+ Add Line Item</button>

                {/* Terms */}
                <div style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase' }}>📅 Terms</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Quote Validity (Days)</label>
                    <select value={quote.validity_days} onChange={e => setQuote(p => ({ ...p, validity_days: e.target.value }))} style={inputStyle}>
                      <option value="7">7 Days</option><option value="14">14 Days</option><option value="30">30 Days</option><option value="60">60 Days</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Payment Terms</label>
                    <select value={quote.payment_terms} onChange={e => setQuote(p => ({ ...p, payment_terms: e.target.value }))} style={inputStyle}>
                      <option value="advance">Advance Payment</option><option value="net_7">Net 7</option><option value="net_14">Net 14</option><option value="net_30">Net 30</option><option value="net_60">Net 60</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Notes / Terms & Conditions</label>
                  <textarea value={quote.notes} onChange={e => setQuote(p => ({ ...p, notes: e.target.value }))} placeholder="Additional terms, conditions, or notes for the client..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>

                {/* Quote Summary */}
                {(quote.monthly_rate || quote.per_delivery_rate || quote.setup_fee || quote.line_items.some(li => li.amount)) && (
                  <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '12px', marginTop: '12px', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase' }}>Quote Summary</div>
                    {quote.monthly_rate && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '3px' }}><span style={{ color: '#374151' }}>Monthly Rate</span><span style={{ fontWeight: '700' }}>${Number(quote.monthly_rate).toLocaleString()}/mo</span></div>}
                    {quote.per_delivery_rate && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '3px' }}><span style={{ color: '#374151' }}>Per Delivery</span><span style={{ fontWeight: '700' }}>${Number(quote.per_delivery_rate).toLocaleString()}</span></div>}
                    {quote.setup_fee && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '3px' }}><span style={{ color: '#374151' }}>Setup Fee (one-time)</span><span style={{ fontWeight: '700' }}>${Number(quote.setup_fee).toLocaleString()}</span></div>}
                    {quote.line_items.filter(li => li.description && li.amount).map((li, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '3px' }}><span style={{ color: '#374151' }}>{li.description}</span><span style={{ fontWeight: '700' }}>${Number(li.amount).toLocaleString()}</span></div>
                    ))}
                  </div>
                )}

                {/* Submit */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button onClick={submitQuote} disabled={quoteSubmitting} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: 'white', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: "'Inter', sans-serif", opacity: quoteSubmitting ? 0.7 : 1 }}>
                    {quoteSubmitting ? 'Sending...' : '📨 Send Quote to Client'}
                  </button>
                  <button onClick={resetQuoteForm} style={{ padding: '12px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Cancel</button>
                </div>
              </div>
            )}

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
