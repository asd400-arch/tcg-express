'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import { useToast } from '../../components/Toast';

const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '16px' };
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' };
const labelStyle = { fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px', display: 'block' };
const btnPrimary = { padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#1a56db', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" };
const btnSecondary = { ...btnPrimary, background: '#e2e8f0', color: '#475569' };
const btnDanger = { ...btnPrimary, background: '#ef4444' };
const thStyle = { padding: '8px 10px', fontSize: '11px', fontWeight: '600', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' };
const tdStyle = { padding: '8px 10px', fontSize: '13px', color: '#1e293b', borderBottom: '1px solid #f8fafc', whiteSpace: 'nowrap' };

const EMPTY_FORM = { full_name: '', phone: '', zone_id: '', hourly_rate: '', bonus_per_signup: '', daily_bonus_cap: '', is_active: true };

export default function AdminPromotersPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState('promoters');
  const [promoters, setPromoters] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Bonuses tab state
  const [bonuses, setBonuses] = useState([]);
  const [bonusLoading, setBonusLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [processing, setProcessing] = useState(false);

  useEffect(() => { loadPromoters(); }, []);
  useEffect(() => { if (tab === 'bonuses') loadBonuses(); }, [tab]);

  const loadPromoters = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/promoters');
      const data = await res.json();
      setPromoters(data.data || []);
      setZones(data.zones || []);
    } catch { toast.error('Failed to load promoters'); }
    setLoading(false);
  };

  const loadBonuses = async () => {
    setBonusLoading(true);
    try {
      const res = await fetch('/api/admin/promoters/bonuses');
      const data = await res.json();
      setBonuses(data.data || []);
      setSelected(new Set());
    } catch { toast.error('Failed to load bonuses'); }
    setBonusLoading(false);
  };

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditId(p.id);
    setForm({
      full_name: p.full_name || '',
      phone: p.phone || '',
      zone_id: p.zone_id || '',
      hourly_rate: p.hourly_rate ?? '',
      bonus_per_signup: p.bonus_per_signup ?? '',
      daily_bonus_cap: p.daily_bonus_cap ?? '',
      is_active: p.is_active !== false,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) { toast.error('Name is required'); return; }
    if (!editId && !form.zone_id) { toast.error('Zone is required'); return; }
    setSaving(true);
    try {
      const method = editId ? 'PATCH' : 'POST';
      const body = editId ? { id: editId, ...form } : form;
      // Clean numeric fields
      if (body.hourly_rate !== '') body.hourly_rate = Number(body.hourly_rate);
      else delete body.hourly_rate;
      if (body.bonus_per_signup !== '') body.bonus_per_signup = Number(body.bonus_per_signup);
      else delete body.bonus_per_signup;
      if (body.daily_bonus_cap !== '') body.daily_bonus_cap = Number(body.daily_bonus_cap);
      else delete body.daily_bonus_cap;

      const res = await fetch('/api/admin/promoters', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(editId ? 'Promoter updated' : `Promoter created: ${result.data?.code}`);
        setShowForm(false);
        loadPromoters();
      } else {
        toast.error(result.error || 'Save failed');
      }
    } catch { toast.error('Network error'); }
    setSaving(false);
  };

  const copyLink = (code) => {
    navigator.clipboard.writeText(`https://app.techchainglobal.com/?ref=${code}`);
    toast.success('QR link copied');
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === bonuses.length) setSelected(new Set());
    else setSelected(new Set(bonuses.map((b) => b.id)));
  };

  const handleBatchAction = async (action) => {
    if (selected.size === 0) { toast.error('Select at least one bonus'); return; }

    let reject_reason = '';
    if (action === 'reject') {
      reject_reason = window.prompt('Rejection reason (required):');
      if (!reject_reason?.trim()) { toast.error('Reason is required'); return; }
    }

    const confirmed = window.confirm(`${action === 'approve' ? 'Approve' : 'Reject'} ${selected.size} bonus(es)?`);
    if (!confirmed) return;

    setProcessing(true);
    try {
      const res = await fetch('/api/admin/promoters/bonuses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: [...selected], reject_reason }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(`${result.updated} bonus(es) ${action === 'approve' ? 'approved' : 'rejected'}`);
        loadBonuses();
      } else {
        toast.error(result.error || 'Action failed');
      }
    } catch { toast.error('Network error'); }
    setProcessing(false);
  };

  if (!user || user.role !== 'admin') return null;

  const tabBtn = (name, label) => ({
    padding: '8px 20px', borderRadius: '8px 8px 0 0', border: 'none',
    background: tab === name ? 'white' : 'transparent', color: tab === name ? '#1e293b' : '#64748b',
    fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
    borderBottom: tab === name ? '2px solid #1a56db' : '2px solid transparent',
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Promoters" />
      <div style={{ flex: 1, padding: '30px', maxWidth: '1100px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>Promoters</h1>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
          <button style={tabBtn('promoters', 'Promoters')} onClick={() => setTab('promoters')}>Promoters</button>
          <button style={tabBtn('bonuses', 'Pending Bonuses')} onClick={() => setTab('bonuses')}>Pending Bonuses</button>
        </div>

        {/* ===== PROMOTERS TAB ===== */}
        {tab === 'promoters' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>{promoters.length} promoter(s)</span>
              <button style={btnPrimary} onClick={openAdd}>+ Add Promoter</button>
            </div>

            {/* Add/Edit Form */}
            {showForm && (
              <div style={card}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>
                  {editId ? 'Edit Promoter' : 'Add Promoter'}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={labelStyle}>Full Name *</label>
                    <input style={inputStyle} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone</label>
                    <input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+65..." />
                  </div>
                  {!editId && (
                    <div>
                      <label style={labelStyle}>Zone *</label>
                      <select style={inputStyle} value={form.zone_id} onChange={(e) => setForm({ ...form, zone_id: e.target.value })}>
                        <option value="">Select zone</option>
                        {zones.map((z) => <option key={z.id} value={z.id}>{z.zone_key}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label style={labelStyle}>Hourly Rate ($)</label>
                    <input style={inputStyle} type="number" min="0" step="0.5" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Bonus/Signup ($)</label>
                    <input style={inputStyle} type="number" min="0" step="0.5" value={form.bonus_per_signup} onChange={(e) => setForm({ ...form, bonus_per_signup: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Daily Cap ($)</label>
                    <input style={inputStyle} type="number" min="0" step="1" value={form.daily_bonus_cap} onChange={(e) => setForm({ ...form, daily_bonus_cap: e.target.value })} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} style={{ accentColor: '#3b82f6' }} />
                      Active
                    </label>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={btnPrimary} disabled={saving} onClick={handleSave}>{saving ? 'Saving...' : 'Save'}</button>
                  <button style={btnSecondary} onClick={() => setShowForm(false)}>Cancel</button>
                </div>
              </div>
            )}

            {/* Promoters Table */}
            {loading ? (
              <p style={{ color: '#64748b' }}>Loading...</p>
            ) : (
              <div style={{ ...card, padding: '0', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Code</th>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Zone</th>
                      <th style={thStyle}>Active</th>
                      <th style={thStyle}>Signups</th>
                      <th style={thStyle}>Pending</th>
                      <th style={thStyle}>Hold</th>
                      <th style={thStyle}>Unpaid</th>
                      <th style={thStyle}>Paid</th>
                      <th style={thStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {promoters.length === 0 ? (
                      <tr><td colSpan={10} style={{ ...tdStyle, color: '#94a3b8', textAlign: 'center', padding: '20px' }}>No promoters yet</td></tr>
                    ) : promoters.map((p) => (
                      <tr key={p.id}>
                        <td style={{ ...tdStyle, fontWeight: '600', fontFamily: 'monospace' }}>{p.code}</td>
                        <td style={tdStyle}>{p.full_name}</td>
                        <td style={tdStyle}>{p.zone_key || '-'}</td>
                        <td style={tdStyle}>
                          <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: p.is_active ? '#ecfdf5' : '#fef2f2', color: p.is_active ? '#065f46' : '#991b1b' }}>
                            {p.is_active ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td style={tdStyle}>{p.total_signups ?? 0}</td>
                        <td style={tdStyle}>{p.pending_count ?? 0}</td>
                        <td style={tdStyle}>{p.hold_count ?? 0}</td>
                        <td style={tdStyle}>${Number(p.unpaid_amount ?? 0).toFixed(2)}</td>
                        <td style={tdStyle}>${Number(p.paid_amount ?? 0).toFixed(2)}</td>
                        <td style={{ ...tdStyle, display: 'flex', gap: '6px' }}>
                          <button style={{ ...btnSecondary, padding: '4px 10px', fontSize: '11px' }} onClick={() => openEdit(p)}>Edit</button>
                          <button style={{ ...btnSecondary, padding: '4px 10px', fontSize: '11px' }} onClick={() => copyLink(p.code)} title="Copy QR link">Link</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ===== BONUSES TAB ===== */}
        {tab === 'bonuses' && (
          <>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button style={btnPrimary} disabled={processing || selected.size === 0} onClick={() => handleBatchAction('approve')}>
                Approve Selected ({selected.size})
              </button>
              <button style={btnDanger} disabled={processing || selected.size === 0} onClick={() => handleBatchAction('reject')}>
                Reject Selected ({selected.size})
              </button>
            </div>

            {bonusLoading ? (
              <p style={{ color: '#64748b' }}>Loading...</p>
            ) : (
              <div style={{ ...card, padding: '0', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>
                        <input type="checkbox" checked={bonuses.length > 0 && selected.size === bonuses.length} onChange={toggleAll} style={{ accentColor: '#3b82f6' }} />
                      </th>
                      <th style={thStyle}>Promoter</th>
                      <th style={thStyle}>User</th>
                      <th style={thStyle}>Phone</th>
                      <th style={thStyle}>Amount</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Reason</th>
                      <th style={thStyle}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bonuses.length === 0 ? (
                      <tr><td colSpan={8} style={{ ...tdStyle, color: '#94a3b8', textAlign: 'center', padding: '20px' }}>No pending bonuses</td></tr>
                    ) : bonuses.map((b) => (
                      <tr key={b.id}>
                        <td style={tdStyle}>
                          <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggleSelect(b.id)} style={{ accentColor: '#3b82f6' }} />
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '12px' }}>{b.promoter_code} <span style={{ color: '#64748b' }}>({b.promoter_name})</span></td>
                        <td style={tdStyle}>{b.user_name || '-'}</td>
                        <td style={tdStyle}>{b.user_phone}</td>
                        <td style={{ ...tdStyle, fontWeight: '600' }}>${Number(b.amount).toFixed(2)}</td>
                        <td style={tdStyle}>
                          <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: b.status === 'hold' ? '#fff7ed' : '#eff6ff', color: b.status === 'hold' ? '#9a3412' : '#1e40af' }}>
                            {b.status}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontSize: '11px', color: '#9a3412', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.hold_reason || '-'}</td>
                        <td style={{ ...tdStyle, fontSize: '11px', color: '#94a3b8' }}>{new Date(b.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
