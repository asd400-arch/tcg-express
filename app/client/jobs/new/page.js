'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthContext';
import Sidebar from '../../../components/Sidebar';
import { useToast } from '../../../components/Toast';
import { supabase } from '../../../../lib/supabase';
import useMobile from '../../../components/useMobile';
import { JOB_CATEGORIES, EQUIPMENT_OPTIONS } from '../../../../lib/constants';
import { SIZE_TIERS, URGENCY_MULTIPLIERS, ADDON_OPTIONS, calculateFare, getSizeTierFromWeight } from '../../../../lib/fares';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function calculateFirstRun(form) {
  if (form.schedule_mode === 'once') {
    return new Date(form.schedule_date).toISOString();
  }
  const now = new Date();
  const [hours, minutes] = (form.recurrence_time || '09:00').split(':').map(Number);

  if (form.recurrence === 'monthly') {
    const dayOfMonth = parseInt(form.recurrence_day) || 1;
    let next = new Date(now.getFullYear(), now.getMonth(), dayOfMonth, hours, minutes, 0, 0);
    if (next <= now) next.setMonth(next.getMonth() + 1);
    return next.toISOString();
  }

  const targetDay = parseInt(form.recurrence_day) || 1;
  let next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  const currentDay = next.getDay();
  let daysUntil = (targetDay - currentDay + 7) % 7;
  if (daysUntil === 0 && next <= now) daysUntil = 7;
  next.setDate(next.getDate() + daysUntil);
  return next.toISOString();
}

export default function NewJob() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [successType, setSuccessType] = useState('job');
  const [form, setForm] = useState({
    pickup_address: '', pickup_contact: '', pickup_phone: '', pickup_instructions: '',
    delivery_address: '', delivery_contact: '', delivery_phone: '', delivery_instructions: '',
    item_description: '', item_category: 'general', item_weight: '', item_dimensions: '',
    urgency: 'standard', budget_min: '', budget_max: '', vehicle_required: 'any', special_requirements: '',
    equipment_needed: [], manpower_count: 1,
    pickup_by: '', deliver_by: '',
    // Fare fields
    size_tier: '',
    addons: {},
    // Schedule fields
    schedule_mode: 'now',
    schedule_date: '',
    recurrence: 'weekly',
    recurrence_day: '1',
    recurrence_time: '09:00',
    recurrence_end: '',
  });

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'client') router.push('/');
  }, [user, loading]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const setAddon = (key, qty) => setForm(prev => {
    const next = { ...prev.addons };
    if (qty > 0) next[key] = qty; else delete next[key];
    return { ...prev, addons: next };
  });

  // Auto-detect size tier from weight
  const suggestedSize = useMemo(() => getSizeTierFromWeight(form.item_weight), [form.item_weight]);
  const effectiveSize = form.size_tier || suggestedSize || '';

  // Real-time fare calculation
  const fare = useMemo(
    () => calculateFare({ sizeTier: effectiveSize, urgency: form.urgency, addons: form.addons }),
    [effectiveSize, form.urgency, form.addons]
  );

  // Styles
  const input = { width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' };
  const label = { fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' };
  const card = { background: 'white', borderRadius: '14px', padding: m ? '20px' : '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '20px' };
  const btnPrimary = { padding: '13px 32px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" };
  const btnBack = { padding: '13px 24px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" };

  const handleSubmit = async () => {
    if (!form.pickup_address || !form.delivery_address || !form.item_description) return;

    // Build fare info for special_requirements
    const fareInfo = {};
    if (effectiveSize) fareInfo.size_tier = effectiveSize;
    if (Object.keys(form.addons).length > 0) fareInfo.addons = form.addons;
    if (fare) fareInfo.estimated_fare = fare.total;

    let specialReqs = form.special_requirements;
    if (Object.keys(fareInfo).length > 0) {
      specialReqs = JSON.stringify({
        ...(form.special_requirements ? { notes: form.special_requirements } : {}),
        ...fareInfo,
      });
    }

    // Use fare-based budget if user didn't manually set
    const budgetMin = parseFloat(form.budget_min) || fare?.total || null;
    const budgetMax = parseFloat(form.budget_max) || fare?.total || null;

    if (form.schedule_mode === 'now') {
      setSubmitting(true);
      const { data, error } = await supabase.from('express_jobs').insert([{
        client_id: user.id,
        pickup_address: form.pickup_address, pickup_contact: form.pickup_contact, pickup_phone: form.pickup_phone, pickup_instructions: form.pickup_instructions,
        delivery_address: form.delivery_address, delivery_contact: form.delivery_contact, delivery_phone: form.delivery_phone, delivery_instructions: form.delivery_instructions,
        item_description: form.item_description, item_category: form.item_category,
        item_weight: parseFloat(form.item_weight) || null, item_dimensions: form.item_dimensions,
        urgency: form.urgency, budget_min: budgetMin, budget_max: budgetMax,
        vehicle_required: form.vehicle_required, special_requirements: specialReqs || null,
        equipment_needed: form.equipment_needed, manpower_count: form.manpower_count,
        pickup_by: form.pickup_by || null, deliver_by: form.deliver_by || null,
        status: 'open',
      }]).select().single();
      setSubmitting(false);
      if (error) { toast.error('Error: ' + error.message); return; }
      setSuccessType('job');
      setSuccess(data);
    } else {
      if (form.schedule_mode === 'once' && !form.schedule_date) {
        toast.error('Please select a date and time for the scheduled delivery');
        return;
      }
      setSubmitting(true);
      try {
        const scheduleBody = {
          schedule_type: form.schedule_mode === 'once' ? 'once' : form.recurrence,
          next_run_at: calculateFirstRun(form),
          pickup_address: form.pickup_address, pickup_contact: form.pickup_contact, pickup_phone: form.pickup_phone, pickup_instructions: form.pickup_instructions,
          delivery_address: form.delivery_address, delivery_contact: form.delivery_contact, delivery_phone: form.delivery_phone, delivery_instructions: form.delivery_instructions,
          item_description: form.item_description, item_category: form.item_category,
          item_weight: form.item_weight, item_dimensions: form.item_dimensions,
          urgency: form.urgency, budget_min: form.budget_min, budget_max: form.budget_max,
          vehicle_required: form.vehicle_required, special_requirements: specialReqs || form.special_requirements,
          equipment_needed: form.equipment_needed, manpower_count: form.manpower_count,
        };
        if (form.schedule_mode === 'recurring') {
          scheduleBody.run_time = form.recurrence_time;
          scheduleBody.ends_at = form.recurrence_end || null;
          if (form.recurrence === 'monthly') scheduleBody.day_of_month = parseInt(form.recurrence_day);
          else scheduleBody.day_of_week = parseInt(form.recurrence_day);
        }
        const res = await fetch('/api/schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scheduleBody) });
        const result = await res.json();
        setSubmitting(false);
        if (!res.ok) { toast.error(result.error || 'Failed to create schedule'); return; }
        setSuccessType('schedule');
        setSuccess(result.data);
      } catch {
        setSubmitting(false);
        toast.error('Failed to create schedule');
      }
    }
  };

  const resetForm = () => {
    setSuccess(null);
    setSuccessType('job');
    setStep(1);
    setForm({
      pickup_address: '', pickup_contact: '', pickup_phone: '', pickup_instructions: '',
      delivery_address: '', delivery_contact: '', delivery_phone: '', delivery_instructions: '',
      item_description: '', item_category: 'general', item_weight: '', item_dimensions: '',
      urgency: 'standard', budget_min: '', budget_max: '', vehicle_required: 'any', special_requirements: '',
      equipment_needed: [], manpower_count: 1, pickup_by: '', deliver_by: '',
      size_tier: '', addons: {},
      schedule_mode: 'now', schedule_date: '', recurrence: 'weekly', recurrence_day: '1', recurrence_time: '09:00', recurrence_end: '',
    });
  };

  if (loading || !user) return null;

  if (success) {
    const isSchedule = successType === 'schedule';
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
        <Sidebar active="New Job" />
        <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ ...card, maxWidth: '480px', textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>{isSchedule ? '📅' : '🎉'}</div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>{isSchedule ? 'Schedule Created!' : 'Job Posted!'}</h2>
            {!isSchedule && <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '6px' }}>Job #{success.job_number}</p>}
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
              {isSchedule ? 'Your delivery schedule has been set up.' : "Drivers will start bidding shortly."}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href={isSchedule ? '/client/schedules' : '/client/jobs'} style={{ padding: '12px 24px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>
                {isSchedule ? 'View Schedules' : 'View My Jobs'}
              </a>
              <a href="/client/jobs/new" onClick={(e) => { e.preventDefault(); resetForm(); }} style={{ padding: '12px 24px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#374151', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>Post Another</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const steps = ['Pickup & Delivery', 'Item & Fare', 'Preferences', 'Schedule'];
  const submitLabel = form.schedule_mode === 'now' ? 'Post Job' : form.schedule_mode === 'once' ? 'Schedule Job' : 'Create Schedule';
  const submitIcon = form.schedule_mode === 'now' ? '✅' : '📅';

  // ── Fare Breakdown Component ──
  const FareBreakdown = () => {
    if (!fare) return (
      <div style={{ ...card, border: '2px dashed #e2e8f0', textAlign: 'center', padding: '20px' }}>
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>Select a size tier to see fare estimate</p>
      </div>
    );
    return (
      <div style={{ ...card, border: '2px solid #3b82f6', background: '#fafcff' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#3b82f6', marginBottom: '14px' }}>💰 Fare Estimate</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px' }}>
          <span style={{ color: '#64748b' }}>Base fare ({SIZE_TIERS.find(t => t.key === effectiveSize)?.label})</span>
          <span style={{ fontWeight: '600', color: '#1e293b' }}>${fare.baseFare.toFixed(2)}</span>
        </div>
        {fare.multiplier > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px' }}>
            <span style={{ color: '#64748b' }}>Urgency ({URGENCY_MULTIPLIERS[form.urgency]?.label}) x{fare.multiplier}</span>
            <span style={{ fontWeight: '600', color: '#1e293b' }}>${fare.baseWithUrgency.toFixed(2)}</span>
          </div>
        )}
        {fare.addonLines.map(a => (
          <div key={a.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px' }}>
            <span style={{ color: '#64748b' }}>{a.label} ({a.qty} {a.unit}{a.qty > 1 ? 's' : ''})</span>
            <span style={{ fontWeight: '600', color: '#1e293b' }}>+${a.cost.toFixed(2)}</span>
          </div>
        ))}
        <div style={{ height: '1px', background: '#3b82f6', opacity: 0.2, margin: '10px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>Estimated Total</span>
          <span style={{ fontSize: '22px', fontWeight: '700', color: '#3b82f6' }}>${fare.total.toFixed(2)}</span>
        </div>
        <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '10px', marginTop: '8px', textAlign: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#3b82f6' }}>
            Recommended budget: ${fare.budgetMin} – ${fare.budgetMax}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="New Job" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', maxWidth: '720px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>➕ New Delivery Job</h1>

        {/* Steps indicator */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '25px' }}>
          {steps.map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: '4px', borderRadius: '2px', background: step > i ? '#3b82f6' : '#e2e8f0', marginBottom: '6px' }} />
              <span style={{ fontSize: '12px', fontWeight: '600', color: step > i ? '#3b82f6' : '#94a3b8' }}>{s}</span>
            </div>
          ))}
        </div>

        {/* ── Step 1: Addresses ── */}
        {step === 1 && (
          <div>
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>📍 Pickup Location</h3>
              <div style={{ marginBottom: '14px' }}><label style={label}>Pickup Address *</label><input style={input} value={form.pickup_address} onChange={e => set('pickup_address', e.target.value)} placeholder="Full address" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div><label style={label}>Contact Name</label><input style={input} value={form.pickup_contact} onChange={e => set('pickup_contact', e.target.value)} placeholder="Name" /></div>
                <div><label style={label}>Phone</label><input style={input} value={form.pickup_phone} onChange={e => set('pickup_phone', e.target.value)} placeholder="+65 xxxx xxxx" /></div>
              </div>
              <div style={{ marginTop: '14px' }}><label style={label}>Instructions</label><textarea style={{ ...input, height: '60px', resize: 'vertical' }} value={form.pickup_instructions} onChange={e => set('pickup_instructions', e.target.value)} placeholder="Loading dock, gate code, etc." /></div>
            </div>
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>📦 Delivery Location</h3>
              <div style={{ marginBottom: '14px' }}><label style={label}>Delivery Address *</label><input style={input} value={form.delivery_address} onChange={e => set('delivery_address', e.target.value)} placeholder="Full address" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div><label style={label}>Contact Name</label><input style={input} value={form.delivery_contact} onChange={e => set('delivery_contact', e.target.value)} placeholder="Name" /></div>
                <div><label style={label}>Phone</label><input style={input} value={form.delivery_phone} onChange={e => set('delivery_phone', e.target.value)} placeholder="+65 xxxx xxxx" /></div>
              </div>
              <div style={{ marginTop: '14px' }}><label style={label}>Instructions</label><textarea style={{ ...input, height: '60px', resize: 'vertical' }} value={form.delivery_instructions} onChange={e => set('delivery_instructions', e.target.value)} placeholder="Leave at reception, call on arrival, etc." /></div>
            </div>
            <button onClick={() => { if (form.pickup_address && form.delivery_address) setStep(2); }} style={btnPrimary}>Next →</button>
          </div>
        )}

        {/* ── Step 2: Item Details & Fare ── */}
        {step === 2 && (
          <div>
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>📋 Item Details</h3>
              <div style={{ marginBottom: '14px' }}><label style={label}>Description *</label><input style={input} value={form.item_description} onChange={e => set('item_description', e.target.value)} placeholder="What are you sending?" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={label}>Category</label>
                  <select style={input} value={form.item_category} onChange={e => set('item_category', e.target.value)}>
                    <optgroup label="Standard">
                      {JOB_CATEGORIES.filter(c => c.group === 'standard').map(c => (
                        <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Premium">
                      {JOB_CATEGORIES.filter(c => c.group === 'premium').map(c => (
                        <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label style={label}>Weight (kg)</label>
                  <input type="number" style={input} value={form.item_weight} onChange={e => {
                    set('item_weight', e.target.value);
                    const auto = getSizeTierFromWeight(e.target.value);
                    if (auto && !form.size_tier) set('size_tier', auto);
                  }} placeholder="0.0" />
                </div>
              </div>
              <div style={{ marginBottom: '14px' }}><label style={label}>Dimensions (L x W x H cm)</label><input style={input} value={form.item_dimensions} onChange={e => set('item_dimensions', e.target.value)} placeholder="30 x 20 x 15" /></div>
            </div>

            {/* Size Tier */}
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>📏 Size Tier</h3>
              {suggestedSize && !form.size_tier && (
                <p style={{ fontSize: '13px', color: '#22c55e', fontWeight: '500', marginBottom: '10px' }}>Auto-detected from weight: {SIZE_TIERS.find(t => t.key === suggestedSize)?.label}</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {SIZE_TIERS.map(tier => {
                  const active = form.size_tier === tier.key || (!form.size_tier && suggestedSize === tier.key);
                  return (
                    <div key={tier.key} onClick={() => set('size_tier', tier.key)} style={{
                      display: 'flex', alignItems: 'center', padding: '14px 16px', borderRadius: '10px', cursor: 'pointer',
                      border: active ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                      background: active ? '#eff6ff' : 'white',
                    }}>
                      <span style={{ fontSize: '22px', marginRight: '12px' }}>{tier.icon}</span>
                      <span style={{ flex: 1, fontSize: '14px', fontWeight: '600', color: active ? '#3b82f6' : '#1e293b' }}>{tier.label}</span>
                      <span style={{ fontSize: '18px', fontWeight: '700', color: active ? '#3b82f6' : '#64748b' }}>${tier.baseFare}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Urgency */}
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>⚡ Urgency</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                {Object.entries(URGENCY_MULTIPLIERS).map(([key, u]) => {
                  const active = form.urgency === key;
                  return (
                    <div key={key} onClick={() => set('urgency', key)} style={{
                      flex: 1, padding: '14px', borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
                      border: active ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                      background: active ? '#eff6ff' : 'white',
                    }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: active ? '#3b82f6' : '#1e293b' }}>{u.label}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{u.desc}</div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: active ? '#3b82f6' : '#94a3b8', marginTop: '6px' }}>x{u.multiplier.toFixed(1)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Add-ons */}
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>🛠️ Add-ons</h3>
              {ADDON_OPTIONS.map(opt => {
                const qty = form.addons[opt.key] || 0;
                const active = qty > 0;
                return (
                  <div key={opt.key} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderRadius: '10px', marginBottom: '8px',
                    border: active ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                    background: active ? '#eff6ff' : 'white',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>{opt.icon}</span>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{opt.label}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>+${opt.price}/{opt.unit}</div>
                      </div>
                    </div>
                    {opt.hasQty ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button type="button" onClick={() => setAddon(opt.key, Math.max(0, qty - 1))} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', fontSize: '16px', cursor: 'pointer', color: '#374151' }}>−</button>
                        <span style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', minWidth: '20px', textAlign: 'center' }}>{qty}</span>
                        <button type="button" onClick={() => setAddon(opt.key, qty + 1)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', fontSize: '16px', cursor: 'pointer', color: '#374151' }}>+</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setAddon(opt.key, active ? 0 : 1)} style={{
                        padding: '8px 16px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                        background: active ? '#3b82f6' : '#e2e8f0',
                        color: active ? 'white' : '#64748b',
                      }}>{active ? '✓ Added' : 'Add'}</button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Equipment */}
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>🔧 Equipment Needed</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {EQUIPMENT_OPTIONS.map(eq => {
                  const selected = form.equipment_needed.includes(eq.key);
                  return (
                    <div key={eq.key} onClick={() => {
                      const next = selected ? form.equipment_needed.filter(k => k !== eq.key) : [...form.equipment_needed, eq.key];
                      set('equipment_needed', next);
                      setAddon('equipment_fee', next.length);
                    }} style={{
                      padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                      border: selected ? '2px solid #4f46e5' : '2px solid #e2e8f0',
                      background: selected ? '#eef2ff' : 'white',
                      color: selected ? '#4f46e5' : '#64748b',
                    }}>
                      {eq.label}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: '14px' }}>
                <label style={label}>Manpower (Workers)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button type="button" onClick={() => { const n = Math.max(1, form.manpower_count - 1); set('manpower_count', n); if (n > 1) setAddon('extra_manpower', n - 1); else setAddon('extra_manpower', 0); }} style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', fontSize: '18px', cursor: 'pointer', color: '#374151' }}>−</button>
                  <span style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', minWidth: '30px', textAlign: 'center' }}>{form.manpower_count}</span>
                  <button type="button" onClick={() => { const n = Math.min(20, form.manpower_count + 1); set('manpower_count', n); if (n > 1) setAddon('extra_manpower', n - 1); else setAddon('extra_manpower', 0); }} style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', fontSize: '18px', cursor: 'pointer', color: '#374151' }}>+</button>
                  {form.manpower_count > 1 && <span style={{ fontSize: '12px', color: '#64748b' }}>+${(form.manpower_count - 1) * 30} ({form.manpower_count - 1} extra)</span>}
                </div>
              </div>
            </div>

            {/* Fare Breakdown */}
            <FareBreakdown />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep(1)} style={btnBack}>← Back</button>
              <button onClick={() => { if (form.item_description) setStep(3); }} style={btnPrimary}>Next →</button>
            </div>
          </div>
        )}

        {/* ── Step 3: Preferences & Budget ── */}
        {step === 3 && (
          <div>
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>💲 Budget</h3>
              {fare && (
                <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#3b82f6', fontWeight: '600' }}>Estimated fare: ${fare.total.toFixed(2)}</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Recommended: ${fare.budgetMin} – ${fare.budgetMax}</span>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div><label style={label}>Budget Min ($)</label><input type="number" style={{ ...input, ...(fare && parseFloat(form.budget_min) > 0 && parseFloat(form.budget_min) < fare.budgetMin ? { borderColor: '#f59e0b', borderWidth: '2px' } : {}) }} value={form.budget_min} onChange={e => set('budget_min', e.target.value)} placeholder={fare ? String(fare.budgetMin) : '10'} /></div>
                <div><label style={label}>Budget Max ($)</label><input type="number" style={input} value={form.budget_max} onChange={e => set('budget_max', e.target.value)} placeholder={fare ? String(fare.budgetMax) : '50'} /></div>
              </div>
              {fare && parseFloat(form.budget_min) > 0 && parseFloat(form.budget_min) < fare.budgetMin && (
                <p style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '500', margin: '0 0 10px' }}>⚠️ Below recommended minimum. Drivers may not accept.</p>
              )}
              {fare && !form.budget_min && !form.budget_max && (
                <button type="button" onClick={() => setForm(prev => ({ ...prev, budget_min: String(fare.budgetMin), budget_max: String(fare.budgetMax) }))} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #3b82f6', background: '#eff6ff', color: '#3b82f6', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                  Use recommended: ${fare.budgetMin} – ${fare.budgetMax}
                </button>
              )}
            </div>

            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>⚙️ Other Preferences</h3>
              <div style={{ marginBottom: '14px' }}>
                <label style={label}>Vehicle Required</label>
                <select style={input} value={form.vehicle_required} onChange={e => set('vehicle_required', e.target.value)}>
                  <option value="any">Any Vehicle</option>
                  <option value="motorcycle">Motorcycle</option>
                  <option value="car">Car</option>
                  <option value="van">Van</option>
                  <option value="truck">Truck</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div><label style={label}>Pickup By</label><input type="datetime-local" style={input} value={form.pickup_by} onChange={e => set('pickup_by', e.target.value)} /></div>
                <div><label style={label}>Deliver By</label><input type="datetime-local" style={input} value={form.deliver_by} onChange={e => set('deliver_by', e.target.value)} /></div>
              </div>
              <div><label style={label}>Special Requirements</label><textarea style={{ ...input, height: '60px', resize: 'vertical' }} value={form.special_requirements} onChange={e => set('special_requirements', e.target.value)} placeholder="Handling instructions, insurance needs, etc." /></div>
            </div>

            {/* Fare summary */}
            <FareBreakdown />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep(2)} style={btnBack}>← Back</button>
              <button onClick={() => setStep(4)} style={btnPrimary}>Next →</button>
            </div>
          </div>
        )}

        {/* ── Step 4: Schedule ── */}
        {step === 4 && (
          <div>
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>📅 Schedule</h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Choose when this delivery should be posted</p>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: m ? 'wrap' : 'nowrap' }}>
                {[
                  { key: 'now', label: 'Post Now', desc: 'Create job immediately', icon: '⚡' },
                  { key: 'once', label: 'Schedule Later', desc: 'Post at a specific date/time', icon: '📆' },
                  { key: 'recurring', label: 'Recurring', desc: 'Auto-create on a regular schedule', icon: '🔄' },
                ].map(mode => (
                  <div key={mode.key} onClick={() => set('schedule_mode', mode.key)} style={{
                    flex: 1, minWidth: m ? '100%' : 0, padding: '16px', borderRadius: '12px', cursor: 'pointer', textAlign: 'center',
                    border: form.schedule_mode === mode.key ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                    background: form.schedule_mode === mode.key ? '#eff6ff' : 'white',
                  }}>
                    <div style={{ fontSize: '24px', marginBottom: '6px' }}>{mode.icon}</div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{mode.label}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{mode.desc}</div>
                  </div>
                ))}
              </div>

              {form.schedule_mode === 'once' && (
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <label style={label}>Date & Time *</label>
                  <input type="datetime-local" style={input} value={form.schedule_date} onChange={e => set('schedule_date', e.target.value)} min={new Date().toISOString().slice(0, 16)} />
                </div>
              )}

              {form.schedule_mode === 'recurring' && (
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={label}>Frequency</label>
                    <select style={input} value={form.recurrence} onChange={e => { set('recurrence', e.target.value); set('recurrence_day', '1'); }}>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Every 2 Weeks</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  {form.recurrence === 'monthly' ? (
                    <div style={{ marginBottom: '14px' }}>
                      <label style={label}>Day of Month</label>
                      <select style={input} value={form.recurrence_day} onChange={e => set('recurrence_day', e.target.value)}>
                        {Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div style={{ marginBottom: '14px' }}>
                      <label style={label}>Day of Week</label>
                      <select style={input} value={form.recurrence_day} onChange={e => set('recurrence_day', e.target.value)}>
                        {DAY_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
                      </select>
                    </div>
                  )}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={label}>Time</label>
                    <input type="time" style={input} value={form.recurrence_time} onChange={e => set('recurrence_time', e.target.value)} />
                  </div>
                  <div>
                    <label style={label}>End Date (optional)</label>
                    <input type="date" style={input} value={form.recurrence_end} onChange={e => set('recurrence_end', e.target.value)} min={new Date().toISOString().slice(0, 10)} />
                    <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Leave empty to run indefinitely</p>
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep(3)} style={btnBack}>← Back</button>
              <button onClick={handleSubmit} disabled={submitting} style={{ ...btnPrimary, background: 'linear-gradient(135deg, #10b981, #059669)', opacity: submitting ? 0.7 : 1 }}>{submitting ? 'Creating...' : `${submitIcon} ${submitLabel}`}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
