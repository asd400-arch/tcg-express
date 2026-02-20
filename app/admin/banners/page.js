'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import { useToast } from '../../components/Toast';

export default function AdminBannersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [banners, setBanners] = useState([]);
  const [form, setForm] = useState({ title: '', subtitle: '', bg_color: '#3b82f6', link: '', sort_order: 0, is_active: true });
  const [editing, setEditing] = useState(null);

  useEffect(() => { fetchBanners(); }, []);

  const fetchBanners = async () => {
    const res = await fetch('/api/banners?all=true');
    const data = await res.json();
    setBanners(data.data || []);
  };

  const handleSave = async () => {
    if (!form.title) { toast.error('Title is required'); return; }
    const res = await fetch('/api/banners', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, id: editing }),
    });
    if (res.ok) { toast.success(editing ? 'Banner updated' : 'Banner created'); setEditing(null); setForm({ title: '', subtitle: '', bg_color: '#3b82f6', link: '', sort_order: 0, is_active: true }); fetchBanners(); }
    else toast.error('Failed to save banner');
  };

  const startEdit = (b) => {
    setEditing(b.id);
    setForm({ title: b.title, subtitle: b.subtitle || '', bg_color: b.bg_color || '#3b82f6', link: b.link || '', sort_order: b.sort_order, is_active: b.is_active });
  };

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '16px' };
  const input = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box', marginBottom: '10px' };
  const label = { fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px', display: 'block' };

  if (!user || user.role !== 'admin') return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Banners" />
      <div style={{ flex: 1, padding: '30px', maxWidth: '900px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>📢 Promo Banners</h1>

        <div style={card}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>{editing ? 'Edit Banner' : 'New Banner'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><label style={label}>Title *</label><input style={input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Banner title" /></div>
            <div><label style={label}>Subtitle</label><input style={input} value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} placeholder="Short description" /></div>
            <div><label style={label}>Background Color</label><input style={{ ...input, height: '40px', padding: '4px' }} type="color" value={form.bg_color} onChange={e => setForm({ ...form, bg_color: e.target.value })} /></div>
            <div><label style={label}>Link URL</label><input style={input} value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="/client/wallet" /></div>
            <div><label style={label}>Sort Order</label><input style={input} type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '20px' }}>
              <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
              <label style={{ fontSize: '13px', color: '#1e293b' }}>Active</label>
            </div>
          </div>
          {/* Preview */}
          <div style={{ marginBottom: '12px', borderRadius: '10px', padding: '16px 20px', background: form.bg_color, color: 'white' }}>
            <div style={{ fontSize: '16px', fontWeight: '700' }}>{form.title || 'Banner title'}</div>
            {form.subtitle && <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>{form.subtitle}</div>}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleSave} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#059669', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>{editing ? 'Update' : 'Create'}</button>
            {editing && <button onClick={() => { setEditing(null); setForm({ title: '', subtitle: '', bg_color: '#3b82f6', link: '', sort_order: 0, is_active: true }); }} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Cancel</button>}
          </div>
        </div>

        {banners.map(b => (
          <div key={b.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: b.bg_color || '#3b82f6', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{b.title}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>{b.subtitle || 'No subtitle'} • Order: {b.sort_order}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: b.is_active ? '#f0fdf4' : '#fef2f2', color: b.is_active ? '#059669' : '#ef4444' }}>{b.is_active ? 'Active' : 'Inactive'}</span>
              <button onClick={() => startEdit(b)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: '#3b82f6', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Edit</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
