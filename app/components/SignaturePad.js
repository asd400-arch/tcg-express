'use client';
import { useState, useRef, useEffect, useCallback } from 'react';

export default function SignaturePad({ onSave, onClose }) {
  const canvasRef = useRef(null);
  const [signerName, setSignerName] = useState('');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [drawing, setDrawing] = useState(false);

  // Set up canvas with retina scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#1e293b';
    // Draw guideline
    ctx.beginPath();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.moveTo(20, rect.height - 30);
    ctx.lineTo(rect.width - 20, rect.height - 30);
    ctx.stroke();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
  }, []);

  const getPos = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  }, []);

  const startDraw = useCallback((e) => {
    e.preventDefault();
    setDrawing(true);
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, [getPos]);

  const draw = useCallback((e) => {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  }, [drawing, getPos]);

  const stopDraw = useCallback((e) => {
    if (e) e.preventDefault();
    setDrawing(false);
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Redraw guideline
    ctx.beginPath();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.moveTo(20, rect.height - 30);
    ctx.lineTo(rect.width - 20, rect.height - 30);
    ctx.stroke();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    setHasDrawn(false);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    // Compress: draw onto smaller canvas, export as JPEG for smaller size (max ~200KB)
    const maxDim = 600;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const srcW = rect.width * dpr;
    const srcH = rect.height * dpr;
    const scale = Math.min(maxDim / srcW, maxDim / srcH, 1);
    const outW = Math.round(srcW * scale);
    const outH = Math.round(srcH * scale);

    const offscreen = document.createElement('canvas');
    offscreen.width = outW;
    offscreen.height = outH;
    const ctx2 = offscreen.getContext('2d');
    // White background for JPEG (transparent PNG → white)
    ctx2.fillStyle = '#ffffff';
    ctx2.fillRect(0, 0, outW, outH);
    ctx2.drawImage(canvas, 0, 0, outW, outH);

    // Use toBlob for mobile compatibility, fall back to toDataURL
    if (offscreen.toBlob) {
      offscreen.toBlob((blob) => {
        if (blob) {
          const reader = new FileReader();
          reader.onload = () => onSave(reader.result, signerName.trim());
          reader.readAsDataURL(blob);
        } else {
          onSave(offscreen.toDataURL('image/png'), signerName.trim());
        }
      }, 'image/png');
    } else {
      onSave(offscreen.toDataURL('image/png'), signerName.trim());
    }
  };

  const isValid = hasDrawn && signerName.trim().length > 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div style={{
        background: 'white', borderRadius: '20px', padding: '24px', width: '100%',
        maxWidth: '480px', maxHeight: '90vh', overflow: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: 0 }}>Customer Signature</h2>
          <button onClick={onClose} style={{
            width: '32px', height: '32px', borderRadius: '50%', border: 'none',
            background: '#f1f5f9', cursor: 'pointer', fontSize: '16px', color: '#64748b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{'\u2715'}</button>
        </div>

        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>
          Please have the customer sign below to confirm receipt of the delivery.
        </p>

        {/* Signer Name */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>
            Full Name
          </label>
          <input
            type="text"
            value={signerName}
            onChange={e => setSignerName(e.target.value)}
            placeholder="Enter signer's full name"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: '10px',
              border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '14px',
              fontFamily: "'Inter', sans-serif", outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Canvas */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>
            Signature
          </label>
          <canvas
            ref={canvasRef}
            style={{
              width: '100%', height: '180px', borderRadius: '12px',
              border: '2px solid #e2e8f0', background: '#fafbfc', cursor: 'crosshair',
              touchAction: 'none',
            }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
            <button onClick={clearCanvas} style={{
              padding: '4px 12px', borderRadius: '6px', border: '1px solid #e2e8f0',
              background: 'white', color: '#64748b', fontSize: '12px', fontWeight: '600',
              cursor: 'pointer', fontFamily: "'Inter', sans-serif",
            }}>Clear</button>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0',
            background: 'white', color: '#64748b', fontSize: '14px', fontWeight: '600',
            cursor: 'pointer', fontFamily: "'Inter', sans-serif",
          }}>Cancel</button>
          <button onClick={handleConfirm} disabled={!isValid} style={{
            flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
            background: isValid
              ? 'linear-gradient(135deg, #10b981, #059669)'
              : '#e2e8f0',
            color: isValid ? 'white' : '#94a3b8', fontSize: '14px', fontWeight: '600',
            cursor: isValid ? 'pointer' : 'not-allowed', fontFamily: "'Inter', sans-serif",
          }}>Confirm Signature</button>
        </div>
      </div>
    </div>
  );
}
