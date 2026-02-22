'use client';
import { LIABILITY_CAPS } from '../../lib/terms-content';

export default function LiabilityCapModal({ onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '30px', maxWidth: '540px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0 }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Driver Liability Cap Table</h3>
          <div onClick={onClose} style={{ cursor: 'pointer', fontSize: '20px', color: '#94a3b8' }}>&#10005;</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
            <p style={{ fontSize: '13px', color: '#991b1b', lineHeight: '1.6', margin: 0, fontWeight: '500' }}>
              By accepting delivery jobs, you acknowledge liability for goods in your care up to the maximum amount listed below for your vehicle type.
            </p>
          </div>

          <div style={{ borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{ display: 'flex', background: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ flex: 2, fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vehicle Type</div>
              <div style={{ flex: 1, fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Max Liability</div>
            </div>
            {/* Table rows */}
            {LIABILITY_CAPS.map((row, i) => (
              <div key={row.vehicle} style={{
                display: 'flex', alignItems: 'center', padding: '12px 16px',
                borderBottom: i < LIABILITY_CAPS.length - 1 ? '1px solid #f1f5f9' : 'none',
                background: i % 2 === 0 ? 'white' : '#fafafa',
              }}>
                <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px' }}>{row.icon}</span>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>{row.vehicle}</span>
                </div>
                <div style={{ flex: 1, textAlign: 'right', fontSize: '15px', fontWeight: '700', color: '#dc2626' }}>
                  ${row.cap.toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '16px', padding: '14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px' }}>
            <p style={{ fontSize: '13px', color: '#92400e', lineHeight: '1.6', margin: 0 }}>
              <strong>Insurance Recommendation:</strong> Drivers are strongly encouraged to maintain commercial goods-in-transit insurance that covers at least the liability cap for their vehicle type.
            </p>
          </div>

          <div style={{ marginTop: '12px', padding: '14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px' }}>
            <p style={{ fontSize: '13px', color: '#0c4a6e', lineHeight: '1.6', margin: 0 }}>
              <strong>How it works:</strong> If goods are lost or damaged during delivery, the maximum amount deductible from your earnings or wallet is capped at the amount shown for your registered vehicle type. Claims exceeding the cap are covered by the platform's insurance.
            </p>
          </div>
        </div>

        <div style={{ flexShrink: 0, paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
          <button onClick={onClose} style={{
            width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white',
            fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
          }}>I Understand</button>
        </div>
      </div>
    </div>
  );
}
