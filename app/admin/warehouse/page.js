'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import { useToast } from '../../components/Toast';
import useMobile from '../../components/useMobile';

const RATE_CATEGORIES = [
  { key: 'storage', label: 'Storage', icon: '📦' },
  { key: 'handling', label: 'Handling', icon: '🏗️' },
  { key: 'pick_pack', label: 'Pick & Pack', icon: '📋' },
  { key: 'value_added', label: 'Value-Added', icon: '✨' },
  { key: 'special', label: 'Special', icon: '🔧' },
];

const UNIT_TYPES = [
  { key: 'per_unit', label: 'Per Unit' },
  { key: 'per_kg', label: 'Per Kg' },
  { key: 'per_cbm', label: 'Per CBM' },
  { key: 'per_pallet', label: 'Per Pallet' },
  { key: 'per_hour', label: 'Per Hour' },
  { key: 'per_order', label: 'Per Order' },
  { key: 'flat', label: 'Flat Fee' },
];

const ORDER_STATUSES = ['draft', 'confirmed', 'processing', 'packed', 'shipped', 'received', 'completed', 'cancelled'];
const STATUS_COLORS = { draft: '#94a3b8', confirmed: '#3b82f6', processing: '#f59e0b', packed: '#8b5cf6', shipped: '#06b6d4', received: '#10b981', completed: '#059669', cancelled: '#ef4444' };
const INVENTORY_STATUS_COLORS = { active: '#10b981', inactive: '#94a3b8', discontinued: '#ef4444', quarantine: '#f59e0b' };

export default function AdminWarehousePage() {
  const { user } = useAuth();
  const toast = useToast();
  const m = useMobile();
  const [tab, setTab] = useState('inventory');

  // Inventory state
  const [inventory, setInventory] = useState([]);
  const [invSearch, setInvSearch] = useState('');
  const [showInvForm, setShowInvForm] = useState(false);
  const [invForm, setInvForm] = useState({ client_id: '', sku: '', product_name: '', category: 'general', quantity: '0', min_stock_level: '10', warehouse_zone: 'A', rack_number: '', barcode: '', unit_cost: '', unit_price: '', weight_kg: '' });
  const [editingInv, setEditingInv] = useState(null);
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustQty, setAdjustQty] = useState('');

  // Orders state
  const [orders, setOrders] = useState([]);
  const [orderFilter, setOrderFilter] = useState('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState('all');

  // Rates state
  const [rates, setRates] = useState([]);
  const [showRateForm, setShowRateForm] = useState(false);
  const [rateForm, setRateForm] = useState({ rate_name: '', rate_category: 'storage', description: '', unit_price: '', unit_type: 'per_unit', sort_order: '0' });
  const [editingRate, setEditingRate] = useState(null);

  // Clients list (for inventory assignment)
  const [clients, setClients] = useState([]);

  useEffect(() => {
    fetchInventory();
    fetchOrders();
    fetchRates();
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const res = await fetch('/api/admin/users?role=client');
    const data = await res.json();
    setClients(data.data || data || []);
  };

  const fetchInventory = async () => {
    const url = invSearch ? `/api/warehouse/inventory?status=all&search=${encodeURIComponent(invSearch)}` : '/api/warehouse/inventory?status=all';
    const res = await fetch(url);
    const data = await res.json();
    setInventory(data.data || []);
  };

  const fetchOrders = async () => {
    let url = '/api/warehouse/orders?';
    if (orderTypeFilter !== 'all') url += `type=${orderTypeFilter}&`;
    if (orderFilter !== 'all') url += `status=${orderFilter}&`;
    const res = await fetch(url);
    const data = await res.json();
    setOrders(data.data || []);
  };

  const fetchRates = async () => {
    const res = await fetch('/api/warehouse/rates?status=all');
    const data = await res.json();
    setRates(data.data || []);
  };

  useEffect(() => { fetchInventory(); }, [invSearch]);
  useEffect(() => { fetchOrders(); }, [orderFilter, orderTypeFilter]);

  // ── Inventory handlers ──
  const handleInvSubmit = async () => {
    if (!invForm.client_id || !invForm.sku || !invForm.product_name) { toast.error('Client, SKU, and product name required'); return; }
    const payload = { ...invForm, quantity: parseInt(invForm.quantity) || 0, min_stock_level: parseInt(invForm.min_stock_level) || 10 };
    if (editingInv) {
      payload.action = 'update'; payload.id = editingInv;
      delete payload.client_id; delete payload.sku;
    } else {
      payload.action = 'create';
    }
    const res = await fetch('/api/warehouse/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) { toast.success(editingInv ? 'Item updated' : 'Item created'); setShowInvForm(false); setEditingInv(null); resetInvForm(); fetchInventory(); }
    else { const err = await res.json(); toast.error(err.error || 'Failed'); }
  };

  const handleAdjust = async () => {
    if (!adjustItem || !adjustQty) return;
    const res = await fetch('/api/warehouse/inventory', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'adjust_stock', id: adjustItem.id, quantity_change: parseInt(adjustQty), reference: 'Manual adjustment' }),
    });
    if (res.ok) { toast.success('Stock adjusted'); setAdjustItem(null); setAdjustQty(''); fetchInventory(); }
    else toast.error('Adjustment failed');
  };

  const startEditInv = (item) => {
    setInvForm({ client_id: item.client_id, sku: item.sku, product_name: item.product_name, category: item.category || 'general', quantity: String(item.quantity), min_stock_level: String(item.min_stock_level || 10), warehouse_zone: item.warehouse_zone || 'A', rack_number: item.rack_number || '', barcode: item.barcode || '', unit_cost: item.unit_cost ? String(item.unit_cost) : '', unit_price: item.unit_price ? String(item.unit_price) : '', weight_kg: item.weight_kg ? String(item.weight_kg) : '' });
    setEditingInv(item.id);
    setShowInvForm(true);
  };

  const resetInvForm = () => setInvForm({ client_id: '', sku: '', product_name: '', category: 'general', quantity: '0', min_stock_level: '10', warehouse_zone: 'A', rack_number: '', barcode: '', unit_cost: '', unit_price: '', weight_kg: '' });

  // ── Order handlers ──
  const handleOrderStatus = async (orderId, status) => {
    const res = await fetch('/api/warehouse/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_status', id: orderId, status }),
    });
    if (res.ok) { toast.success(`Order ${status}`); fetchOrders(); fetchInventory(); }
    else toast.error('Update failed');
  };

  // ── Rate handlers ──
  const handleRateSubmit = async () => {
    if (!rateForm.rate_name || !rateForm.unit_price) { toast.error('Name and price required'); return; }
    const payload = { ...rateForm };
    if (editingRate) { payload.action = 'update'; payload.id = editingRate; }
    else { payload.action = 'create'; }
    const res = await fetch('/api/warehouse/rates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) { toast.success(editingRate ? 'Rate updated' : 'Rate created'); setShowRateForm(false); setEditingRate(null); resetRateForm(); fetchRates(); }
    else toast.error('Failed');
  };

  const handleRateDelete = async (id) => {
    if (!confirm('Delete this rate?')) return;
    const res = await fetch('/api/warehouse/rates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) });
    if (res.ok) { toast.success('Rate deleted'); fetchRates(); } else toast.error('Delete failed');
  };

  const startEditRate = (rate) => {
    setRateForm({ rate_name: rate.rate_name, rate_category: rate.rate_category, description: rate.description || '', unit_price: String(rate.unit_price), unit_type: rate.unit_type, sort_order: String(rate.sort_order || 0) });
    setEditingRate(rate.id);
    setShowRateForm(true);
  };

  const resetRateForm = () => setRateForm({ rate_name: '', rate_category: 'storage', description: '', unit_price: '', unit_type: 'per_unit', sort_order: '0' });

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '16px' };
  const input = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box', marginBottom: '10px' };
  const lbl = { fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px', display: 'block' };
  const badge = (color) => ({ padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '700', background: `${color}15`, color, textTransform: 'uppercase' });

  if (!user || user.role !== 'admin') return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Warehouse" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', maxWidth: '1100px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>Warehouse Management</h1>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: '#f1f5f9', borderRadius: '10px', padding: '4px' }}>
          {[
            { key: 'inventory', label: 'Inventory', icon: '📦' },
            { key: 'orders', label: 'Orders', icon: '📋' },
            { key: 'rates', label: 'Rates', icon: '💲' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: tab === t.key ? 'white' : 'transparent', color: tab === t.key ? '#1e293b' : '#64748b',
              fontSize: '14px', fontWeight: '600', fontFamily: "'Inter', sans-serif",
              boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}>{t.icon} {t.label}</button>
          ))}
        </div>

        {/* ═══ INVENTORY TAB ═══ */}
        {tab === 'inventory' && (
          <>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <input style={{ ...input, flex: 1, minWidth: '200px', marginBottom: 0 }} placeholder="Search SKU, name, barcode..." value={invSearch} onChange={e => setInvSearch(e.target.value)} />
              <button onClick={() => { setShowInvForm(!showInvForm); setEditingInv(null); resetInvForm(); }} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#3b82f6', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap' }}>
                {showInvForm ? 'Cancel' : '+ Add Item'}
              </button>
            </div>

            {showInvForm && (
              <div style={{ ...card, border: '2px solid #3b82f6' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>{editingInv ? 'Edit Item' : 'Add Inventory Item'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: '0 14px' }}>
                  <div><label style={lbl}>Client</label>
                    <select style={input} value={invForm.client_id} onChange={e => setInvForm({ ...invForm, client_id: e.target.value })} disabled={!!editingInv}>
                      <option value="">Select client...</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.company_name || c.contact_name}</option>)}
                    </select>
                  </div>
                  <div><label style={lbl}>SKU</label><input style={input} value={invForm.sku} onChange={e => setInvForm({ ...invForm, sku: e.target.value })} placeholder="e.g. ITEM-001" disabled={!!editingInv} /></div>
                  <div><label style={lbl}>Product Name</label><input style={input} value={invForm.product_name} onChange={e => setInvForm({ ...invForm, product_name: e.target.value })} /></div>
                  <div><label style={lbl}>Category</label><input style={input} value={invForm.category} onChange={e => setInvForm({ ...invForm, category: e.target.value })} placeholder="general" /></div>
                  <div><label style={lbl}>Initial Qty</label><input style={input} type="number" value={invForm.quantity} onChange={e => setInvForm({ ...invForm, quantity: e.target.value })} /></div>
                  <div><label style={lbl}>Min Stock Level</label><input style={input} type="number" value={invForm.min_stock_level} onChange={e => setInvForm({ ...invForm, min_stock_level: e.target.value })} /></div>
                  <div><label style={lbl}>Zone</label><input style={input} value={invForm.warehouse_zone} onChange={e => setInvForm({ ...invForm, warehouse_zone: e.target.value })} placeholder="A" /></div>
                  <div><label style={lbl}>Rack / Shelf</label><input style={input} value={invForm.rack_number} onChange={e => setInvForm({ ...invForm, rack_number: e.target.value })} placeholder="R1-S3" /></div>
                  <div><label style={lbl}>Barcode</label><input style={input} value={invForm.barcode} onChange={e => setInvForm({ ...invForm, barcode: e.target.value })} /></div>
                  <div><label style={lbl}>Weight (kg)</label><input style={input} type="number" step="0.1" value={invForm.weight_kg} onChange={e => setInvForm({ ...invForm, weight_kg: e.target.value })} /></div>
                  <div><label style={lbl}>Unit Cost ($)</label><input style={input} type="number" step="0.01" value={invForm.unit_cost} onChange={e => setInvForm({ ...invForm, unit_cost: e.target.value })} /></div>
                  <div><label style={lbl}>Unit Price ($)</label><input style={input} type="number" step="0.01" value={invForm.unit_price} onChange={e => setInvForm({ ...invForm, unit_price: e.target.value })} /></div>
                </div>
                <button onClick={handleInvSubmit} style={{ padding: '12px 28px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                  {editingInv ? 'Update Item' : 'Add Item'}
                </button>
              </div>
            )}

            {/* Stock adjust modal */}
            {adjustItem && (
              <div style={{ ...card, border: '2px solid #f59e0b', background: '#fffbeb' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#92400e', marginBottom: '10px' }}>Adjust Stock: {adjustItem.sku} — {adjustItem.product_name}</h3>
                <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '10px' }}>Current qty: <strong>{adjustItem.quantity}</strong></div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input style={{ ...input, width: '120px', marginBottom: 0 }} type="number" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} placeholder="+10 or -5" />
                  <button onClick={handleAdjust} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#f59e0b', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Apply</button>
                  <button onClick={() => { setAdjustItem(null); setAdjustQty(''); }} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", color: '#64748b' }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Inventory table */}
            {inventory.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: '40px' }}><p style={{ color: '#64748b' }}>No inventory items. Add your first item above.</p></div>
            ) : (
              <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        {['SKU', 'Product', 'Client', 'Qty', 'Min', 'Zone', 'Status', 'Actions'].map(h => (
                          <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '700', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.map(item => {
                        const lowStock = item.quantity <= (item.min_stock_level || 10);
                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', background: lowStock ? '#fef2f2' : 'white' }}>
                            <td style={{ padding: '12px 14px', fontWeight: '600', color: '#1e293b' }}>{item.sku}</td>
                            <td style={{ padding: '12px 14px', color: '#374151' }}>
                              <div>{item.product_name}</div>
                              {item.barcode && <div style={{ fontSize: '11px', color: '#94a3b8' }}>BC: {item.barcode}</div>}
                            </td>
                            <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '12px' }}>{item.client?.company_name || item.client?.contact_name || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ fontWeight: '700', color: lowStock ? '#ef4444' : '#1e293b' }}>{item.quantity}</span>
                              {lowStock && <span style={{ ...badge('#ef4444'), marginLeft: '6px', fontSize: '9px' }}>LOW</span>}
                            </td>
                            <td style={{ padding: '12px 14px', color: '#64748b' }}>{item.min_stock_level}</td>
                            <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '12px' }}>{item.warehouse_zone}{item.rack_number ? `-${item.rack_number}` : ''}</td>
                            <td style={{ padding: '12px 14px' }}><span style={badge(INVENTORY_STATUS_COLORS[item.status] || '#94a3b8')}>{item.status}</span></td>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button onClick={() => setAdjustItem(item)} style={tinyBtn('#f59e0b')}>Adjust</button>
                                <button onClick={() => startEditInv(item)} style={tinyBtn('#3b82f6')}>Edit</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ ORDERS TAB ═══ */}
        {tab === 'orders' && (
          <>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {['all', 'inbound', 'outbound', 'transfer', 'return'].map(t => (
                <button key={t} onClick={() => setOrderTypeFilter(t)} style={{
                  padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: orderTypeFilter === t ? '#3b82f6' : '#e2e8f0', color: orderTypeFilter === t ? 'white' : '#64748b',
                  fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif", textTransform: 'capitalize',
                }}>{t}</button>
              ))}
              <div style={{ width: '1px', background: '#e2e8f0', margin: '0 4px' }} />
              {['all', 'draft', 'confirmed', 'processing', 'packed', 'shipped', 'completed'].map(s => (
                <button key={s} onClick={() => setOrderFilter(s)} style={{
                  padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: orderFilter === s ? '#10b981' : '#f1f5f9', color: orderFilter === s ? 'white' : '#94a3b8',
                  fontSize: '11px', fontWeight: '600', fontFamily: "'Inter', sans-serif", textTransform: 'capitalize',
                }}>{s}</button>
              ))}
            </div>

            {orders.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: '40px' }}><p style={{ color: '#64748b' }}>No orders found.</p></div>
            ) : orders.map(order => {
              const nextStatusMap = { draft: 'confirmed', confirmed: 'processing', processing: 'packed', packed: order.order_type === 'inbound' ? 'received' : 'shipped', received: 'completed', shipped: 'completed' };
              const nextStatus = nextStatusMap[order.status];
              return (
                <div key={order.id} style={{ ...card, borderLeft: `4px solid ${STATUS_COLORS[order.status] || '#94a3b8'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{order.order_number || '—'}</span>
                        <span style={badge(STATUS_COLORS[order.status] || '#94a3b8')}>{order.status}</span>
                        <span style={{ ...badge(order.order_type === 'inbound' ? '#10b981' : '#3b82f6'), textTransform: 'uppercase' }}>{order.order_type}</span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b' }}>{order.client?.company_name || order.client?.contact_name || '—'}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                        {order.total_items} items | {order.total_quantity} units | ${order.total_amount}
                      </div>
                      {order.expected_date && <div style={{ fontSize: '12px', color: '#94a3b8' }}>Expected: {order.expected_date}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {nextStatus && (
                        <button onClick={() => handleOrderStatus(order.id, nextStatus)} style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: STATUS_COLORS[nextStatus] || '#3b82f6', color: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", textTransform: 'capitalize' }}>
                          {nextStatus}
                        </button>
                      )}
                      {!['completed', 'cancelled'].includes(order.status) && (
                        <button onClick={() => handleOrderStatus(order.id, 'cancelled')} style={tinyBtn('#ef4444')}>Cancel</button>
                      )}
                    </div>
                  </div>
                  {/* Items preview */}
                  {order.items && order.items.length > 0 && (
                    <div style={{ marginTop: '10px', padding: '10px', background: '#f8fafc', borderRadius: '8px' }}>
                      {order.items.slice(0, 3).map((item, i) => (
                        <div key={i} style={{ fontSize: '12px', color: '#475569', display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                          <span>{item.sku || '—'} {item.product_name}</span>
                          <span style={{ fontWeight: '600' }}>x{item.quantity}</span>
                        </div>
                      ))}
                      {order.items.length > 3 && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>+{order.items.length - 3} more items</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* ═══ RATES TAB ═══ */}
        {tab === 'rates' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <button onClick={() => { setShowRateForm(!showRateForm); setEditingRate(null); resetRateForm(); }} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#3b82f6', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                {showRateForm ? 'Cancel' : '+ Add Rate'}
              </button>
            </div>

            {showRateForm && (
              <div style={{ ...card, border: '2px solid #3b82f6' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>{editingRate ? 'Edit Rate' : 'Add Rate'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: '0 14px' }}>
                  <div><label style={lbl}>Rate Name</label><input style={input} value={rateForm.rate_name} onChange={e => setRateForm({ ...rateForm, rate_name: e.target.value })} placeholder="e.g. Standard Storage" /></div>
                  <div><label style={lbl}>Category</label>
                    <select style={input} value={rateForm.rate_category} onChange={e => setRateForm({ ...rateForm, rate_category: e.target.value })}>
                      {RATE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                    </select>
                  </div>
                  <div><label style={lbl}>Unit Price ($)</label><input style={input} type="number" step="0.01" value={rateForm.unit_price} onChange={e => setRateForm({ ...rateForm, unit_price: e.target.value })} /></div>
                  <div><label style={lbl}>Unit Type</label>
                    <select style={input} value={rateForm.unit_type} onChange={e => setRateForm({ ...rateForm, unit_type: e.target.value })}>
                      {UNIT_TYPES.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: m ? 'span 1' : 'span 2' }}><label style={lbl}>Description</label><input style={input} value={rateForm.description} onChange={e => setRateForm({ ...rateForm, description: e.target.value })} placeholder="Brief description" /></div>
                  <div><label style={lbl}>Sort Order</label><input style={input} type="number" value={rateForm.sort_order} onChange={e => setRateForm({ ...rateForm, sort_order: e.target.value })} /></div>
                </div>
                <button onClick={handleRateSubmit} style={{ padding: '12px 28px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                  {editingRate ? 'Update Rate' : 'Add Rate'}
                </button>
              </div>
            )}

            {/* Rates grouped by category */}
            {RATE_CATEGORIES.map(cat => {
              const catRates = rates.filter(r => r.rate_category === cat.key);
              if (catRates.length === 0) return null;
              return (
                <div key={cat.key} style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '10px' }}>{cat.icon} {cat.label}</h3>
                  {catRates.map(rate => (
                    <div key={rate.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: rate.status === 'inactive' ? 0.5 : 1 }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{rate.rate_name}</div>
                        {rate.description && <div style={{ fontSize: '12px', color: '#64748b' }}>{rate.description}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '18px', fontWeight: '700', color: '#059669' }}>${rate.unit_price}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{UNIT_TYPES.find(u => u.key === rate.unit_type)?.label || rate.unit_type}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => startEditRate(rate)} style={tinyBtn('#3b82f6')}>Edit</button>
                          <button onClick={() => handleRateDelete(rate.id)} style={tinyBtn('#ef4444')}>Del</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function tinyBtn(color) {
  return { padding: '4px 10px', borderRadius: '6px', border: `1px solid ${color}`, background: 'white', color, fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" };
}
