'use client';
import { useState, useEffect, useRef } from 'react';

export default function PromoBanner() {
  const [banners, setBanners] = useState([]);
  const [current, setCurrent] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    fetch('/api/banners').then(r => r.json()).then(d => setBanners(d.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrent(prev => (prev + 1) % banners.length);
    }, 3000);
    return () => clearInterval(intervalRef.current);
  }, [banners]);

  if (banners.length === 0) return null;
  const b = banners[current];

  return (
    <div style={{ marginBottom: '20px', position: 'relative' }}>
      <a href={b.link || '#'} style={{ textDecoration: 'none' }}>
        <div style={{
          background: b.image_url ? `url(${b.image_url}) center/cover` : (b.bg_color || 'linear-gradient(135deg, #3b82f6, #1d4ed8)'),
          borderRadius: '14px', padding: '24px 28px', color: 'white', position: 'relative', overflow: 'hidden',
          minHeight: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          {!b.image_url && <div style={{ position: 'absolute', inset: 0, background: b.bg_color || 'linear-gradient(135deg, #3b82f6, #1d4ed8)', zIndex: 0 }} />}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: '18px', fontWeight: '800' }}>{b.title}</div>
            {b.subtitle && <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>{b.subtitle}</div>}
          </div>
        </div>
      </a>
      {banners.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '8px' }}>
          {banners.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              style={{
                width: i === current ? '20px' : '8px', height: '8px', borderRadius: '4px',
                background: i === current ? '#3b82f6' : '#cbd5e1', border: 'none', cursor: 'pointer',
                transition: 'all 0.3s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
