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

const input = { width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' };

export default function DisputeModal({ jobId, onClose, onSubmitted }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handlePhotoAdd = async (e) => {
    const files = Array.from(e.target.files || []);
    if (photos.length + files.length > 5) {
      toast.error('Maximum 5 photos allowed');
      return;
    }
    setUploading(true);
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} is too large (max 10MB)`); continue; }
      const ext = file.name.split('.').pop();
      const path = `disputes/${jobId}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', path);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const result = await res.json();
        if (result.url) {
          setPhotos(prev => [...prev, result.url]);
        } else {
          toast.error(`Failed to upload ${file.name}`);
        }
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
    e.target.value = '';
  };

  const removePhoto = (idx) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    if (!reason) { toast.error('Please select a reason'); return; }
    if (!description.trim()) { toast.error('Please describe the issue'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          reason,
          description: description.trim(),
          evidence_photos: photos.length > 0 ? photos : undefined,
        }),
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
      <div style={{ background: 'white', borderRadius: '20px', padding: '30px', maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Open a Dispute</h3>
          <div onClick={onClose} style={{ cursor: 'pointer', fontSize: '20px', color: '#94a3b8' }}>✕</div>
        </div>

        <div style={{ padding: '12px 14px', background: '#fef2f2', borderRadius: '10px', marginBottom: '20px', fontSize: '13px', color: '#991b1b' }}>
          Opening a dispute will freeze the escrow and pause this job until resolved.
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Reason</label>
          <select
            value={reason}
            onChange={e => setReason(e.target.value)}
            style={{
              ...input,
              color: reason ? '#1e293b' : '#94a3b8',
              appearance: 'none', cursor: 'pointer',
            }}
          >
            <option value="" disabled>Select a reason...</option>
            {REASONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the issue in detail..."
            style={{ ...input, height: '100px', resize: 'vertical' }}
          />
        </div>

        {/* Evidence Photos */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Evidence Photos (optional, max 5)</label>
          {photos.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {photos.map((url, i) => (
                <div key={i} style={{ position: 'relative', width: '80px', height: '80px' }}>
                  <img src={url} alt={`Evidence ${i + 1}`} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                  <div
                    onClick={() => removePhoto(i)}
                    style={{
                      position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px',
                      borderRadius: '50%', background: '#ef4444', color: 'white', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer',
                      fontWeight: '700',
                    }}
                  >✕</div>
                </div>
              ))}
            </div>
          )}
          {photos.length < 5 && (
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
              borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '13px',
              cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1,
            }}>
              {uploading ? 'Uploading...' : `📷 Add Photo (${photos.length}/5)`}
              <input type="file" accept="image/*" multiple onChange={handlePhotoAdd} style={{ display: 'none' }} disabled={uploading} />
            </label>
          )}
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
            disabled={submitting || uploading || !reason || !description.trim()}
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
