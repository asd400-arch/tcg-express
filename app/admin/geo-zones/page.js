'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import { useToast } from '../../components/Toast';

const ZONE_TYPES = [
  { key: 'coverage', label: 'Coverage', color: '#3b82f6' },
  { key: 'surcharge', label: 'Surcharge', color: '#f59e0b' },
  { key: 'restricted', label: 'Restricted', color: '#ef4444' },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ef4444', '#06b6d4', '#84cc16'];

const emptyForm = { name: '', description: '', zone_type: 'coverage', lat_min: '', lat_max: '', lng_min: '', lng_max: '', surcharge_rate: '0', surcharge_flat: '0', color: '#3b82f6' };

export default function AdminGeoZonesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [zones, setZones] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { fetchZones(); }, []);

  const fetchZones = async () => {
    const res = await fetch('/api/admin/geo-zones');
    const data = await res.json();
    setZones(data.data || []);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.lat_min || !form.lat_max || !form.lng_min || !form.lng_max) {
      toast.error('Name and all coordinates are required'); return;
    }
    const payload = {
      ...form,
      lat_min: parseFloat(form.lat_min), lat_max: parseFloat(form.lat_max),
      lng_min: parseFloat(form.lng_min), lng_max: parseFloat(form.lng_max),
      surcharge_rate: parseFloat(form.surcharge_rate) || 0,
      surcharge_flat: parseFloat(form.surcharge_flat) || 0,
    };

    if (editing) {
      payload.id = editing;
      const res = await fetch('/api/admin/geo-zones', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { toast.success('Zone updated'); setEditing(null); } else toast.error('Update failed');
    } else {
      const res = await fetch('/api/admin/geo-zones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) toast.success('Zone created'); else toast.error('Creation failed');
    }
    setShowForm(false); setForm(emptyForm); fetchZones();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this zone?')) return;
    const res = await fetch(`/api/admin/geo-zones?id=${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Zone deleted'); fetchZones(); } else toast.error('Delete failed');
  };

  const handleToggle = async (zone) => {
    const res = await fetch('/api/admin/geo-zones', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: zone.id, status: zone.status === 'active' ? 'inactive' : 'active' }),
    });
    if (res.ok) { toast.success(`Zone ${zone.status === 'active' ? 'deactivated' : 'activated'}`); fetchZones(); }
  };

  const startEdit = (zone) => {
    setForm({
      name: zone.name, description: zone.description || '', zone_type: zone.zone_type,
      lat_min: String(zone.lat_min), lat_max: String(zone.lat_max),
      lng_min: String(zone.lng_min), lng_max: String(zone.lng_max),
      surcharge_rate: String(zone.surcharge_rate || 0), surcharge_flat: String(zone.surcharge_flat || 0),
      color: zone.color || '#3b82f6',
    });
    setEditing(zone.id);
    setShowForm(true);
  };

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '16px' };
  const input = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box', marginBottom: '10px' };
  const label = { fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px', display: 'block' };

  if (!user || user.role !== 'admin') return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Geo Zones" />
      <div style={{ flex: 1, padding: '30px', maxWidth: '900px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b' }}>🗺️ Service Zones</h1>
          <button onClick={() => { setShowForm(!showForm); setEditing(null); setForm(emptyForm); }} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#3b82f6', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
            {showForm ? 'Cancel' : '+ New Zone'}
          </button>
        </div>

        {showForm && (
          <div style={{ ...card, border: '2px solid #3b82f6' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>{editing ? 'Edit Zone' : 'Create Zone'}</h3>
            <label style={label}>Zone Name</label>
            <input style={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Singapore Central" />
            <label style={label}>Description</label>
            <input style={input} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Areas covered" />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={label}>Zone Type</label>
                <select style={input} value={form.zone_type} onChange={e => setForm({ ...form, zone_type: e.target.value })}>
                  {ZONE_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Color</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {COLORS.map(c => (
                    <div key={c} onClick={() => setForm({ ...form, color: c })} style={{
                      width: '28px', height: '28px', borderRadius: '6px', background: c, cursor: 'pointer',
                      border: form.color === c ? '3px solid #1e293b' : '2px solid transparent',
                    }} />
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0c4a6e', marginBottom: '10px' }}>Bounding Box Coordinates</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><label style={label}>Latitude Min (South)</label><input style={input} type="number" step="0.0001" value={form.lat_min} onChange={e => setForm({ ...form, lat_min: e.target.value })} placeholder="1.2400" /></div>
                <div><label style={label}>Latitude Max (North)</label><input style={input} type="number" step="0.0001" value={form.lat_max} onChange={e => setForm({ ...form, lat_max: e.target.value })} placeholder="1.4500" /></div>
                <div><label style={label}>Longitude Min (West)</label><input style={input} type="number" step="0.0001" value={form.lng_min} onChange={e => setForm({ ...form, lng_min: e.target.value })} placeholder="103.6800" /></div>
                <div><label style={label}>Longitude Max (East)</label><input style={input} type="number" step="0.0001" value={form.lng_max} onChange={e => setForm({ ...form, lng_max: e.target.value })} placeholder="103.9900" /></div>
              </div>
            </div>

            {form.zone_type === 'surcharge' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><label style={label}>Surcharge Rate (%)</label><input style={input} type="number" step="0.01" value={form.surcharge_rate} onChange={e => setForm({ ...form, surcharge_rate: e.target.value })} /></div>
                <div><label style={label}>Surcharge Flat ($)</label><input style={input} type="number" step="0.50" value={form.surcharge_flat} onChange={e => setForm({ ...form, surcharge_flat: e.target.value })} /></div>
              </div>
            )}

            <button onClick={handleSubmit} style={{ padding: '12px 28px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
              {editing ? 'Update Zone' : 'Create Zone'}
            </button>
          </div>
        )}

        {/* Zone List */}
        {zones.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>🗺️</div>
            <p style={{ color: '#64748b' }}>No zones configured. Add your first service zone.</p>
          </div>
        ) : zones.map(zone => {
          const zt = ZONE_TYPES.find(t => t.key === zone.zone_type) || ZONE_TYPES[0];
          return (
            <div key={zone.id} style={{ ...card, borderLeft: `4px solid ${zone.color || zt.color}`, opacity: zone.status === 'inactive' ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>{zone.name}</span>
                    <span style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '700', background: `${zt.color}15`, color: zt.color, textTransform: 'uppercase' }}>{zt.label}</span>
                    <span style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '700', background: zone.status === 'active' ? '#10b98115' : '#ef444415', color: zone.status === 'active' ? '#10b981' : '#ef4444', textTransform: 'uppercase' }}>{zone.status}</span>
                  </div>
                  {zone.description && <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>{zone.description}</div>}
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Lat: {zone.lat_min} ~ {zone.lat_max} | Lng: {zone.lng_min} ~ {zone.lng_max}
                  </div>
                  {zone.zone_type === 'surcharge' && (zone.surcharge_rate > 0 || zone.surcharge_flat > 0) && (
                    <div style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '600', marginTop: '4px' }}>
                      Surcharge: {zone.surcharge_rate > 0 ? `${zone.surcharge_rate}%` : ''}{zone.surcharge_rate > 0 && zone.surcharge_flat > 0 ? ' + ' : ''}{zone.surcharge_flat > 0 ? `$${zone.surcharge_flat}` : ''}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleToggle(zone)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", color: '#64748b' }}>
                    {zone.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => startEdit(zone)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #3b82f6', background: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", color: '#3b82f6' }}>Edit</button>
                  <button onClick={() => handleDelete(zone.id)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #ef4444', background: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", color: '#ef4444' }}>Delete</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
