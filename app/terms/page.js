'use client';
import useMobile from '../components/useMobile';
import { TERMS_SECTIONS } from '../../lib/terms-content';

export default function TermsPage() {
  const m = useMobile();
  const h2 = { fontSize: '18px', fontWeight: '700', color: '#1e293b', marginTop: '32px', marginBottom: '12px' };
  const p = { fontSize: '14px', color: '#475569', lineHeight: '1.8', marginBottom: '12px' };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: m ? '20px 16px' : '40px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', background: 'white', borderRadius: '16px', padding: m ? '24px 20px' : '40px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
        <a href="/" style={{ color: '#3b82f6', fontSize: '13px', textDecoration: 'none', fontWeight: '500' }}>← Back</a>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1e293b', marginTop: '16px', marginBottom: '8px' }}>Terms of Service</h1>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '24px' }}>Last updated: 19 February 2026</p>

        <p style={p}>Welcome to TCG Express ("Platform"), operated by Tech Chain Global Pte Ltd ("Company", "we", "us"). By accessing or using our Platform, you agree to be bound by these Terms of Service ("Terms").</p>

        {TERMS_SECTIONS.map(section => (
          <div key={section.number}>
            <h2 style={h2}>{section.number}. {section.title}</h2>
            <p style={p}>
              {section.number === 14
                ? <>For questions about these Terms, contact us at <a href="mailto:admin@techchainglobal.com" style={{ color: '#3b82f6' }}>admin@techchainglobal.com</a>.</>
                : section.body
              }
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
