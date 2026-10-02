'use client';
// Big, unmissable unit number for drivers (2 Oct 2026).
// Reads the unit out of the stored address ("Blk 2 #05-01, 1 Rochor Canal Rd").
import { extractUnit, NO_UNIT_LABEL } from '../../lib/job-rules';

export default function UnitBadge({ address, label, compact = false }) {
  if (!address) return null;
  const unit = extractUnit(address);
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '8px',
    fontWeight: 800, letterSpacing: '0.02em', lineHeight: 1.2,
    padding: compact ? '2px 8px' : '6px 12px', fontSize: compact ? '12px' : '16px',
    marginTop: compact ? 0 : '4px', marginBottom: compact ? 0 : '6px',
  };
  if (!unit) {
    return <span style={{ ...base, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>{label ? `${label} · ` : ''}No unit given — call the contact</span>;
  }
  if (unit === NO_UNIT_LABEL) {
    return <span style={{ ...base, background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}>{label ? `${label} · ` : ''}No unit · landed / whole building</span>;
  }
  return <span style={{ ...base, background: '#fef3c7', color: '#92400e', border: '1.5px solid #f59e0b' }}>{label ? `${label} · ` : ''}UNIT {unit}</span>;
}
