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
  const [form, setForm] = useState({
    code: '', type: 'percentage', value: '', min_order: '', max_discount: '',
    max_uses: '', per_user_limit: '1', expires_days: '30',
    new_customers_only: false, description: '',
  });

  useEffect(() => { fetchCoupons(); }, []);

  const fetchCoupons = async () => {
    const res = await fetch('/api/coupons');
    const data = await res.json();
    setCoupons(data.data || []);
  };

  const handleCreate = async () => {
    if (!form.code || !form.value) { toast.error('Code and value are required'); return; }
    const validUntil = form.expires_days ? new Date(Date.now() + parseInt(form.expires_days) * 86400000).toISOString() : null;
    const res = await fetch('/api/coupons', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: form.code,
        discount_type: form.type,
        discount_value: form.value,
        min_order_amount: form.min_order || null,
        max_discount: form.max_discount || null,
        usage_limit: form.max_uses || null,
        per_user_limit: form.per_user_limit || '1',
        valid_until: validUntil,
        new_customers_only: form.new_customers_only,
        description: form.description,
      }),
    });
    if (res.ok) {
      toast.success('Voucher created');
      setShowForm(false);
      setForm({ code: '', type: 'percentage', value: '', min_order: '', max_discount: '', max_uses: '', per_user_limit: '1', expires_days: '30', new_customers_only: false, description: '' });
      fetchCoupons();
    } else {
      const err = await res.json();
      toast.error(err.error || 'Failed to create voucher');
    }
  };

  const toggleActive = async (coupon) => {
    const res = await fetch('/api/coupons', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: coupon.id, is_active: !coupon.is_active }),
    });
    if (res.ok) {
      toast.success(coupon.is_active ? 'Voucher deactivated' : 'Voucher activated');
      fetchCoupons();
    } else toast.error('Failed to update voucher');
  };

  const isExpired = (c) => c.valid_until && new Date(c.valid_until) < new Date();
  const usageText = (c) => {
    const used = c.usage_count || 0;
    return c.usage_limit ? `${used}/${c.usage_limit}` : `${used}/∞`;
  };

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '16px' };
  const input = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box', marginBottom: '10px' };
  const label = { fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px', display: 'block' };
  const badge = (bg, color) => ({ padding: '2px 8px', borderRadius: '4px', background: bg, color, fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' });

  if (!user || user.role !== 'admin') return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Coupons" />
      <div style={{ flex: 1, padding: '30px', maxWidth: '900px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b' }}>🎟️ Vouchers & Coupons</h1>
          <button onClick={() => setShowForm(!showForm)} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#3b82f6', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
            {showForm ? 'Cancel' : '+ New Voucher'}
          </button>
        </div>

        {showForm && (
          <div style={card}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>Create Voucher</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={label}>Code *</label>
                <input style={input} value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="WELCOME20" />
              </div>
              <div>
                <label style={label}>Discount Type</label>
                <select style={input} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed ($)</option>
                </select>
              </div>
              <div>
                <label style={label}>Discount Value *</label>
                <input style={input} type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder={form.type === 'percentage' ? '20' : '5'} />
              </div>
              <div>
                <label style={label}>Max Discount Cap ($)</label>
                <input style={input} type="number" value={form.max_discount} onChange={e => setForm({ ...form, max_discount: e.target.value })} placeholder="No limit" />
              </div>
              <div>
                <label style={label}>Min Order Amount ($)</label>
                <input style={input} type="number" value={form.min_order} onChange={e => setForm({ ...form, min_order: e.target.value })} placeholder="0" />
              </div>
              <div>
                <label style={label}>Total Usage Limit</label>
                <input style={input} type="number" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: e.target.value })} placeholder="Unlimited" />
              </div>
              <div>
                <label style={label}>Per-User Limit</label>
                <input style={input} type="number" value={form.per_user_limit} onChange={e => setForm({ ...form, per_user_limit: e.target.value })} placeholder="1" />
              </div>
              <div>
                <label style={label}>Expires In (days)</label>
                <input style={input} type="number" value={form.expires_days} onChange={e => setForm({ ...form, expires_days: e.target.value })} placeholder="30" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={label}>Description</label>
                <input style={input} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Short description for this voucher" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ ...label, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={form.new_customers_only} onChange={e => setForm({ ...form, new_customers_only: e.target.checked })} style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }} />
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>New customers only</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '400' }}>— Only users with no prior completed jobs can use this</span>
                </label>
              </div>
            </div>
            <button onClick={handleCreate} style={{ marginTop: '6px', padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#059669', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
              Create Voucher
            </button>
          </div>
        )}

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Total', value: coupons.length, color: '#3b82f6' },
            { label: 'Active', value: coupons.filter(c => c.is_active && !isExpired(c)).length, color: '#059669' },
            { label: 'Total Uses', value: coupons.reduce((s, c) => s + (c.usage_count || 0), 0), color: '#8b5cf6' },
          ].map(s => (
            <div key={s.label} style={{ ...card, textAlign: 'center', marginBottom: 0 }}>
              <div style={{ fontSize: '24px', fontWeight: '800', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Coupon list */}
        {coupons.map(c => (
          <div key={c.id} style={{ ...card, opacity: (!c.is_active || isExpired(c)) ? 0.6 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <span style={{ padding: '4px 12px', borderRadius: '6px', background: '#eff6ff', color: '#3b82f6', fontSize: '14px', fontWeight: '800', fontFamily: 'monospace' }}>{c.code}</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#059669' }}>
                    {c.discount_type === 'percentage' ? `${c.discount_value}%` : `$${c.discount_value}`} off
                  </span>
                  {c.new_customers_only && <span style={badge('#fef3c7', '#d97706')}>New customers</span>}
                  {!c.is_active && <span style={badge('#fef2f2', '#ef4444')}>INACTIVE</span>}
                  {isExpired(c) && c.is_active && <span style={badge('#fef2f2', '#ef4444')}>EXPIRED</span>}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.6' }}>
                  {c.description && <div>{c.description}</div>}
                  <div>
                    Min order: ${parseFloat(c.min_order_amount || 0).toFixed(2)}
                    {c.max_discount ? ` · Max discount: $${parseFloat(c.max_discount).toFixed(2)}` : ''}
                    {` · Per user: ${c.per_user_limit || 1}x`}
                  </div>
                  <div>
                    Used: <strong>{usageText(c)}</strong>
                    {c.valid_until ? ` · Expires: ${new Date(c.valid_until).toLocaleDateString()}` : ' · No expiry'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => toggleActive(c)}
                style={{
                  padding: '6px 16px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                  background: c.is_active ? '#fef2f2' : '#f0fdf4', color: c.is_active ? '#ef4444' : '#16a34a',
                }}
              >
                {c.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}

        {coupons.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
            <p style={{ fontSize: '14px' }}>No vouchers yet. Create your first one!</p>
          </div>
        )}
      </div>
    </div>
  );
}
