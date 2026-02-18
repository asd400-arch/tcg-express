'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthContext';
import Sidebar from '../../../components/Sidebar';
import { useToast } from '../../../components/Toast';
import { supabase } from '../../../../lib/supabase';
import useMobile from '../../../components/useMobile';

export default function NewJob() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [form, setForm] = useState({
    pickup_address: '', pickup_contact: '', pickup_phone: '', pickup_instructions: '',
    delivery_address: '', delivery_contact: '', delivery_phone: '', delivery_instructions: '',
    item_description: '', item_category: 'general', item_weight: '', item_dimensions: '',
    urgency: 'standard', budget_min: '', budget_max: '', vehicle_required: 'any', special_requirements: '',
    pickup_by: '', deliver_by: '',
  });

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'client') router.push('/');
  }, [user, loading]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const input = { width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' };
  const label = { fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' };
  const card = { background: 'white', borderRadius: '14px', padding: m ? '20px' : '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '20px' };

  const handleSubmit = async () => {
    if (!form.pickup_address || !form.delivery_address || !form.item_description) return;
    setSubmitting(true);
    const { data, error } = await supabase.from('express_jobs').insert([{
      client_id: user.id,
      ...form,
      budget_min: parseFloat(form.budget_min) || null,
      budget_max: parseFloat(form.budget_max) || null,
      item_weight: parseFloat(form.item_weight) || null,
      pickup_by: form.pickup_by || null,
      deliver_by: form.deliver_by || null,
      status: 'open',
    }]).select().single();
    setSubmitting(false);
    if (error) { toast.error('Error: ' + error.message); return; }
    setSuccess(data);
  };

  if (loading || !user) return null;

  if (success) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
        <Sidebar active="New Job" />
        <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ ...card, maxWidth: '480px', textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>Job Posted!</h2>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '6px' }}>Job #{success.job_number}</p>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>Drivers will start bidding shortly. You'll be notified when bids come in.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <a href="/client/jobs" style={{ padding: '12px 24px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>View My Jobs</a>
              <a href="/client/jobs/new" onClick={() => { setSuccess(null); setStep(1); setForm({ pickup_address: '', pickup_contact: '', pickup_phone: '', pickup_instructions: '', delivery_address: '', delivery_contact: '', delivery_phone: '', delivery_instructions: '', item_description: '', item_category: 'general', item_weight: '', item_dimensions: '', urgency: 'standard', budget_min: '', budget_max: '', vehicle_required: 'any', special_requirements: '', pickup_by: '', deliver_by: '' }); }} style={{ padding: '12px 24px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#374151', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>Post Another</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const steps = ['Pickup & Delivery', 'Item Details', 'Preferences'];

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
                  <select style={input} value={form.item_category} onChange={e => set('item_category', e.target.value)}>
                    <option value="general">General</option>
                    <option value="documents">Documents</option>
                    <option value="electronics">Electronics</option>
                    <option value="fragile">Fragile</option>
                    <option value="food">Food/Perishable</option>
                    <option value="heavy">Heavy/Bulky</option>
                  </select>
                </div>
                <div><label style={label}>Weight (kg)</label><input type="number" style={input} value={form.item_weight} onChange={e => set('item_weight', e.target.value)} placeholder="0.0" /></div>
              </div>
              <div><label style={label}>Dimensions (L x W x H cm)</label><input style={input} value={form.item_dimensions} onChange={e => set('item_dimensions', e.target.value)} placeholder="30 x 20 x 15" /></div>
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
              <button onClick={handleSubmit} disabled={submitting} style={{ padding: '13px 32px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", opacity: submitting ? 0.7 : 1 }}>{submitting ? 'Posting...' : '✅ Post Job'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
