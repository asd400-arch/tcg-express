'use client';
// Contract customers: rate cards + monthly invoices (2 Oct 2026)
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import { useToast } from '../../components/Toast';
import useMobile from '../../components/useMobile';

const money = (v) => `S$${Number(v || 0).toFixed(2)}`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function printInvoice(inv) {
  const [y, m] = inv.month.split('-').map(Number);
  const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-SG', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const issue = new Date(Date.UTC(y, m, 1));
  const due = new Date(issue.getTime() + inv.payment_terms_days * 86400000);
  const fmt = (d) => d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const no = `INV-${inv.month.replace('-', '')}-${String(inv.client.id).slice(0, 6).toUpperCase()}`;
  const c = inv.client;
  const rows = inv.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(new Date(l.date).toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore' }))}</td><td>${esc(l.job_number)}</td><td>${esc(l.to)}${l.contact ? `<br><span class="muted">${esc(l.contact)}</span>` : ''}</td><td class="r">${money(l.amount)}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${no}</title><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#1e293b;margin:36px;font-size:12px}
    h1{font-size:22px;margin:0;color:#0c1b35} .muted{color:#64748b} table{width:100%;border-collapse:collapse;margin-top:16px}
    th,td{border-bottom:1px solid #e2e8f0;padding:6px 4px;text-align:left;vertical-align:top} th{background:#f1f5f9}
    .r{text-align:right} .tot td{font-weight:bold;font-size:14px;border-top:2px solid #0c1b35}
    .grid{display:flex;justify-content:space-between;margin-top:18px} @media print{button{display:none}}
  </style></head><body>
    <div class="grid"><div><h1>INVOICE</h1><div class="muted">${no}</div></div>
    <div style="text-align:right"><b>Tech Chain Global Pte Ltd (TCG Express)</b><br>UEN 202005872W<br>21 Tan Quee Lan Street #02-04, Heritage Place, Singapore 188108<br>admin@techchainglobal.com</div></div>
    <div class="grid"><div><b>Bill to</b><br>${esc(c.company_name || c.contact_name)}<br>${c.business_reg_number ? `UEN ${esc(c.business_reg_number)}<br>` : ''}${c.billing_address ? `${esc(c.billing_address)}<br>` : ''}${esc(c.email || '')}</div>
    <div style="text-align:right">Service period: <b>${esc(monthName)}</b><br>Invoice date: ${fmt(issue)}<br>Payment due: <b>${fmt(due)}</b> (${inv.payment_terms_days} days)</div></div>
    <table><thead><tr><th>#</th><th>Date</th><th>Job</th><th>Delivered to</th><th class="r">Amount</th></tr></thead><tbody>${rows}
    <tr class="tot"><td colspan="4">Total — ${inv.drops} deliveries</td><td class="r">${money(inv.total)}</td></tr></tbody></table>
    <p class="muted" style="margin-top:18px">Delivery charges at your contract rate. Thank you for your business.</p>
    <button onclick="window.print()" style="margin-top:12px;padding:8px 16px">Print / Save as PDF</button>
  </body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export default function AdminContractsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const [cards, setCards] = useState([]);
  const [form, setForm] = useState({ client_email: '', label: 'Contract rate', vehicle: 'motorcycle', first_drop_sgd: '', next_drop_sgd: '', driver_pool: 'tcg', payment_terms_days: '14', notes: '' });
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(() => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 7));
  const [invoices, setInvoices] = useState([]);
  const [setupNeeded, setSetupNeeded] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) router.push('/');
  }, [user, loading]);

  const loadCards = async () => {
    const res = await fetch('/api/admin/rate-cards');
    const r = await res.json().catch(() => ({}));
    if (!res.ok) { setSetupNeeded(true); return; }
    setCards(r.data || []);
  };
  const loadInvoices = async (mo = month) => {
    const res = await fetch(`/api/admin/invoices?month=${mo}`);
    const r = await res.json().catch(() => ({}));
    if (res.ok) setInvoices(r.data?.invoices || []);
  };
  useEffect(() => { if (user?.role === 'admin') { loadCards(); loadInvoices(); } }, [user]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/rate-cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(r.error || 'Could not save'); return; }
      toast.success('Rate card saved — the customer can now post contract orders');
      setForm((f) => ({ ...f, client_email: '', first_drop_sgd: '', next_drop_sgd: '', notes: '' }));
      loadCards();
    } finally { setSaving(false); }
  };
  const deactivate = async (id) => {
    if (!confirm('Turn off this rate card? The customer goes back to normal pricing.')) return;
    const res = await fetch('/api/admin/rate-cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, active: false }) });
    if (res.ok) { toast.success('Rate card turned off'); loadCards(); } else toast.error('Could not update');
  };

  if (loading || !user) return null;
  const input = { width: '100%', padding: '9px 11px', borderRadius: '8px', fontSize: '13px', border: '1px solid #e2e8f0', boxSizing: 'border-box' };
  const label = { fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' };
  const card = { background: 'white', borderRadius: '14px', padding: '20px', border: '1px solid #f1f5f9', marginBottom: '18px' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Contracts" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', maxWidth: '1000px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>🧾 Contracts</h1>
        {setupNeeded && <div style={{ ...card, background: '#fffbeb', border: '1px solid #fde68a' }}>Run <code>sql/2026-10-02-driver-pool.sql</code> in Supabase first.</div>}

        <div style={card}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>New rate card</h3>
          <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '2fr 1fr 1fr 1fr', gap: '10px' }}>
            <div><label style={label}>Customer login email</label><input style={input} value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} placeholder="customer@company.com" /></div>
            <div><label style={label}>First drop (S$)</label><input style={input} type="number" step="0.01" value={form.first_drop_sgd} onChange={(e) => setForm({ ...form, first_drop_sgd: e.target.value })} placeholder="8.00" /></div>
            <div><label style={label}>Each additional (S$)</label><input style={input} type="number" step="0.01" value={form.next_drop_sgd} onChange={(e) => setForm({ ...form, next_drop_sgd: e.target.value })} placeholder="7.50" /></div>
            <div><label style={label}>Payment terms (days)</label><input style={input} type="number" value={form.payment_terms_days} onChange={(e) => setForm({ ...form, payment_terms_days: e.target.value })} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr 1fr 2fr', gap: '10px', marginTop: '10px' }}>
            <div><label style={label}>Label</label><input style={input} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
            <div><label style={label}>Vehicle</label>
              <select style={input} value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })}>
                {['motorcycle', 'car', 'mpv', 'van_1_7m', 'van_2_4m', 'lorry_10ft'].map((v) => <option key={v} value={v}>{v}</option>)}
              </select></div>
            <div><label style={label}>Drivers</label>
              <select style={input} value={form.driver_pool} onChange={(e) => setForm({ ...form, driver_pool: e.target.value })}>
                <option value="tcg">TCG fleet (salaried)</option>
                <option value="open">Any on-call driver</option>
              </select></div>
            <div><label style={label}>Notes</label><input style={input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. min 10 drops/day, 12pm first trip" /></div>
          </div>
          <button onClick={save} disabled={saving} style={{ marginTop: '12px', padding: '10px 18px', borderRadius: '9px', border: 'none', background: '#2563eb', color: 'white', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save rate card'}</button>
        </div>

        <div style={card}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '10px' }}>Rate cards</h3>
          {cards.length === 0 ? <p style={{ fontSize: '13px', color: '#64748b' }}>None yet.</p> : (
            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
              <thead><tr style={{ textAlign: 'left', color: '#64748b' }}><th>Customer</th><th>Rate</th><th>Vehicle</th><th>Drivers</th><th>Terms</th><th>Status</th><th /></tr></thead>
              <tbody>{cards.map((c) => (
                <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 0' }}>{c.client?.company_name || c.client?.contact_name}<div style={{ fontSize: '11px', color: '#94a3b8' }}>{c.client?.email}</div></td>
                  <td>{money(c.first_drop_sgd)} / {money(c.next_drop_sgd)}</td>
                  <td>{c.vehicle}</td><td>{c.driver_pool === 'tcg' ? 'TCG fleet' : 'On-call'}</td><td>{c.payment_terms_days} d</td>
                  <td>{c.active ? <span style={{ color: '#166534', fontWeight: 700 }}>Active</span> : <span style={{ color: '#94a3b8' }}>Off</span>}</td>
                  <td>{c.active && <button onClick={() => deactivate(c.id)} style={{ border: '1px solid #e2e8f0', background: 'white', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px' }}>Turn off</button>}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Monthly invoices</h3>
            <input type="month" value={month} onChange={(e) => { setMonth(e.target.value); loadInvoices(e.target.value); }} style={{ ...input, width: 'auto' }} />
          </div>
          {invoices.length === 0 ? <p style={{ fontSize: '13px', color: '#64748b' }}>No completed contract deliveries in {month}.</p> : invoices.map((inv) => (
            <div key={inv.client.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #f1f5f9', gap: '10px' }}>
              <div><strong>{inv.client.company_name || inv.client.contact_name}</strong><div style={{ fontSize: '12px', color: '#64748b' }}>{inv.drops} deliveries · {money(inv.total)} · due {inv.payment_terms_days} days after month end</div></div>
              <button onClick={() => printInvoice(inv)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #0f172a', background: 'white', fontWeight: 700, cursor: 'pointer' }}>Open invoice</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
