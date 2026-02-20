'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import { useToast } from '../../components/Toast';

export default function AdminCouponsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [coupons, setCoupons] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', type: 'percent', value: '', min_order: '', max_discount: '', max_uses: '', expires_days: '30', description: '' });

  useEffect(() => { fetchCoupons(); }, []);

  const fetchCoupons = async () => {
    const res = await fetch('/api/coupons');
    const data = await res.json();
    setCoupons(data.data || []);
  };

  const handleCreate = async () => {
    if (!form.code || !form.value) { toast.error('Code and value are required'); return; }
    const expiresAt = form.expires_days ? new Date(Date.now() + parseInt(form.expires_days) * 86400000).toISOString() : null;
    const res = await fetch('/api/coupons', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, expires_at: expiresAt }),
    });
    if (res.ok) { toast.success('Coupon created'); setShowForm(false); setForm({ code: '', type: 'percent', value: '', min_order: '', max_discount: '', max_uses: '', expires_days: '30', description: '' }); fetchCoupons(); }
    else toast.error('Failed to create coupon');
  };

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '16px' };
  const input = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box', marginBottom: '10px' };
  const label = { fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px', display: 'block' };

  if (!user || user.role !== 'admin') return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Coupons" />
      <div style={{ flex: 1, padding: '30px', maxWidth: '900px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b' }}>🎟️ Coupons</h1>
          <button onClick={() => setShowForm(!showForm)} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#3b82f6', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
            {showForm ? 'Cancel' : '+ New Coupon'}
          </button>
        </div>

        {showForm && (
          <div style={card}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div><label style={label}>Code *</label><input style={input} value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SAVE10" /></div>
              <div><label style={label}>Type</label><select style={input} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="percent">Percent (%)</option><option value="fixed">Fixed ($)</option></select></div>
              <div><label style={label}>Value *</label><input style={input} type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder={form.type === 'percent' ? '10' : '5'} /></div>
              <div><label style={label}>Min Order ($)</label><input style={input} type="number" value={form.min_order} onChange={e => setForm({ ...form, min_order: e.target.value })} placeholder="0" /></div>
              <div><label style={label}>Max Discount ($)</label><input style={input} type="number" value={form.max_discount} onChange={e => setForm({ ...form, max_discount: e.target.value })} placeholder="No limit" /></div>
              <div><label style={label}>Max Uses</label><input style={input} type="number" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: e.target.value })} placeholder="Unlimited" /></div>
              <div><label style={label}>Expires (days)</label><input style={input} type="number" value={form.expires_days} onChange={e => setForm({ ...form, expires_days: e.target.value })} /></div>
              <div><label style={label}>Description</label><input style={input} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Short description" /></div>
            </div>
            <button onClick={handleCreate} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#059669', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Create Coupon</button>
          </div>
        )}

        {coupons.map(c => (
          <div key={c.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <span style={{ padding: '4px 12px', borderRadius: '6px', background: '#eff6ff', color: '#3b82f6', fontSize: '14px', fontWeight: '800', fontFamily: 'monospace' }}>{c.code}</span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#059669' }}>{c.type === 'percent' ? `${c.value}%` : `$${c.value}`} off</span>
                {!c.is_active && <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#fef2f2', color: '#ef4444', fontSize: '11px', fontWeight: '600' }}>INACTIVE</span>}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {c.description} • Min ${c.min_order || 0} • Used {c.used_count || 0}{c.max_uses ? `/${c.max_uses}` : ''} • {c.expires_at ? `Expires ${new Date(c.expires_at).toLocaleDateString()}` : 'No expiry'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
