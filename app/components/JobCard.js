'use client';
import { getAreaName, formatPickupTime, formatBudgetRange, getCountdown, getVehicleLabel, getJobBudget } from '../../lib/job-helpers';

const urgencyColor = { standard: '#64748b', express: '#f59e0b', urgent: '#ef4444' };
const badge = (text, bg, fg) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', background: bg, color: fg, textTransform: 'uppercase', letterSpacing: '0.3px' });

/**
 * Shared job card for driver-facing views (dashboard + available jobs).
 *
 * Props:
 *  - job: express_jobs row
 *  - myBid: express_bids row (or null)
 *  - accepting: job id currently being accepted (or null)
 *  - onClick: card click handler (e.g. open detail or navigate)
 *  - onAccept: (job) => void
 *  - onBid: (job) => void
 *  - onReBid: (job) => void
 *  - linkMode: if true, renders as <a> instead of <div> (for dashboard preview)
 *  - linkHref: href for link mode
 */
export default function JobCard({ job, myBid, accepting, onClick, onAccept, onBid, onReBid, linkMode, linkHref }) {
  const countdown = getCountdown(job.pickup_by);
  const vLabel = getVehicleLabel(job.vehicle_required);
  const budget = getJobBudget(job);

  const cardStyle = {
    display: 'block',
    padding: '16px 20px',
    borderRadius: '14px',
    border: '1px solid #f1f5f9',
    background: 'white',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'box-shadow 0.15s',
  };

  const content = (
    <>
      {/* Row 1: Vehicle + Weight + Urgency badge + Amount */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
          {vLabel && <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{vLabel}</span>}
          {job.item_weight && <span style={{ fontSize: '13px', color: '#475569', fontWeight: '600' }}>{job.item_weight} kg</span>}
          {!vLabel && !job.item_weight && <span style={{ fontSize: '13px', color: '#94a3b8' }}>{'\u2014'}</span>}
          <span style={badge(job.urgency || 'standard', `${urgencyColor[job.urgency] || '#64748b'}15`, urgencyColor[job.urgency] || '#64748b')}>{job.urgency || 'standard'}</span>
        </div>
        <div style={{ fontSize: '18px', fontWeight: '800', color: '#10b981', flexShrink: 0, marginLeft: '10px' }}>{formatBudgetRange(job)}</div>
      </div>

      {/* Row 2: Date/Time + Countdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', color: '#64748b' }}>
          {'\uD83D\uDCC5'} {formatPickupTime(job.pickup_by || job.created_at)}
        </span>
        {countdown && (
          <span style={{
            padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700',
            background: countdown === 'Overdue' ? '#fef2f2' : countdown === 'Now' ? '#fef2f2' : '#fef3c7',
            color: countdown === 'Overdue' ? '#dc2626' : countdown === 'Now' ? '#dc2626' : '#92400e',
          }}>
            {countdown === 'Overdue' ? 'OVERDUE' : countdown === 'Now' ? 'ASAP' : `in ${countdown}`}
          </span>
        )}
      </div>

      {/* Row 3: Area -> Area + distance */}
      <div style={{ fontSize: '13px', color: '#374151', marginBottom: '8px' }}>
        {getAreaName(job.pickup_address)} {'\u2192'} {getAreaName(job.delivery_address)}
        {job.distance_km ? <span style={{ color: '#94a3b8', marginLeft: '8px' }}>{parseFloat(job.distance_km).toFixed(1)} km</span> : ''}
      </div>

      {/* Row 4: Job ID (small, grey) + buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={e => { if (!linkMode) e.stopPropagation(); }}>
        <span style={{ fontSize: '11px', color: '#b0b8c4' }}>{job.job_number || '\u2014'}</span>
        {myBid ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: myBid.status === 'accepted' ? '#10b981' : myBid.status === 'rejected' ? '#ef4444' : '#f59e0b' }}>
              ${myBid.amount} ({myBid.status === 'outbid' ? 'not selected' : myBid.status})
            </span>
            {['rejected', 'outbid'].includes(myBid.status) && onReBid && (
              <button onClick={e => { e.preventDefault(); e.stopPropagation(); onReBid(job); }} style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid #f59e0b', background: 'white', color: '#f59e0b', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Re-bid</button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            {budget && onAccept && (
              <button onClick={e => { e.preventDefault(); e.stopPropagation(); onAccept(job); }} disabled={accepting === job.id} style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", opacity: accepting === job.id ? 0.7 : 1 }}>
                {accepting === job.id ? '...' : `Accept $${budget.toFixed(2)}`}
              </button>
            )}
            {!onAccept && budget && (
              <span style={{ padding: '6px 14px', borderRadius: '8px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '12px', fontWeight: '600' }}>Accept ${budget.toFixed(2)}</span>
            )}
            {onBid ? (
              <button onClick={e => { e.preventDefault(); e.stopPropagation(); onBid(job); }} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #3b82f6', background: 'white', color: '#3b82f6', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>{budget ? 'Bid' : 'Place Bid'}</button>
            ) : (
              <span style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #3b82f6', background: 'white', color: '#3b82f6', fontSize: '12px', fontWeight: '600' }}>{budget ? 'Bid' : 'Place Bid'}</span>
            )}
          </div>
        )}
      </div>
    </>
  );

  if (linkMode) {
    return <a href={linkHref || '/driver/jobs'} style={cardStyle}>{content}</a>;
  }

  return <div onClick={onClick} style={cardStyle}>{content}</div>;
}
