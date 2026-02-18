'use client';
import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    info: (msg) => addToast(msg, 'info'),
  };

  const colors = {
    success: { bg: '#f0fdf4', border: '#10b981', text: '#065f46', icon: '\u2713' },
    error: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b', icon: '\u2717' },
    info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af', icon: '\u2139' },
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div style={{
        position: 'fixed', top: '16px', right: '16px', zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const c = colors[t.type] || colors.info;
          return (
            <div key={t.id} style={{
              background: c.bg, borderLeft: `4px solid ${c.border}`, color: c.text,
              padding: '12px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '500',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)', pointerEvents: 'auto',
              display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '360px',
              animation: 'slideIn 0.3s ease-out',
              fontFamily: "'Inter', sans-serif",
            }}>
              <span style={{ fontWeight: '700', fontSize: '16px' }}>{c.icon}</span>
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
