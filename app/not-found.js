import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '20px' }}>
      <div style={{ textAlign: 'center', maxWidth: '420px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: '900', color: 'white', margin: '0 auto 24px' }}>T</div>
        <h1 style={{ fontSize: '72px', fontWeight: '800', color: '#1e293b', margin: '0 0 8px', lineHeight: 1 }}>404</h1>
        <p style={{ fontSize: '20px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Page Not Found</p>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '32px' }}>The page you're looking for doesn't exist or has been moved.</p>
        <Link href="/" style={{
          display: 'inline-block', padding: '13px 32px', borderRadius: '10px',
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white',
          fontSize: '15px', fontWeight: '600', textDecoration: 'none',
          fontFamily: "'Inter', sans-serif",
        }}>Go Home</Link>
      </div>
    </div>
  );
}
