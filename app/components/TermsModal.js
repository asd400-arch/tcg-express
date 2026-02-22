'use client';
import { TERMS_SECTIONS } from '../../lib/terms-content';

export default function TermsModal({ onClose, highlightSection }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '30px', maxWidth: '640px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0 }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Terms of Service</h3>
          <div onClick={onClose} style={{ cursor: 'pointer', fontSize: '20px', color: '#94a3b8' }}>&#10005;</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>Last updated: 19 February 2026</p>
          <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.8', marginBottom: '16px' }}>
            Welcome to TCG Express ("Platform"), operated by Tech Chain Global Pte Ltd ("Company", "we", "us"). By accessing or using our Platform, you agree to be bound by these Terms of Service ("Terms").
          </p>
          {TERMS_SECTIONS.map(section => {
            const isHighlighted = highlightSection === section.number;
            return (
              <div key={section.number} id={`section-${section.number}`} style={{
                marginBottom: '16px',
                padding: isHighlighted ? '16px' : '0',
                borderRadius: isHighlighted ? '10px' : '0',
                background: isHighlighted ? '#fef2f2' : 'transparent',
                border: isHighlighted ? '2px solid #ef4444' : 'none',
              }}>
                <h2 style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: isHighlighted ? '#dc2626' : '#1e293b',
                  marginBottom: '8px',
                }}>
                  {section.number}. {section.title}
                </h2>
                <p style={{
                  fontSize: '14px',
                  color: isHighlighted ? '#991b1b' : '#475569',
                  lineHeight: '1.8',
                  fontWeight: isHighlighted ? '600' : '400',
                }}>
                  {section.body}
                </p>
              </div>
            );
          })}
        </div>
        <div style={{ flexShrink: 0, paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
          <button onClick={onClose} style={{
            width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white',
            fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
          }}>Close</button>
        </div>
      </div>
    </div>
  );
}
