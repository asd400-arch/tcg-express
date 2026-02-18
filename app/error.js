'use client';

export default function Error({ error, reset }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '20px' }}>
      <div style={{ textAlign: 'center', maxWidth: '420px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: '900', color: 'white', margin: '0 auto 24px' }}>!</div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>Something went wrong</h1>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '32px' }}>An unexpected error occurred. Please try again or return to the homepage.</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => reset()} style={{
            padding: '13px 32px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white',
            fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
          }}>Try Again</button>
          <a href="/" style={{
            display: 'inline-flex', alignItems: 'center', padding: '13px 32px', borderRadius: '10px',
            border: '1px solid #e2e8f0', background: 'white', color: '#374151',
            fontSize: '15px', fontWeight: '600', textDecoration: 'none', fontFamily: "'Inter', sans-serif",
          }}>Go Home</a>
        </div>
      </div>
    </div>
  );
}
