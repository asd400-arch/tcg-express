'use client';

export default function Spinner({ size = 'lg' }) {
  const s = size === 'sm' ? 20 : 40;
  const border = size === 'sm' ? 2 : 4;

  if (size === 'lg') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
        <div style={{
          width: `${s}px`, height: `${s}px`, border: `${border}px solid #e2e8f0`,
          borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  return (
    <div style={{
      width: `${s}px`, height: `${s}px`, border: `${border}px solid #e2e8f0`,
      borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      display: 'inline-block',
    }} />
  );
}
