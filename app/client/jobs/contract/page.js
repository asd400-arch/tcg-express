'use client';
// Contract order: one pickup, several drops, fixed rate card, monthly invoice (2 Oct 2026).
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthContext';
import Sidebar from '../../../components/Sidebar';
import { useToast } from '../../../components/Toast';
import useMobile from '../../../components/useMobile';
import { toLocalDatetime } from '../../../../lib/job-helpers';
import { defaultPickupDate, pickupTooSoon, minPickupMessage, PICKUP_LEAD_NOTE } from '../../../../lib/job-rules';

const DRAFT_KEY = 'tcg_trip_draft_v1';
const emptyDrop = () => ({ address: '', unit: '', no_unit: false, contact: '', phone: '', instructions: '', item: '' });

function AddressInput({ value, onChange, placeholder, style }) {
  const [list, setList] = useState([]);
  const [show, setShow] = useState(false);
  const t = useRef(null);
  const search = useCallback(async (q) => {
    if (!q || q.trim().length < 3) { setList([]); setShow(false); return; }
    try {
      const res = await fetch(`/api/address/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setList(data.results || []);
      setShow((data.results || []).length > 0);
    } catch { setList([]); }
  }, []);
  return (
    <div style={{ position: 'relative' }}>
      <input style={style} value={value} placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); clearTimeout(t.current); t.current = setTimeout(() => search(e.target.value), 400); }}
        onFocus={() => { if (list.length) setShow(true); }} onBlur={() => setTimeout(() => setShow(false), 200)} />
      {show && list.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', border: '1px solid #e2e8f0', zIndex: 50, maxHeight: '220px', overflow: 'auto', marginTop: '4px' }}>
          {list.map((s, i) => (
            <div key={i} onClick={() => { onChange(s.address); setShow(false); }} style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
              <div style={{ fontWeight: 500 }}>{s.address}</div>
              {(s.building || s.postal) && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{[s.building, s.postal ? `S(${s.postal})` : ''].filter(Boolean).join(' · ')}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ContractOrderPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();

  const [card, setCard] = useState(undefined); // undefined = loading, null = no contract
  const [pickup, setPickup] = useState({ address: '', unit: '', no_unit: false, contact: '', phone: '', instructions: '' });
  const [pickupBy, setPickupBy] = useState(() => toLocalDatetime(defaultPickupDate().getTime()));
  const [item, setItem] = useState('');
  const [drops, setDrops] = useState([emptyDrop()]);
  const [driverCode, setDriverCode] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'client') router.push('/');
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/jobs/trip').then((r) => r.json()).then((r) => setCard(r.data || null)).catch(() => setCard(null));
  }, [user]);

  // Keep an unfinished order (pickup + drops) in this browser
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (d?.pickup) setPickup(d.pickup);
      if (Array.isArray(d?.drops) && d.drops.length) setDrops(d.drops);
      if (d?.item) setItem(d.item);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (!loaded.current || done) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ pickup, drops, item })); } catch { /* ignore */ }
  }, [pickup, drops, item, done]);

  const total = useMemo(() => {
    if (!card) return 0;
    return drops.reduce((sum, _d, i) => sum + (i === 0 ? card.first_drop_sgd : card.next_drop_sgd), 0);
  }, [card, drops]);

  const setDrop = (i, k, v) => setDrops((ds) => ds.map((d, j) => (j === i ? { ...d, [k]: v } : d)));
  const clearErr = (k) => setErrors((p) => { const { [k]: _x, ...r } = p; return r; });

  // Paste rows from Excel / Google Sheets: address, unit, contact, phone, instructions, item (tab-separated)
  const pasteRows = (text) => {
    const rows = String(text || '').split(/\r?\n/).map((l) => l.split('\t')).filter((c) => c.join('').trim());
    if (!rows.length) return;
    const parsed = rows.map((c) => ({ ...emptyDrop(), address: (c[0] || '').trim(), unit: (c[1] || '').trim(), contact: (c[2] || '').trim(), phone: (c[3] || '').trim(), instructions: (c[4] || '').trim(), item: (c[5] || '').trim() }));
    setDrops((ds) => [...ds.filter((d) => d.address.trim()), ...parsed].slice(0, 60));
    toast.success(`${parsed.length} drop${parsed.length > 1 ? 's' : ''} added`);
  };

  const validate = () => {
    const e = {};
    if (!pickup.address.trim()) e.pickup_address = 'Pickup address is required';
    if (!pickup.no_unit && !pickup.unit.trim()) e.pickup_unit = 'Unit no. required, or tick "No unit"';
    if (!pickup.contact.trim()) e.pickup_contact = 'Required';
    if (!pickup.phone.trim()) e.pickup_phone = 'Required';
    if (pickupTooSoon(pickupBy)) e.pickup_by = minPickupMessage();
    drops.forEach((d, i) => {
      if (!d.address.trim()) e[`d${i}_address`] = 'Address required';
      if (!d.no_unit && !d.unit.trim()) e[`d${i}_unit`] = 'Unit required, or tick "No unit"';
      if (!d.contact.trim()) e[`d${i}_contact`] = 'Required';
      if (!d.phone.trim()) e[`d${i}_phone`] = 'Required';
    });
    setErrors(e);
    if (Object.keys(e).length) toast.error(Object.values(e)[0]);
    return !Object.keys(e).length;
  };

  const submit = async () => {
    if (submitting || !validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/jobs/trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickup, pickup_by: new Date(pickupBy).toISOString(), item_description: item, drops, driver_code: driverCode.trim() || undefined }),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(r.error || 'Could not post the trip'); return; }
      setDone(r.data);
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    } catch {
      toast.error('Could not post the trip');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user || card === undefined) return null;

  const input = { width: '100%', padding: '10px 12px', borderRadius: '9px', fontSize: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' };
  const inp = (k) => ({ ...input, border: errors[k] ? '1.5px solid #ef4444' : '1px solid #e2e8f0' });
  const label = { fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' };
  const card$ = { background: 'white', borderRadius: '14px', padding: m ? '16px' : '22px', border: '1px solid #f1f5f9', marginBottom: '16px' };
  const err = (k) => (errors[k] ? <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '3px' }}>{errors[k]}</div> : null);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="New Delivery" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', maxWidth: '860px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>📦 Contract order</h1>

        {card === null ? (
          <div style={card$}>
            <p style={{ fontSize: '14px', color: '#475569' }}>Contract ordering (fixed rate per drop, monthly invoice) isn&apos;t set up for your account yet. WhatsApp us on +65 8976 3771 and we&apos;ll set it up.</p>
            <button onClick={() => router.push('/client/jobs/new')} style={{ marginTop: '10px', padding: '10px 18px', borderRadius: '10px', border: 'none', background: '#2563eb', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Post a regular delivery</button>
          </div>
        ) : done ? (
          <div style={{ ...card$, textAlign: 'center', padding: '36px' }}>
            <div style={{ fontSize: '44px' }}>🎉</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '10px 0 6px' }}>Trip posted: {done.drops} drop{done.drops > 1 ? 's' : ''}</h2>
            <p style={{ fontSize: '14px', color: '#475569' }}>S${Number(done.total_sgd).toFixed(2)} on your monthly invoice. {done.driver ? `${done.driver} has been notified.` : 'Our fleet drivers have been notified — one driver takes the whole trip.'}</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '16px' }}>
              <button onClick={() => router.push('/client/jobs')} style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: '#2563eb', color: 'white', fontWeight: 600, cursor: 'pointer' }}>View my jobs</button>
              <button onClick={() => { setDone(null); setDrops([emptyDrop()]); }} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', fontWeight: 600, cursor: 'pointer' }}>New trip</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ ...card$, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '14px', color: '#1e3a8a', fontWeight: 700 }}>{card.label}: S${card.first_drop_sgd.toFixed(2)} first drop · S${card.next_drop_sgd.toFixed(2)} each additional drop</div>
              <div style={{ fontSize: '12px', color: '#1e40af', marginTop: '4px' }}>Billed on your monthly invoice (payment {card.payment_terms_days} days). {card.driver_pool === 'tcg' ? 'Delivered by the TCG Express fleet.' : 'Delivered by on-call drivers.'} One driver takes the whole trip.</div>
            </div>

            <div style={card$}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>📍 Pickup</h3>
              <div style={{ marginBottom: '10px' }}><label style={label}>Address *</label><AddressInput style={inp('pickup_address')} value={pickup.address} onChange={(v) => { setPickup((p) => ({ ...p, address: v })); clearErr('pickup_address'); }} placeholder="Search address or postal code" />{err('pickup_address')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr 1fr', gap: '10px' }}>
                <div><label style={label}>Unit no. *</label><input style={{ ...inp('pickup_unit'), opacity: pickup.no_unit ? 0.5 : 1 }} disabled={pickup.no_unit} value={pickup.no_unit ? '' : pickup.unit} onChange={(e) => { setPickup((p) => ({ ...p, unit: e.target.value })); clearErr('pickup_unit'); }} placeholder="#01-23" />
                  <label style={{ fontSize: '11px', color: '#64748b', display: 'flex', gap: '5px', marginTop: '4px' }}><input type="checkbox" checked={pickup.no_unit} onChange={(e) => { setPickup((p) => ({ ...p, no_unit: e.target.checked })); clearErr('pickup_unit'); }} />No unit</label>{err('pickup_unit')}</div>
                <div><label style={label}>Contact *</label><input style={inp('pickup_contact')} value={pickup.contact} onChange={(e) => { setPickup((p) => ({ ...p, contact: e.target.value })); clearErr('pickup_contact'); }} placeholder="Name" />{err('pickup_contact')}</div>
                <div><label style={label}>Phone *</label><input style={inp('pickup_phone')} value={pickup.phone} onChange={(e) => { setPickup((p) => ({ ...p, phone: e.target.value })); clearErr('pickup_phone'); }} placeholder="+65" />{err('pickup_phone')}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                <div><label style={label}>Pickup time *</label><input type="datetime-local" style={inp('pickup_by')} value={pickupBy} min={toLocalDatetime(defaultPickupDate().getTime())} onChange={(e) => { setPickupBy(e.target.value); clearErr('pickup_by'); }} />{err('pickup_by')}</div>
                <div><label style={label}>What are you sending?</label><input style={input} value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Phone parts (fragile LCD)" /></div>
              </div>
              <div style={{ marginTop: '10px' }}><label style={label}>Pickup instructions</label><input style={input} value={pickup.instructions} onChange={(e) => setPickup((p) => ({ ...p, instructions: e.target.value }))} placeholder="e.g. Collect from counter, call office if no one" /></div>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>{PICKUP_LEAD_NOTE}</p>
            </div>

            <div style={card$}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700 }}>📦 Drops ({drops.length})</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Tip: copy rows from Excel (address, unit, contact, phone, instructions, item) and paste into any address box.</span>
              </div>
              {drops.map((d, i) => (
                <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '13px' }}>Drop {i + 1} · S${(i === 0 ? card.first_drop_sgd : card.next_drop_sgd).toFixed(2)}</strong>
                    {drops.length > 1 && <button onClick={() => setDrops((ds) => ds.filter((_x, j) => j !== i))} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>Remove</button>}
                  </div>
                  <div onPaste={(e) => { const t = e.clipboardData.getData('text'); if (t.includes('\t') || t.includes('\n')) { e.preventDefault(); pasteRows(t); } }}>
                    <AddressInput style={inp(`d${i}_address`)} value={d.address} onChange={(v) => { setDrop(i, 'address', v); clearErr(`d${i}_address`); }} placeholder="Delivery address or postal code" />
                  </div>
                  {err(`d${i}_address`)}
                  <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr 1fr', gap: '8px', marginTop: '8px' }}>
                    <div><input style={{ ...inp(`d${i}_unit`), opacity: d.no_unit ? 0.5 : 1 }} disabled={d.no_unit} value={d.no_unit ? '' : d.unit} onChange={(e) => { setDrop(i, 'unit', e.target.value); clearErr(`d${i}_unit`); }} placeholder="Unit no. *" />
                      <label style={{ fontSize: '11px', color: '#64748b', display: 'flex', gap: '5px', marginTop: '3px' }}><input type="checkbox" checked={d.no_unit} onChange={(e) => { setDrop(i, 'no_unit', e.target.checked); clearErr(`d${i}_unit`); }} />No unit</label>{err(`d${i}_unit`)}</div>
                    <div><input style={inp(`d${i}_contact`)} value={d.contact} onChange={(e) => { setDrop(i, 'contact', e.target.value); clearErr(`d${i}_contact`); }} placeholder="Shop / contact *" />{err(`d${i}_contact`)}</div>
                    <div><input style={inp(`d${i}_phone`)} value={d.phone} onChange={(e) => { setDrop(i, 'phone', e.target.value); clearErr(`d${i}_phone`); }} placeholder="Phone *" />{err(`d${i}_phone`)}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                    <input style={input} value={d.instructions} onChange={(e) => setDrop(i, 'instructions', e.target.value)} placeholder="Instructions (optional)" />
                    <input style={input} value={d.item} onChange={(e) => setDrop(i, 'item', e.target.value)} placeholder="Item (optional)" />
                  </div>
                </div>
              ))}
              {drops.length < 60 && <button onClick={() => setDrops((ds) => [...ds, emptyDrop()])} style={{ padding: '9px 16px', borderRadius: '9px', border: '1px dashed #94a3b8', background: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>+ Add drop</button>}
            </div>

            <div style={card$}>
              <label style={label}>Book a specific driver (optional)</label>
              <input style={{ ...input, maxWidth: '260px', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }} value={driverCode} onChange={(e) => setDriverCode(e.target.value)} placeholder="Driver code" maxLength={8} />
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Leave empty and the first available {card.driver_pool === 'tcg' ? 'fleet ' : ''}driver takes the whole trip.</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '15px', fontWeight: 700 }}>Total: S${total.toFixed(2)} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>({drops.length} drop{drops.length > 1 ? 's' : ''}, monthly invoice)</span></div>
              <button onClick={submit} disabled={submitting} style={{ padding: '13px 28px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '15px', fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}>{submitting ? 'Posting…' : 'Post trip'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
