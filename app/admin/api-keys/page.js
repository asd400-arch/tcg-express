'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';

const SOURCES = ['generic', 'shopify', 'lazada', 'shopee', 'easyship', 'shippit', 'anchanto', 'dhl', 'dsv', 'ceva'];

export default function AdminApiKeysPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [keys, setKeys] = useState([]);
  const [clients, setClients] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', source: 'generic', client_id: '', webhook_url: '' });
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState(null); // 생성 직후 API key 표시용
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) router.push('/');
    if (!loading && user?.role === 'admin') loadData();
  }, [user, loading]);

  const loadData = async () => {
    setPageLoading(true);
    const [keysRes, clientsRes] = await Promise.all([
      fetch('/api/admin/api-keys'),
      fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'client' }) }),
    ]);
    const keysData = await keysRes.json();
    const clientsData = await clientsRes.json();
    setKeys(keysData.data || []);
    setClients(clientsData.data || []);
    setPageLoading(false);
  };

  const handleCreate = async () => {
    if (!form.name || !form.client_id) return alert('Name and Client are required');
    setSaving(true);
    const res = await fetch('/api/admin/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const result = await res.json();
    setSaving(false);
    if (result.error) return alert(result.error);
    setNewKey(result.api_key);
    setShowForm(false);
    setForm({ name: '', source: 'generic', client_id: '', webhook_url: '' });
    loadData();
  };

  const handleToggle = async (id, currentActive) => {
    await fetch(`/api/admin/api-keys/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !currentActive }),
    });
    loadData();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this API key? This cannot be undone.')) return;
    await fetch(`/api/admin/api-keys/${id}`, { method: 'DELETE' });
    loadData();
  };

  const copyKey = (key) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const s = {
    page: { display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' },
    main: { flex: 1, padding: '32px', maxWidth: '1100px' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
    title: { fontSize: '22px', fontWeight: '700', color: '#1e293b', margin: 0 },
    btn: { padding: '9px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
    btnPrimary: { background: '#2563eb', color: '#fff' },
    card: { background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '12px' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { textAlign: 'left', padding: '10px 14px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' },
    td: { padding: '12px 14px', fontSize: '14px', color: '#334155', borderBottom: '1px solid #f1f5f9' },
    badge: (active) => ({ display: 'inline-block', padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: active ? '#dcfce7' : '#fee2e2', color: active ? '#16a34a' : '#dc2626' }),
    sourceBadge: { display: 'inline-block', padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: '#eff6ff', color: '#2563eb' },
    input: { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' },
    label: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' },
    formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    alertBox: { background: '#fefce8', border: '1px solid #fbbf24', borderRadius: '10px', padding: '16px 20px', marginBottom: '20px' },
  };

  if (loading || pageLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Loading...</div>;

  return (
    <div style={s.page}>
      <Sidebar />
      <div style={s.main}>
        <div style={s.header}>
          <h1 style={s.title}>🔑 API Key Management</h1>
          <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New API Key'}
          </button>
        </div>

        {/* 신규 키 생성 직후 표시 */}
        {newKey && (
          <div style={s.alertBox}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#92400e', marginBottom: '8px' }}>
              ⚠️ Copy this API key now — it won't be shown again
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <code style={{ background: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', flex: 1, wordBreak: 'break-all', border: '1px solid #fbbf24' }}>
                {newKey}
              </code>
              <button style={{ ...s.btn, background: copied ? '#16a34a' : '#1e293b', color: '#fff', whiteSpace: 'nowrap' }} onClick={() => copyKey(newKey)}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <button style={{ ...s.btn, background: '#e2e8f0', color: '#475569' }} onClick={() => setNewKey(null)}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* 생성 폼 */}
        {showForm && (
          <div style={{ ...s.card, border: '2px solid #2563eb', marginBottom: '24px' }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>New API Key</div>
            <div style={s.formGrid}>
              <div>
                <label style={s.label}>Name *</label>
                <input style={s.input} placeholder="e.g. Easyship Production" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label style={s.label}>Source / Platform *</label>
                <select style={s.input} value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                  {SOURCES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>Linked Client Account *</label>
                <select style={s.input} value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}>
                  <option value="">Select client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.company_name || c.contact_name} ({c.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={s.label}>Webhook URL (optional)</label>
                <input style={s.input} placeholder="https://yourplatform.com/webhooks/tcg" value={form.webhook_url}
                  onChange={e => setForm({ ...form, webhook_url: e.target.value })} />
              </div>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
              <button style={{ ...s.btn, ...s.btnPrimary }} onClick={handleCreate} disabled={saving}>
                {saving ? 'Generating...' : 'Generate API Key'}
              </button>
            </div>
          </div>
        )}

        {/* API Keys 테이블 */}
        <div style={s.card}>
          {keys.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              No API keys yet. Create one to start receiving external orders.
            </div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Name</th>
                  <th style={s.th}>Source</th>
                  <th style={s.th}>Linked Client</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}>Orders</th>
                  <th style={s.th}>Last Used</th>
                  <th style={s.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map(k => (
                  <tr key={k.id}>
                    <td style={s.td}>
                      <div style={{ fontWeight: '600' }}>{k.name}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>
                        {k.api_key_preview}
                      </div>
                    </td>
                    <td style={s.td}><span style={s.sourceBadge}>{k.source}</span></td>
                    <td style={s.td}>{k.client_name || '—'}</td>
                    <td style={s.td}><span style={s.badge(k.is_active)}>{k.is_active ? 'Active' : 'Disabled'}</span></td>
                    <td style={s.td}>{k.total_orders || 0}</td>
                    <td style={s.td}>{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString('en-SG') : 'Never'}</td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button style={{ ...s.btn, padding: '5px 12px', fontSize: '12px', background: k.is_active ? '#fff7ed' : '#f0fdf4', color: k.is_active ? '#ea580c' : '#16a34a', border: `1px solid ${k.is_active ? '#fed7aa' : '#bbf7d0'}` }}
                          onClick={() => handleToggle(k.id, k.is_active)}>
                          {k.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button style={{ ...s.btn, padding: '5px 12px', fontSize: '12px', background: '#fff', color: '#dc2626', border: '1px solid #fecaca' }}
                          onClick={() => handleDelete(k.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Integration Guide */}
        <div style={{ ...s.card, background: '#f8fafc' }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>📡 Integration Guide</div>
          <div style={{ fontSize: '13px', color: '#475569', lineHeight: '1.8' }}>
            <div style={{ marginBottom: '8px' }}><strong>Endpoint:</strong> <code>POST https://app.techchainglobal.com/api/external/orders</code></div>
            <div style={{ marginBottom: '8px' }}><strong>Auth:</strong> <code>Authorization: Bearer YOUR_API_KEY</code></div>
            <div style={{ marginBottom: '8px' }}><strong>Status check:</strong> <code>GET /api/external/orders?order_id=YOUR_ORDER_ID</code></div>
            <div style={{ marginBottom: '16px' }}><strong>Content-Type:</strong> <code>application/json</code></div>
            <div style={{ fontWeight: '600', marginBottom: '6px' }}>Minimum payload (Generic):</div>
            <pre style={{ background: '#1e293b', color: '#e2e8f0', padding: '14px', borderRadius: '8px', fontSize: '12px', overflow: 'auto' }}>{`{
  "item_description": "MacBook Pro 14 inch",
  "pickup_address": "71 Ayer Rajah Crescent, Singapore 139951",
  "pickup_contact": "Warehouse Team",
  "pickup_phone": "+65 6123 4567",
  "delivery_address": "1 Marina Boulevard, Singapore 018989",
  "delivery_contact": "John Tan",
  "delivery_phone": "+65 9123 4567",
  "budget_min": 15,
  "budget_max": 25,
  "external_order_id": "ORD-2026-001"
}`}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
