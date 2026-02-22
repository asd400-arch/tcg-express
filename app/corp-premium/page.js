'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import Sidebar from '../components/Sidebar';
import Spinner from '../components/Spinner';
import { useToast } from '../components/Toast';
import useMobile from '../components/useMobile';
import { VEHICLE_MODES } from '../../lib/fares';

const STEPS = ['Basic Info', 'Locations', 'Vehicle & Requirements', 'Bidding Settings', 'NDA', 'Review'];

export default function CorpPremiumPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', start_date: '', end_date: '', estimated_budget: '',
    locations: [{ type: 'pickup', address: '', contact: '', phone: '' }],
    vehicle_modes: [], special_requirements: '', certifications: [],
    min_fleet_size: 1, min_rating: 4.5, nda_accepted: false,
  });

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'client') router.push('/');
  }, [user, loading]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const addLocation = (type) => {
    setForm(prev => ({ ...prev, locations: [...prev.locations, { type, address: '', contact: '', phone: '' }] }));
  };
  const removeLocation = (i) => {
    setForm(prev => ({ ...prev, locations: prev.locations.filter((_, idx) => idx !== i) }));
  };
  const updateLocation = (i, field, val) => {
    setForm(prev => {
      const locs = [...prev.locations];
      locs[i] = { ...locs[i], [field]: val };
      return { ...prev, locations: locs };
    });
  };

  const handleSubmit = async () => {
    if (!form.nda_accepted) { toast.error('Please accept the NDA before submitting'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/corp-premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (!res.ok) { toast.error(result.error || 'Failed to submit'); setSubmitting(false); return; }
      setSuccess(true);
    } catch {
      toast.error('Failed to submit request');
    }
    setSubmitting(false);
  };

  if (loading || !user) return <Spinner />;

  const card = { background: 'white', borderRadius: '14px', padding: m ? '20px' : '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '20px' };
  const input = { width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' };
  const label = { fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' };
  const btnPrimary = { padding: '13px 32px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: 'white', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" };
  const btnBack = { padding: '13px 24px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" };

  if (success) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
        <Sidebar active="New Delivery" />
        <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ ...card, maxWidth: '480px', textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏢</div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>Request Submitted!</h2>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>Your Corp Premium request is being reviewed. Qualified transport partners will be invited to bid.</p>
            <a href="/client/dashboard" style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-block' }}>Back to Dashboard</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="New Delivery" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', maxWidth: '720px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>🏢 Corp Premium Service</h1>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>Enterprise-grade delivery with dedicated fleet and NDA protection</p>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '25px' }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: '4px', borderRadius: '2px', background: step > i ? '#8b5cf6' : '#e2e8f0', marginBottom: '6px' }} />
              <span style={{ fontSize: '10px', fontWeight: '600', color: step > i ? '#8b5cf6' : '#94a3b8' }}>{s}</span>
            </div>
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div>
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>📋 Project Details</h3>
              <div style={{ marginBottom: '14px' }}><label style={label}>Project Title *</label><input style={input} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g., Monthly warehouse distribution" /></div>
              <div style={{ marginBottom: '14px' }}><label style={label}>Description</label><textarea style={{ ...input, height: '80px', resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe the project scope, frequency, and any special handling needs" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div><label style={label}>Start Date</label><input type="date" style={input} value={form.start_date} onChange={e => set('start_date', e.target.value)} /></div>
                <div><label style={label}>End Date</label><input type="date" style={input} value={form.end_date} onChange={e => set('end_date', e.target.value)} /></div>
              </div>
              <div><label style={label}>Estimated Monthly Budget ($)</label><input type="number" style={input} value={form.estimated_budget} onChange={e => set('estimated_budget', e.target.value)} placeholder="e.g., 5000" /></div>
            </div>
            <button onClick={() => { if (form.title) setStep(2); }} style={btnPrimary}>Next →</button>
          </div>
        )}

        {/* Step 2: Multi-Location */}
        {step === 2 && (
          <div>
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>📍 Locations</h3>
              {form.locations.map((loc, i) => (
                <div key={i} style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', marginBottom: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: loc.type === 'pickup' ? '#3b82f6' : '#10b981', textTransform: 'uppercase' }}>{loc.type === 'pickup' ? '📍 Pickup' : '📦 Delivery'} #{i + 1}</span>
                    {form.locations.length > 1 && <span onClick={() => removeLocation(i)} style={{ fontSize: '12px', color: '#ef4444', cursor: 'pointer', fontWeight: '600' }}>Remove</span>}
                  </div>
                  <input style={{ ...input, marginBottom: '8px' }} value={loc.address} onChange={e => updateLocation(i, 'address', e.target.value)} placeholder="Address" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <input style={input} value={loc.contact} onChange={e => updateLocation(i, 'contact', e.target.value)} placeholder="Contact name" />
                    <input style={input} value={loc.phone} onChange={e => updateLocation(i, 'phone', e.target.value)} placeholder="Phone" />
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => addLocation('pickup')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '2px dashed #3b82f6', background: 'transparent', color: '#3b82f6', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>+ Add Pickup</button>
                <button type="button" onClick={() => addLocation('delivery')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '2px dashed #10b981', background: 'transparent', color: '#10b981', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>+ Add Delivery</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep(1)} style={btnBack}>← Back</button>
              <button onClick={() => setStep(3)} style={btnPrimary}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 3: Vehicle & Requirements */}
        {step === 3 && (
          <div>
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>🚛 Vehicle Requirements</h3>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>Select all vehicle types needed for this project</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {VEHICLE_MODES.filter(v => v.key !== 'special').map(mode => {
                  const selected = form.vehicle_modes.includes(mode.key);
                  return (
                    <div key={mode.key} onClick={() => {
                      const next = selected ? form.vehicle_modes.filter(k => k !== mode.key) : [...form.vehicle_modes, mode.key];
                      set('vehicle_modes', next);
                    }} style={{
                      display: 'flex', alignItems: 'center', padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
                      border: selected ? '2px solid #8b5cf6' : '2px solid #e2e8f0',
                      background: selected ? '#f5f3ff' : 'white',
                    }}>
                      <span style={{ fontSize: '20px', marginRight: '10px' }}>{mode.icon}</span>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: selected ? '#8b5cf6' : '#1e293b', flex: 1 }}>{mode.label}</span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{mode.maxWeight}kg</span>
                    </div>
                  );
                })}
              </div>
              <div><label style={label}>Special Requirements</label><textarea style={{ ...input, height: '60px', resize: 'vertical' }} value={form.special_requirements} onChange={e => set('special_requirements', e.target.value)} placeholder="Temperature control, GPS tracking, dedicated driver, etc." /></div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep(2)} style={btnBack}>← Back</button>
              <button onClick={() => setStep(4)} style={btnPrimary}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 4: Bidding Settings */}
        {step === 4 && (
          <div>
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>⚙️ Partner Qualifications</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div><label style={label}>Min Fleet Size</label><input type="number" style={input} value={form.min_fleet_size} onChange={e => set('min_fleet_size', parseInt(e.target.value) || 1)} min="1" /></div>
                <div><label style={label}>Min Rating</label><input type="number" style={input} value={form.min_rating} onChange={e => set('min_rating', parseFloat(e.target.value) || 4.0)} min="1" max="5" step="0.1" /></div>
              </div>
              <label style={label}>Required Certifications</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {['ISO 9001', 'HACCP', 'GDP', 'Dangerous Goods', 'Cold Chain'].map(cert => {
                  const selected = form.certifications.includes(cert);
                  return (
                    <div key={cert} onClick={() => {
                      const next = selected ? form.certifications.filter(c => c !== cert) : [...form.certifications, cert];
                      set('certifications', next);
                    }} style={{
                      padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                      border: selected ? '2px solid #8b5cf6' : '2px solid #e2e8f0',
                      background: selected ? '#f5f3ff' : 'white',
                      color: selected ? '#8b5cf6' : '#64748b',
                    }}>{cert}</div>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep(3)} style={btnBack}>← Back</button>
              <button onClick={() => setStep(5)} style={btnPrimary}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 5: NDA */}
        {step === 5 && (
          <div>
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>🔒 Non-Disclosure Agreement</h3>
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', marginBottom: '16px', maxHeight: '300px', overflow: 'auto', border: '1px solid #e2e8f0', fontSize: '13px', color: '#374151', lineHeight: '1.8' }}>
                <p><strong>1. Confidentiality Obligations.</strong> TCG Express and the assigned transport partner(s) agree to treat all information related to pickup/delivery addresses, cargo descriptions, business operations, and client identity as strictly confidential.</p>
                <p><strong>2. Non-Disclosure.</strong> No party shall disclose, publish, or disseminate any confidential information to any third party without prior written consent.</p>
                <p><strong>3. Data Protection.</strong> All route data, customer data, and delivery logs are stored in compliance with PDPA (Personal Data Protection Act) and may not be exported, shared, or repurposed.</p>
                <p><strong>4. Duration.</strong> This NDA remains in effect for the duration of the contract and 2 years thereafter.</p>
                <p><strong>5. Breach.</strong> Any breach of this NDA may result in immediate contract termination and legal proceedings.</p>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: '#1e293b' }}>
                <input type="checkbox" checked={form.nda_accepted} onChange={e => set('nda_accepted', e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#8b5cf6' }} />
                <span>I have read and agree to the Non-Disclosure Agreement on behalf of my company.</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep(4)} style={btnBack}>← Back</button>
              <button onClick={() => setStep(6)} style={btnPrimary}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 6: Review */}
        {step === 6 && (
          <div>
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>📋 Review Your Request</h3>
              <div style={{ fontSize: '14px', color: '#374151' }}>
                <div style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}><span style={{ fontWeight: '600' }}>Project:</span> {form.title}</div>
                <div style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}><span style={{ fontWeight: '600' }}>Period:</span> {form.start_date || 'TBD'} to {form.end_date || 'TBD'}</div>
                <div style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}><span style={{ fontWeight: '600' }}>Budget:</span> ${form.estimated_budget || 'TBD'}/month</div>
                <div style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}><span style={{ fontWeight: '600' }}>Locations:</span> {form.locations.filter(l => l.type === 'pickup').length} pickups, {form.locations.filter(l => l.type === 'delivery').length} deliveries</div>
                <div style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}><span style={{ fontWeight: '600' }}>Vehicles:</span> {form.vehicle_modes.map(k => VEHICLE_MODES.find(v => v.key === k)?.label).join(', ') || 'None selected'}</div>
                <div style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}><span style={{ fontWeight: '600' }}>Min Rating:</span> {form.min_rating}/5</div>
                <div style={{ padding: '10px 0' }}><span style={{ fontWeight: '600' }}>NDA:</span> <span style={{ color: form.nda_accepted ? '#16a34a' : '#ef4444' }}>{form.nda_accepted ? 'Accepted' : 'Not accepted'}</span></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep(5)} style={btnBack}>← Back</button>
              <button onClick={handleSubmit} disabled={submitting || !form.nda_accepted} style={{ ...btnPrimary, opacity: submitting || !form.nda_accepted ? 0.6 : 1 }}>
                {submitting ? 'Submitting...' : '🏢 Submit Request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
