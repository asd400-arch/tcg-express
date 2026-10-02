'use client';
import { getRouteLabel, formatPickupTime, formatBudgetRange, getCountdown, getVehicleLabel, getJobBudget, isQuoteJob, isCrossBorder, crossBorderCity } from '../../lib/job-helpers';
import useLocale from './useLocale';
import UnitBadge from './UnitBadge';
import { jobPool } from '../../lib/driver-pool-rules';
import { formatCurrency } from '../../lib/locale/config';
import { getLaunchTopup } from '../../lib/fares';

function getJobBadge(job) {
  // Cross-border (Malaysia) runs first — the driver must be verified for these
  if (isCrossBorder(job)) {
    return { text: `CROSS-BORDER · ${crossBorderCity(job)}`, icon: '🇲🇾', bg: '#fefce8', fg: '#a16207', border: '#fde68a' };
  }
  // SaveMode takes priority
  if (job.delivery_mode === 'save_mode' && job.save_mode_window) {
    return { text: `${job.save_mode_window}H SAVE`, icon: '⏰', bg: '#f5f3ff', fg: '#7c3aed', border: '#ddd6fe' };
  }
  // Job type badges
  if (job.job_type === 'scheduled') return { text: 'SCHEDULED', icon: '📅', bg: '#eff6ff', fg: '#2563eb', border: '#bfdbfe' };
  if (job.job_type === 'recurring') return { text: 'RECURRING', icon: '🔄', bg: '#f0fdf4', fg: '#059669', border: '#bbf7d0' };
  // Urgency badges for spot/express
  if (job.urgency === 'urgent') return { text: 'URGENT', icon: '🔥', bg: '#fef2f2', fg: '#dc2626', border: '#fecaca' };
  if (job.urgency === 'express') return { text: 'EXPRESS', icon: '⚡', bg: '#fff7ed', fg: '#ea580c', border: '#fed7aa' };
  return { text: 'STANDARD', icon: '🚚', bg: '#f8fafc', fg: '#64748b', border: '#e2e8f0' };
}

/**
 * Shared job card for driver-facing views (dashboard + available jobs).
 */
export default function JobCard({ job, myBid, accepting, onClick, onAccept, onBid, onReBid, linkMode, linkHref, driverVehicle }) {
  const { locale } = useLocale();
  // TCG launch bonus paid on top of the fare (by the job's vehicle, else the driver's own)
  const launchBonus = getLaunchTopup(job.vehicle_required && job.vehicle_required !== 'any' ? job.vehicle_required : driverVehicle);
  const pickupCountdown = getCountdown(job.pickup_by);
  const deliverCountdown = getCountdown(job.deliver_by);
  const vLabel = getVehicleLabel(job.vehicle_required);
  const budget = getJobBudget(job);
  const isQuote = isQuoteJob(job);
  const badge = getJobBadge(job);

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

  const countdownPill = (cd) => cd ? (
    <span style={{
      padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700',
      background: cd === 'Overdue' || cd === 'Now' ? '#fef2f2' : '#fef3c7',
      color: cd === 'Overdue' || cd === 'Now' ? '#dc2626' : '#92400e',
    }}>
      {cd === 'Overdue' ? 'OVERDUE' : cd === 'Now' ? 'NOW' : `in ${cd}`}
    </span>
  ) : null;

  const content = (
    <>
      {/* Row 1: Badge + Vehicle + Weight | Amount */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '3px',
            padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700',
            background: badge.bg, color: badge.fg, border: `1px solid ${badge.border}`,
            textTransform: 'uppercase', letterSpacing: '0.3px',
          }}>{badge.icon} {badge.text}</span>
          {vLabel && <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{vLabel}</span>}
          {job.item_weight && <span style={{ fontSize: '13px', color: '#475569', fontWeight: '600' }}>{job.item_weight} kg</span>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '10px' }}>
          <div style={{ fontSize: '18px', fontWeight: '800', color: '#10b981' }}>{formatBudgetRange(job, locale)}</div>
          <div style={{ fontSize: '10px', fontWeight: '700', color: isQuote ? '#7c3aed' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{isQuote ? 'Send a quote' : 'Fixed price'}</div>
          {launchBonus > 0 && (
            <div style={{ display: 'inline-block', marginTop: '2px', padding: '1px 8px', borderRadius: '10px', background: '#ecfdf5', color: '#047857', fontSize: '11px', fontWeight: '700', border: '1px solid #a7f3d0' }}>
              +{formatCurrency(launchBonus, locale)} TCG bonus
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Pickup time + Deliver time */}
      <div style={{ marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <span style={{ fontSize: '13px', color: '#3b82f6' }}>📦 Pickup: {formatPickupTime(job.pickup_by) || 'ASAP'}</span>
          {pickupCountdown && countdownPill(pickupCountdown)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#10b981' }}>🏠 Deliver: {job.deliver_by ? formatPickupTime(job.deliver_by) : 'Flexible'}</span>
          {job.deliver_by && deliverCountdown && countdownPill(deliverCountdown)}
        </div>
      </div>

      {/* Row 3: Area -> Area + distance + item description */}
      <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
        {getRouteLabel(job)}
        {job.distance_km ? <span style={{ color: '#94a3b8', marginLeft: '8px' }}>{parseFloat(job.distance_km).toFixed(1)} km</span> : ''}
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
        {jobPool(job) === 'direct' && <span style={{ fontSize: '12px', fontWeight: 800, padding: '2px 8px', borderRadius: '8px', background: '#dcfce7', color: '#166534', border: '1px solid #86efac' }}>📌 Booked for you</span>}
        {job._trip_drops > 1 && <span style={{ fontSize: '12px', fontWeight: 800, padding: '2px 8px', borderRadius: '8px', background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>🧭 Trip · {job._trip_drops} drops — accept once, all are yours</span>}
        {jobPool(job) === 'tcg' && <span style={{ fontSize: '12px', fontWeight: 800, padding: '2px 8px', borderRadius: '8px', background: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd' }}>TCG fleet job</span>}
        <UnitBadge compact label="Pickup" address={job.pickup_address} />
        {!isCrossBorder(job) && <UnitBadge compact label="Drop" address={job.delivery_address} />}
      </div>
      {isCrossBorder(job) && (
        <div style={{ fontSize: '12px', color: '#a16207', marginBottom: '4px' }}>
          \ud83d\udec2 {job.cross_border_details?.customs_agent === 'own' ? "Customs by the customer's agent" : "Customs by TCG's declaring agent"} \u00b7 quote the full run (fuel, tolls, road charge, levy)
        </div>
      )}
      {job.item_description && (
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          📋 {job.item_description}
        </div>
      )}

      {/* Row 4: Job ID + buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={e => { if (!linkMode) e.stopPropagation(); }}>
        <span style={{ fontSize: '11px', color: '#b0b8c4' }}>{job.job_number || '\u2014'}</span>
        {!isQuote ? (
          myBid?.status === 'rejected' ? (
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8' }}>Not available to you</span>
          ) : onAccept ? (
            <button onClick={e => { e.preventDefault(); e.stopPropagation(); onAccept(job); }} disabled={accepting === job.id || !budget} style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", opacity: accepting === job.id ? 0.7 : 1 }}>
              {accepting === job.id ? '...' : `Accept ${budget ? formatCurrency(budget, locale) : ''}`}
            </button>
          ) : (
            <span style={{ padding: '6px 14px', borderRadius: '8px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '12px', fontWeight: '600' }}>Accept {budget ? formatCurrency(budget, locale) : ''}</span>
          )
        ) : myBid ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: myBid.status === 'accepted' ? '#10b981' : myBid.status === 'rejected' ? '#ef4444' : '#f59e0b' }}>
              Quote {formatCurrency(myBid.amount, locale)} ({myBid.status === 'outbid' ? 'not selected' : myBid.status})
            </span>
            {['rejected', 'outbid'].includes(myBid.status) && onReBid && (
              <button onClick={e => { e.preventDefault(); e.stopPropagation(); onReBid(job); }} style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid #f59e0b', background: 'white', color: '#f59e0b', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>New quote</button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            {onBid ? (
              <button onClick={e => { e.preventDefault(); e.stopPropagation(); onBid(job); }} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #7c3aed', background: 'white', color: '#7c3aed', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Send quote</button>
            ) : (
              <span style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #7c3aed', background: 'white', color: '#7c3aed', fontSize: '12px', fontWeight: '600' }}>Send quote</span>
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
