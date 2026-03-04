'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { VEHICLE_MODES } from '../../lib/fares';
import { toLocalDatetime } from '../../lib/job-helpers';

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  border: '1px solid #e2e8f0', fontSize: '14px', fontFamily: "'Inter', sans-serif",
  color: '#1e293b', background: 'white', boxSizing: 'border-box',
};
const disabledInput = { ...inputStyle, background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed' };
const labelStyle = { fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' };

function getVehicleLabel(key) {
  const v = VEHICLE_MODES.find(m => m.key === key);
  return v ? `${v.icon} ${v.label}` : key || '—';
}

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
    pickup_by: job.pickup_by ? toLocalDatetime(job.pickup_by) : '',
    deliver_by: job.deliver_by ? toLocalDatetime(job.deliver_by) : '',
    item_description: job.item_description || '',
    item_weight: job.item_weight || '',
    item_dimensions: job.item_dimensions || '',
    special_requirements: job.special_requirements || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [farePreview, setFarePreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const debounceRef = useRef(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Debounced fare preview when weight/dimensions change
  const fetchFarePreview = useCallback(async (weight, dimensions) => {
    if (!isPending) return;
    // Only fetch if weight or dimensions actually differ from original
    const weightChanged = String(weight || '') !== String(job.item_weight || '');
    const dimsChanged = String(dimensions || '') !== String(job.item_dimensions || '');
    if (!weightChanged && !dimsChanged) { setFarePreview(null); return; }

    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _preview: true, item_weight: weight, item_dimensions: dimensions }),
      });
      const data = await res.json();
      if (data.preview) setFarePreview(data);
      else setFarePreview(null);
    } catch {
      setFarePreview(null);
    }
    setLoadingPreview(false);
  }, [job.id, job.item_weight, job.item_dimensions, isPending]);

  // Trigger preview on weight/dimensions change
  useEffect(() => {
    if (!isPending) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchFarePreview(form.item_weight, form.item_dimensions);
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [form.item_weight, form.item_dimensions, fetchFarePreview, isPending]);

  const handleSave = async () => {
    // If fare changed and user hasn't confirmed yet, show confirmation step
    if (farePreview && (farePreview.fareChanged || farePreview.vehicleChanged) && !confirmStep) {
      setConfirmStep(true);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = { ...form };
      if (payload.pickup_by) payload.pickup_by = new Date(payload.pickup_by).toISOString();
      else payload.pickup_by = null;
      if (payload.deliver_by) payload.deliver_by = new Date(payload.deliver_by).toISOString();
      else payload.deliver_by = null;
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) { setError(result.error || 'Failed to save'); setSaving(false); setConfirmStep(false); return; }
      onSaved(result.data, result);
    } catch {
      setError('Network error');
      setSaving(false);
      setConfirmStep(false);
    }
  };

  const fareDiff = farePreview ? (farePreview.newFare - farePreview.oldFare) : 0;

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

          {/* Confirmation Step */}
          {confirmStep && farePreview && (
            <div style={{ padding: '16px', background: '#fffbeb', borderRadius: '12px', marginBottom: '20px', border: '1px solid #fde68a' }}>
              <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#92400e', marginBottom: '12px' }}>Confirm Fare Changes</h4>

              {farePreview.vehicleChanged && (
                <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#dc2626', marginBottom: '4px' }}>Vehicle type change required</div>
                  <div style={{ fontSize: '13px', color: '#7f1d1d' }}>
                    {getVehicleLabel(farePreview.oldVehicle)} → {getVehicleLabel(farePreview.newVehicle)}
                  </div>
                  {job.assigned_driver_id && (
                    <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '6px', fontWeight: '600' }}>
                      The current driver will be unassigned and the job will be re-opened for bidding.
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ textAlign: 'center', padding: '10px', background: '#f1f5f9', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Current Fare</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#64748b' }}>${farePreview.oldFare.toFixed(2)}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Budget: ${farePreview.oldBudgetMin}–${farePreview.oldBudgetMax}</div>
                </div>
                <div style={{ fontSize: '20px', color: '#94a3b8' }}>→</div>
                <div style={{ textAlign: 'center', padding: '10px', background: fareDiff > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>New Fare</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: fareDiff > 0 ? '#dc2626' : '#059669' }}>${farePreview.newFare.toFixed(2)}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Budget: ${farePreview.newBudgetMin}–${farePreview.newBudgetMax}</div>
                </div>
              </div>

              {Math.abs(fareDiff) > 0.01 && (
                <div style={{ fontSize: '13px', color: fareDiff > 0 ? '#dc2626' : '#059669', fontWeight: '600', textAlign: 'center', marginBottom: '8px' }}>
                  {fareDiff > 0
                    ? `+$${fareDiff.toFixed(2)} will be charged from your wallet`
                    : `$${Math.abs(fareDiff).toFixed(2)} will be refunded to your wallet`
                  }
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button onClick={() => setConfirmStep(false)} style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0',
                  background: 'white', color: '#64748b', fontSize: '13px', fontWeight: '600',
                  cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                }}>Go Back</button>
                <button onClick={handleSave} disabled={saving} style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                  background: saving ? '#94a3b8' : fareDiff > 0 ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white', fontSize: '13px', fontWeight: '600',
                  cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Inter', sans-serif",
                }}>{saving ? 'Saving...' : 'Confirm & Save'}</button>
              </div>
            </div>
          )}

          {!confirmStep && (
            <>
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
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Pickup By</label>
                <input type="datetime-local" style={prePickup ? inputStyle : disabledInput} value={form.pickup_by}
                  onChange={e => set('pickup_by', e.target.value)} disabled={!prePickup} />
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
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Deliver By</label>
                <input type="datetime-local" style={prePickup ? inputStyle : disabledInput} value={form.deliver_by}
                  onChange={e => set('deliver_by', e.target.value)} disabled={!prePickup} />
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
                      <label style={labelStyle}>Dimensions (LxWxH cm){!isPending && ' — locked'}</label>
                      <input style={isPending ? inputStyle : disabledInput} value={form.item_dimensions}
                        onChange={e => set('item_dimensions', e.target.value)} disabled={!isPending} placeholder="e.g. 30x20x15" />
                    </div>
                  </div>
                </>
              )}

              {/* Fare Preview Banner */}
              {isPending && farePreview && (farePreview.fareChanged || farePreview.vehicleChanged) && (
                <div style={{ padding: '14px 16px', borderRadius: '10px', marginBottom: '16px', border: '1px solid', borderColor: farePreview.vehicleChanged ? '#fecaca' : fareDiff > 0 ? '#fed7aa' : '#bbf7d0', background: farePreview.vehicleChanged ? '#fef2f2' : fareDiff > 0 ? '#fff7ed' : '#f0fdf4' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: farePreview.vehicleChanged ? '#dc2626' : fareDiff > 0 ? '#c2410c' : '#15803d', marginBottom: '6px' }}>
                    {farePreview.vehicleChanged ? 'Vehicle type will change' : 'Fare will change'}
                  </div>
                  {farePreview.vehicleChanged && (
                    <div style={{ fontSize: '13px', color: '#7f1d1d', marginBottom: '4px' }}>
                      {getVehicleLabel(farePreview.oldVehicle)} → {getVehicleLabel(farePreview.newVehicle)}
                      {job.assigned_driver_id && ' (driver will be unassigned)'}
                    </div>
                  )}
                  {farePreview.fareChanged && (
                    <div style={{ fontSize: '13px', color: '#374151' }}>
                      ${farePreview.oldFare.toFixed(2)} → ${farePreview.newFare.toFixed(2)}
                      <span style={{ fontWeight: '600', color: fareDiff > 0 ? '#dc2626' : '#059669', marginLeft: '6px' }}>
                        ({fareDiff > 0 ? '+' : ''}${fareDiff.toFixed(2)})
                      </span>
                    </div>
                  )}
                </div>
              )}
              {isPending && loadingPreview && (
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>Calculating fare...</div>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
