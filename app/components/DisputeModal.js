'use client';
import { useState } from 'react';
import { useToast } from './Toast';

const REASONS = [
  { value: 'damaged_item', label: 'Damaged Item' },
  { value: 'wrong_delivery', label: 'Wrong Delivery' },
  { value: 'late_delivery', label: 'Late Delivery' },
  { value: 'wrong_address', label: 'Wrong Address' },
  { value: 'item_not_as_described', label: 'Item Not as Described' },
  { value: 'driver_no_show', label: 'Driver No-Show' },
  { value: 'other', label: 'Other' },
];

export default function DisputeModal({ jobId, onClose, onSubmitted }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason) { toast.error('Please select a reason'); return; }
    if (!description.trim()) { toast.error('Please describe the issue'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, reason, description: description.trim() }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Failed to open dispute');
        setSubmitting(false);
        return;
      }
      toast.success('Dispute opened successfully');
      if (onSubmitted) onSubmitted();
      onClose();
    } catch (e) {
      toast.error('Failed to open dispute');
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '30px', maxWidth: '480px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Open a Dispute</h3>
          <div onClick={onClose} style={{ cursor: 'pointer', fontSize: '20px', color: '#94a3b8' }}>✕</div>
        </div>

        <div style={{ padding: '12px 14px', background: '#fef2f2', borderRadius: '10px', marginBottom: '20px', fontSize: '13px', color: '#991b1b' }}>
          Opening a dispute will freeze the escrow and pause this job until an admin resolves it.
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Reason</label>
          <select
            value={reason}
            onChange={e => setReason(e.target.value)}
            style={{
              width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px',
              background: '#f8fafc', border: '1px solid #e2e8f0', color: reason ? '#1e293b' : '#94a3b8',
              outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box',
              appearance: 'none', cursor: 'pointer',
            }}
          >
            <option value="" disabled>Select a reason...</option>
            {REASONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the issue in detail..."
            style={{
              width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px',
              background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b',
              outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box',
              height: '100px', resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '13px', borderRadius: '10px', border: '1px solid #e2e8f0',
              background: 'white', color: '#64748b', fontSize: '15px', fontWeight: '600',
              cursor: 'pointer', fontFamily: "'Inter', sans-serif",
            }}
          >Cancel</button>
          <button
            onClick={submit}
            disabled={submitting || !reason || !description.trim()}
            style={{
              flex: 1, padding: '13px', borderRadius: '10px', border: 'none',
              background: reason && description.trim() ? 'linear-gradient(135deg, #e11d48, #be123c)' : '#e2e8f0',
              color: reason && description.trim() ? 'white' : '#94a3b8',
              fontSize: '15px', fontWeight: '600',
              cursor: reason && description.trim() ? 'pointer' : 'default',
              fontFamily: "'Inter', sans-serif",
              opacity: submitting ? 0.7 : 1,
            }}
          >{submitting ? 'Submitting...' : 'Open Dispute'}</button>
        </div>
      </div>
    </div>
  );
}
