'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from './Toast';

export default function RatingModal({ jobId, clientId, driverId, reviewerRole = 'client', onClose, onSubmitted }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isDriverReview = reviewerRole === 'driver';
  const title = isDriverReview ? 'Rate Your Client' : 'Rate Your Driver';
  const placeholder = isDriverReview ? 'How was your experience with this client?' : 'How was your delivery experience?';

  const submit = async () => {
    if (rating === 0) { toast.error('Please select a rating'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('express_reviews').insert([{
      job_id: jobId, client_id: clientId, driver_id: driverId,
      rating, review_text: reviewText || null, reviewer_role: reviewerRole,
    }]);
    if (error) {
      toast.error('Error submitting review');
      setSubmitting(false);
      return;
    }
    // Update average rating
    await fetch('/api/reviews/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId, clientId, reviewerRole }),
    });
    toast.success('Review submitted!');
    setSubmitting(false);
    if (onSubmitted) onSubmitted();
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '30px', maxWidth: '420px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>{title}</h3>
          <div onClick={onClose} style={{ cursor: 'pointer', fontSize: '20px', color: '#94a3b8' }}>&#10005;</div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
            {[1, 2, 3, 4, 5].map(star => (
              <span
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                style={{
                  fontSize: '36px', cursor: 'pointer', transition: 'transform 0.15s',
                  transform: (hover || rating) >= star ? 'scale(1.1)' : 'scale(1)',
                  color: (hover || rating) >= star ? '#f59e0b' : '#e2e8f0',
                }}
              >&#9733;</span>
            ))}
          </div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            {rating === 0 ? 'Tap a star to rate' : `${rating} star${rating > 1 ? 's' : ''}`}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Review (optional)</label>
          <textarea
            value={reviewText}
            onChange={e => setReviewText(e.target.value)}
            placeholder={placeholder}
            style={{
              width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px',
              background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b',
              outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box',
              height: '80px', resize: 'vertical',
            }}
          />
        </div>

        <button
          onClick={submit}
          disabled={submitting || rating === 0}
          style={{
            width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
            background: rating > 0 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#e2e8f0',
            color: rating > 0 ? 'white' : '#94a3b8', fontSize: '15px', fontWeight: '600',
            cursor: rating > 0 ? 'pointer' : 'default', fontFamily: "'Inter', sans-serif",
            opacity: submitting ? 0.7 : 1,
          }}
        >{submitting ? 'Submitting...' : 'Submit Review'}</button>
      </div>
    </div>
  );
}
