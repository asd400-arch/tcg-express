'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthContext';
import Sidebar from '../../../components/Sidebar';
import { useToast } from '../../../components/Toast';
import { supabase } from '../../../../lib/supabase';
import useMobile from '../../../components/useMobile';
import { JOB_CATEGORIES, EQUIPMENT_OPTIONS } from '../../../../lib/constants';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function calculateFirstRun(form) {
  if (form.schedule_mode === 'once') {
    return new Date(form.schedule_date).toISOString();
  }
  // Recurring: find next occurrence of chosen day/time from now
  const now = new Date();
  const [hours, minutes] = (form.recurrence_time || '09:00').split(':').map(Number);

  if (form.recurrence === 'monthly') {
    const dayOfMonth = parseInt(form.recurrence_day) || 1;
    let next = new Date(now.getFullYear(), now.getMonth(), dayOfMonth, hours, minutes, 0, 0);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
    }
    return next.toISOString();
  }

  // weekly or biweekly
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
  const [successType, setSuccessType] = useState('job'); // 'job' or 'schedule'
  const [categoryRates, setCategoryRates] = useState({});
  const [form, setForm] = useState({
    pickup_address: '', pickup_contact: '', pickup_phone: '', pickup_instructions: '',
    delivery_address: '', delivery_contact: '', delivery_phone: '', delivery_instructions: '',
    item_description: '', item_category: 'general', item_weight: '', item_dimensions: '',
    urgency: 'standard', budget_min: '', budget_max: '', vehicle_required: 'any', special_requirements: '',
    equipment_needed: [], manpower_count: 1,
    pickup_by: '', deliver_by: '',
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
    if (!loading && user && user.role === 'client') {
      fetch('/api/admin/settings').then(r => r.json()).then(result => {
        if (result.data?.category_rates) {
          try { setCategoryRates(JSON.parse(result.data.category_rates)); } catch {}
        }
      }).catch(() => {});
    }
  }, [user, loading]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const input = { width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' };
  const label = { fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' };
  const card = { background: 'white', borderRadius: '14px', padding: m ? '20px' : '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '20px' };

  const handleSubmit = async () => {
    if (!form.pickup_address || !form.delivery_address || !form.item_description) return;

    if (form.schedule_mode === 'now') {
      // Existing direct Supabase insert
      setSubmitting(true);
      const { data, error } = await supabase.from('express_jobs').insert([{
        client_id: user.id,
        pickup_address: form.pickup_address, pickup_contact: form.pickup_contact, pickup_phone: form.pickup_phone, pickup_instructions: form.pickup_instructions,
        delivery_address: form.delivery_address, delivery_contact: form.delivery_contact, delivery_phone: form.delivery_phone, delivery_instructions: form.delivery_instructions,
        item_description: form.item_description, item_category: form.item_category,
        item_weight: parseFloat(form.item_weight) || null, item_dimensions: form.item_dimensions,
        urgency: form.urgency, budget_min: parseFloat(form.budget_min) || null, budget_max: parseFloat(form.budget_max) || null,
        vehicle_required: form.vehicle_required, special_requirements: form.special_requirements,
        equipment_needed: form.equipment_needed, manpower_count: form.manpower_count,
        pickup_by: form.pickup_by || null, deliver_by: form.deliver_by || null,
        status: 'open',
      }]).select().single();
      setSubmitting(false);
      if (error) { toast.error('Error: ' + error.message); return; }
      setSuccessType('job');
      setSuccess(data);
    } else {
      // Schedule via API
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
          vehicle_required: form.vehicle_required, special_requirements: form.special_requirements,
          equipment_needed: form.equipment_needed, manpower_count: form.manpower_count,
        };

        if (form.schedule_mode === 'recurring') {
          scheduleBody.run_time = form.recurrence_time;
          scheduleBody.ends_at = form.recurrence_end || null;
          if (form.recurrence === 'monthly') {
            scheduleBody.day_of_month = parseInt(form.recurrence_day);
          } else {
            scheduleBody.day_of_week = parseInt(form.recurrence_day);
          }
        }

        const res = await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scheduleBody),
        });
        const result = await res.json();
        setSubmitting(false);

        if (!res.ok) {
          toast.error(result.error || 'Failed to create schedule');
          return;
        }
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
      equipment_needed: [], manpower_count: 1,
      pickup_by: '', deliver_by: '',
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
              {isSchedule
                ? 'Your delivery schedule has been set up. Jobs will be automatically created according to your schedule.'
                : "Drivers will start bidding shortly. You'll be notified when bids come in."}
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

  const steps = ['Pickup & Delivery', 'Item Details', 'Preferences', 'Schedule'];

  const submitLabel = form.schedule_mode === 'now' ? 'Post Job' : form.schedule_mode === 'once' ? 'Schedule Job' : 'Create Schedule';
  const submitIcon = form.schedule_mode === 'now' ? '✅' : '📅';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="New Job" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', maxWidth: '720px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>➕ New Delivery Job</h1>

        {/* Steps indicator */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '25px' }}>
          {steps.map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: '4px', borderRadius: '2px', background: step > i ? '#3b82f6' : '#e2e8f0', marginBottom: '6px' }}></div>
              <span style={{ fontSize: '12px', fontWeight: '600', color: step > i ? '#3b82f6' : '#94a3b8' }}>{s}</span>
            </div>
          ))}
        </div>

        {/* Step 1: Addresses */}
        {step === 1 && (
          <div>
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>📍 Pickup Location</h3>
              <div style={{ marginBottom: '14px' }}><label style={label}>Pickup Address *</label><input style={input} value={form.pickup_address} onChange={e => set('pickup_address', e.target.value)} placeholder="Full address" required /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div><label style={label}>Contact Name</label><input style={input} value={form.pickup_contact} onChange={e => set('pickup_contact', e.target.value)} placeholder="Name" /></div>
                <div><label style={label}>Phone</label><input style={input} value={form.pickup_phone} onChange={e => set('pickup_phone', e.target.value)} placeholder="+65 xxxx xxxx" /></div>
              </div>
              <div style={{ marginTop: '14px' }}><label style={label}>Instructions</label><textarea style={{ ...input, height: '60px', resize: 'vertical' }} value={form.pickup_instructions} onChange={e => set('pickup_instructions', e.target.value)} placeholder="Loading dock, gate code, etc." /></div>
            </div>
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>📦 Delivery Location</h3>
              <div style={{ marginBottom: '14px' }}><label style={label}>Delivery Address *</label><input style={input} value={form.delivery_address} onChange={e => set('delivery_address', e.target.value)} placeholder="Full address" required /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div><label style={label}>Contact Name</label><input style={input} value={form.delivery_contact} onChange={e => set('delivery_contact', e.target.value)} placeholder="Name" /></div>
                <div><label style={label}>Phone</label><input style={input} value={form.delivery_phone} onChange={e => set('delivery_phone', e.target.value)} placeholder="+65 xxxx xxxx" /></div>
              </div>
              <div style={{ marginTop: '14px' }}><label style={label}>Instructions</label><textarea style={{ ...input, height: '60px', resize: 'vertical' }} value={form.delivery_instructions} onChange={e => set('delivery_instructions', e.target.value)} placeholder="Leave at reception, call on arrival, etc." /></div>
            </div>
            <button onClick={() => { if (form.pickup_address && form.delivery_address) setStep(2); }} style={{ padding: '13px 32px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Next →</button>
          </div>
        )}

        {/* Step 2: Item */}
        {step === 2 && (
          <div>
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>📋 Item Details</h3>
              <div style={{ marginBottom: '14px' }}><label style={label}>Description *</label><input style={input} value={form.item_description} onChange={e => set('item_description', e.target.value)} placeholder="What are you sending?" required /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={label}>Category</label>
                  <select style={input} value={form.item_category} onChange={e => {
                    const cat = e.target.value;
                    set('item_category', cat);
                    if (categoryRates[cat]) {
                      const rate = parseFloat(categoryRates[cat]);
                      setForm(prev => ({ ...prev, item_category: cat, budget_min: String(rate), budget_max: String(rate) }));
                    }
                  }}>
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
                <div><label style={label}>Weight (kg)</label><input type="number" style={input} value={form.item_weight} onChange={e => set('item_weight', e.target.value)} placeholder="0.0" /></div>
              </div>
              <div><label style={label}>Dimensions (L x W x H cm)</label><input style={input} value={form.item_dimensions} onChange={e => set('item_dimensions', e.target.value)} placeholder="30 x 20 x 15" /></div>

              <div style={{ marginTop: '14px' }}>
                <label style={label}>Equipment Needed</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {EQUIPMENT_OPTIONS.map(eq => {
                    const selected = form.equipment_needed.includes(eq.key);
                    return (
                      <div key={eq.key} onClick={() => {
                        setForm(prev => ({
                          ...prev,
                          equipment_needed: selected
                            ? prev.equipment_needed.filter(k => k !== eq.key)
                            : [...prev.equipment_needed, eq.key],
                        }));
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
              </div>

              <div style={{ marginTop: '14px' }}>
                <label style={label}>Manpower (Workers)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button type="button" onClick={() => setForm(prev => ({ ...prev, manpower_count: Math.max(1, prev.manpower_count - 1) }))} style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', fontSize: '18px', cursor: 'pointer', color: '#374151' }}>−</button>
                  <span style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', minWidth: '30px', textAlign: 'center' }}>{form.manpower_count}</span>
                  <button type="button" onClick={() => setForm(prev => ({ ...prev, manpower_count: Math.min(20, prev.manpower_count + 1) }))} style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', fontSize: '18px', cursor: 'pointer', color: '#374151' }}>+</button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep(1)} style={{ padding: '13px 24px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>← Back</button>
              <button onClick={() => { if (form.item_description) setStep(3); }} style={{ padding: '13px 32px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 3: Preferences */}
        {step === 3 && (
          <div>
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>⚙️ Delivery Preferences</h3>
              <div style={{ marginBottom: '14px' }}>
                <label style={label}>Urgency</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[{ key: 'standard', label: 'Standard', desc: 'Same day' }, { key: 'express', label: 'Express', desc: '2-4 hours' }, { key: 'urgent', label: 'Urgent', desc: 'Within 1 hour' }].map(u => (
                    <div key={u.key} onClick={() => set('urgency', u.key)} style={{
                      flex: 1, padding: '14px', borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
                      border: form.urgency === u.key ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                      background: form.urgency === u.key ? '#eff6ff' : 'white',
                    }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{u.label}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{u.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div><label style={label}>Budget Min ($)</label><input type="number" style={input} value={form.budget_min} onChange={e => set('budget_min', e.target.value)} placeholder="10" /></div>
                <div><label style={label}>Budget Max ($)</label><input type="number" style={input} value={form.budget_max} onChange={e => set('budget_max', e.target.value)} placeholder="50" /></div>
              </div>
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
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep(2)} style={{ padding: '13px 24px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>← Back</button>
              <button onClick={() => setStep(4)} style={{ padding: '13px 32px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 4: Schedule */}
        {step === 4 && (
          <div>
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>📅 Schedule</h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Choose when this delivery should be posted</p>

              {/* Schedule mode cards */}
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

              {/* Schedule Later options */}
              {form.schedule_mode === 'once' && (
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <label style={label}>Date & Time *</label>
                  <input type="datetime-local" style={input} value={form.schedule_date} onChange={e => set('schedule_date', e.target.value)} min={new Date().toISOString().slice(0, 16)} />
                </div>
              )}

              {/* Recurring options */}
              {form.schedule_mode === 'recurring' && (
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={label}>Frequency</label>
                    <select style={input} value={form.recurrence} onChange={e => { set('recurrence', e.target.value); set('recurrence_day', e.target.value === 'monthly' ? '1' : '1'); }}>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Every 2 Weeks</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  {form.recurrence === 'monthly' ? (
                    <div style={{ marginBottom: '14px' }}>
                      <label style={label}>Day of Month</label>
                      <select style={input} value={form.recurrence_day} onChange={e => set('recurrence_day', e.target.value)}>
                        {Array.from({ length: 28 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>{i + 1}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div style={{ marginBottom: '14px' }}>
                      <label style={label}>Day of Week</label>
                      <select style={input} value={form.recurrence_day} onChange={e => set('recurrence_day', e.target.value)}>
                        {DAY_NAMES.map((name, i) => (
                          <option key={i} value={i}>{name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={{ marginBottom: '14px' }}>
                    <label style={label}>Time</label>
                    <input type="time" style={input} value={form.recurrence_time} onChange={e => set('recurrence_time', e.target.value)} />
                  </div>

                  <div>
                    <label style={label}>End Date (optional)</label>
                    <input type="date" style={input} value={form.recurrence_end} onChange={e => set('recurrence_end', e.target.value)} min={new Date().toISOString().slice(0, 10)} placeholder="Leave empty for no end date" />
                    <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Leave empty to run indefinitely</p>
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep(3)} style={{ padding: '13px 24px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>← Back</button>
              <button onClick={handleSubmit} disabled={submitting} style={{ padding: '13px 32px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", opacity: submitting ? 0.7 : 1 }}>{submitting ? 'Creating...' : `${submitIcon} ${submitLabel}`}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
