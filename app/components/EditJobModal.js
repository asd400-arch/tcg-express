'use client';
import { useState } from 'react';

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  border: '1px solid #e2e8f0', fontSize: '14px', fontFamily: "'Inter', sans-serif",
  color: '#1e293b', background: 'white', boxSizing: 'border-box',
};
const disabledInput = { ...inputStyle, background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed' };
const labelStyle = { fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' };

export default function EditJobModal({ job, onClose, onSaved }) {
  const prePickup = ['open', 'bidding', 'pending', 'assigned'].includes(job.status);
  const isPending = ['open', 'bidding', 'pending'].includes(job.status);

  const [form, setForm] = useState({
    pickup_address: job.pickup_address || '',
    delivery_address: job.delivery_address || '',
    pickup_contact: job.pickup_contact || '',
    pickup_phone: job.pickup_phone || '',
    pickup_instructions: job.pickup_instructions || '',
    delivery_contact: job.delivery_contact || '',
    delivery_phone: job.delivery_phone || '',
    delivery_instructions: job.delivery_instructions || '',
    item_description: job.item_description || '',
    item_weight: job.item_weight || '',
    item_dimensions: job.item_dimensions || '',
    special_requirements: job.special_requirements || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (!res.ok) { setError(result.error || 'Failed to save'); setSaving(false); return; }
      onSaved(result.data);
    } catch {
      setError('Network error');
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: '16px', width: '100%', maxWidth: '560px',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', borderRadius: '16px 16px 0 0', zIndex: 1 }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: 0 }}>Edit Job</h2>
          <div onClick={onClose} style={{ fontSize: '22px', cursor: 'pointer', color: '#64748b', lineHeight: 1 }}>✕</div>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {!prePickup && (
            <div style={{ padding: '12px 16px', background: '#fffbeb', borderRadius: '10px', marginBottom: '20px', fontSize: '13px', color: '#92400e', border: '1px solid #fde68a' }}>
              Job is in transit — only delivery phone and instructions can be edited.
            </div>
          )}

          {/* Pickup Section */}
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>Pickup</h3>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Pickup Address</label>
            <input style={prePickup ? inputStyle : disabledInput} value={form.pickup_address}
              onChange={e => set('pickup_address', e.target.value)} disabled={!prePickup} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>Contact Name</label>
              <input style={prePickup ? inputStyle : disabledInput} value={form.pickup_contact}
                onChange={e => set('pickup_contact', e.target.value)} disabled={!prePickup} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={prePickup ? inputStyle : disabledInput} value={form.pickup_phone}
                onChange={e => set('pickup_phone', e.target.value)} disabled={!prePickup} />
            </div>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Pickup Instructions</label>
            <textarea style={{ ...(prePickup ? inputStyle : disabledInput), minHeight: '60px', resize: 'vertical' }}
              value={form.pickup_instructions} onChange={e => set('pickup_instructions', e.target.value)} disabled={!prePickup} />
          </div>

          {/* Delivery Section */}
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>Delivery</h3>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Delivery Address</label>
            <input style={prePickup ? inputStyle : disabledInput} value={form.delivery_address}
              onChange={e => set('delivery_address', e.target.value)} disabled={!prePickup} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>Contact Name</label>
              <input style={prePickup ? inputStyle : disabledInput} value={form.delivery_contact}
                onChange={e => set('delivery_contact', e.target.value)} disabled={!prePickup} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} value={form.delivery_phone}
                onChange={e => set('delivery_phone', e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Delivery Instructions</label>
            <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
              value={form.delivery_instructions} onChange={e => set('delivery_instructions', e.target.value)} />
          </div>

          {/* Package Details (only when pending) */}
          {prePickup && (
            <>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>Package Details</h3>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Item Description</label>
                <input style={inputStyle} value={form.item_description}
                  onChange={e => set('item_description', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={labelStyle}>Weight (kg){!isPending && ' — locked'}</label>
                  <input style={isPending ? inputStyle : disabledInput} value={form.item_weight}
                    onChange={e => set('item_weight', e.target.value)} disabled={!isPending} />
                </div>
                <div>
                  <label style={labelStyle}>Dimensions{!isPending && ' — locked'}</label>
                  <input style={isPending ? inputStyle : disabledInput} value={form.item_dimensions}
                    onChange={e => set('item_dimensions', e.target.value)} disabled={!isPending} placeholder="e.g. 30x20x15 cm" />
                </div>
              </div>
            </>
          )}

          {/* Special Requirements */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Special Requirements / Notes</label>
            <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }}
              value={form.special_requirements} onChange={e => set('special_requirements', e.target.value)} />
          </div>

          {error && <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#dc2626', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{
              padding: '10px 24px', borderRadius: '10px', border: '1px solid #e2e8f0',
              background: 'white', color: '#64748b', fontSize: '14px', fontWeight: '600',
              cursor: 'pointer', fontFamily: "'Inter', sans-serif",
            }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{
              padding: '10px 24px', borderRadius: '10px', border: 'none',
              background: saving ? '#94a3b8' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: 'white', fontSize: '14px', fontWeight: '600',
              cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Inter', sans-serif",
            }}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
