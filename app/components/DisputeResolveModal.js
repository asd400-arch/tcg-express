'use client';
import { useState } from 'react';
import { useToast } from './Toast';

const input = { width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' };

export default function DisputeResolveModal({ dispute, jobAmount, onClose, onResolved }) {
  const toast = useToast();
  const [resolution, setResolution] = useState('');
  const [adjustedAmount, setAdjustedAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const total = parseFloat(jobAmount) || 0;

  const submit = async () => {
    if (!resolution) { toast.error('Select a resolution type'); return; }
    if (resolution === 'adjusted_amount') {
      const amt = parseFloat(adjustedAmount);
      if (isNaN(amt) || amt < 0 || amt > total) {
        toast.error(`Amount must be between $0 and $${total.toFixed(2)}`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/disputes/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeId: dispute.id,
          action: 'propose',
          resolution_type: resolution,
          proposed_amount: resolution === 'adjusted_amount' ? parseFloat(adjustedAmount) : undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Failed to submit proposal');
        setSubmitting(false);
        return;
      }
      toast.success('Settlement proposal sent — waiting for the other party to accept');
      if (onResolved) onResolved();
      onClose();
    } catch {
      toast.error('Failed to submit proposal');
      setSubmitting(false);
    }
  };

  const customerRefund = resolution === 'full_refund' ? total
    : resolution === 'full_release' ? 0
    : resolution === 'adjusted_amount' && adjustedAmount ? Math.max(0, total - parseFloat(adjustedAmount || 0))
    : null;
  const driverGets = resolution === 'full_refund' ? 0
    : resolution === 'full_release' ? total
    : resolution === 'adjusted_amount' && adjustedAmount ? parseFloat(adjustedAmount || 0)
    : null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '30px', maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Propose Settlement</h3>
          <div onClick={onClose} style={{ cursor: 'pointer', fontSize: '20px', color: '#94a3b8' }}>✕</div>
        </div>

        <div style={{ padding: '12px 14px', background: '#fffbeb', borderRadius: '10px', marginBottom: '20px', fontSize: '13px', color: '#92400e' }}>
          Escrow amount: <strong>${total.toFixed(2)}</strong>. Both parties must agree for settlement.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {[
            { key: 'full_refund', label: 'Full refund to customer', desc: `Customer gets $${total.toFixed(2)} back`, color: '#ef4444' },
            { key: 'full_release', label: 'Full payment to driver', desc: 'Driver receives full payout', color: '#10b981' },
            { key: 'adjusted_amount', label: 'Adjusted amount', desc: 'Agree on a custom split', color: '#3b82f6' },
          ].map(opt => (
            <label key={opt.key} onClick={() => setResolution(opt.key)} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', borderRadius: '10px',
              border: resolution === opt.key ? `2px solid ${opt.color}` : '1px solid #e2e8f0',
              background: resolution === opt.key ? `${opt.color}08` : 'white', cursor: 'pointer',
            }}>
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%',
                border: resolution === opt.key ? `6px solid ${opt.color}` : '2px solid #cbd5e1',
                flexShrink: 0, boxSizing: 'border-box',
              }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{opt.label}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>

        {resolution === 'adjusted_amount' && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Amount driver receives ($)</label>
            <input
              type="number"
              value={adjustedAmount}
              onChange={e => setAdjustedAmount(e.target.value)}
              placeholder={`0 - ${total.toFixed(2)}`}
              min="0" max={total} step="0.01"
              style={input}
            />
            {adjustedAmount && parseFloat(adjustedAmount) >= 0 && (
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                Driver gets: <strong>${parseFloat(adjustedAmount).toFixed(2)}</strong> | Customer refund: <strong>${Math.max(0, total - parseFloat(adjustedAmount)).toFixed(2)}</strong>
              </div>
            )}
          </div>
        )}

        {resolution && customerRefund !== null && (
          <div style={{ padding: '12px 14px', background: '#f0fdf4', borderRadius: '10px', marginBottom: '20px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: '#64748b' }}>Driver receives</span>
              <span style={{ color: '#059669', fontWeight: '700' }}>${(driverGets || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Customer refund</span>
              <span style={{ color: '#dc2626', fontWeight: '700' }}>${(customerRefund || 0).toFixed(2)}</span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '13px', borderRadius: '10px', border: '1px solid #e2e8f0',
            background: 'white', color: '#64748b', fontSize: '15px', fontWeight: '600',
            cursor: 'pointer', fontFamily: "'Inter', sans-serif",
          }}>Cancel</button>
          <button onClick={submit} disabled={submitting || !resolution} style={{
            flex: 1, padding: '13px', borderRadius: '10px', border: 'none',
            background: resolution ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#e2e8f0',
            color: resolution ? 'white' : '#94a3b8', fontSize: '15px', fontWeight: '600',
            cursor: resolution ? 'pointer' : 'default', fontFamily: "'Inter', sans-serif",
            opacity: submitting ? 0.7 : 1,
          }}>{submitting ? 'Submitting...' : 'Propose Settlement'}</button>
        </div>
      </div>
    </div>
  );
}
