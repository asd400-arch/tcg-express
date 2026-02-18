'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { supabase } from '../../../lib/supabase';
import useMobile from '../../components/useMobile';

const exportCSV = (headers, rows, filename) => {
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export default function AdminTransactions() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const m = useMobile();
  const [txns, setTxns] = useState([]);
  const [stats, setStats] = useState({ total: 0, commission: 0, payouts: 0, escrow: 0, count: 0 });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'admin') router.push('/');
    if (user && user.role === 'admin') loadData();
  }, [user, loading]);

  const loadData = async () => {
    const { data } = await supabase.from('express_transactions').select('*, job:job_id(job_number, item_description), client:client_id(contact_name, company_name), driver:driver_id(contact_name)').order('created_at', { ascending: false });
    setTxns(data || []);
  };

  const filteredTxns = txns.filter(t => {
    if (dateFrom && new Date(t.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(t.created_at) > new Date(dateTo + 'T23:59:59')) return false;
    if (statusFilter !== 'all' && t.payment_status !== statusFilter) return false;
    return true;
  });

  const filteredStats = {
    total: filteredTxns.reduce((s, x) => s + parseFloat(x.total_amount || 0), 0),
    commission: filteredTxns.reduce((s, x) => s + parseFloat(x.commission_amount || 0), 0),
    payouts: filteredTxns.reduce((s, x) => s + parseFloat(x.driver_payout || 0), 0),
    escrow: txns.filter(t => t.payment_status === 'held').reduce((s, x) => s + parseFloat(x.total_amount || 0), 0),
    count: filteredTxns.length,
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Job #', 'Client', 'Driver', 'Total', 'Commission', 'Driver Payout', 'Status'];
    const rows = filteredTxns.map(t => [
      new Date(t.created_at).toLocaleDateString(),
      t.job?.job_number || '',
      t.client?.company_name || t.client?.contact_name || '',
      t.driver?.contact_name || '',
      parseFloat(t.total_amount || 0).toFixed(2),
      parseFloat(t.commission_amount || 0).toFixed(2),
      parseFloat(t.driver_payout || 0).toFixed(2),
      t.payment_status,
    ]);
    const today = new Date().toISOString().split('T')[0];
    exportCSV(headers, rows, `tcg-transactions-${today}.csv`);
  };

  if (loading || !user) return <Spinner />;
  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' };
  const dateInput = { padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', background: '#f8fafc', color: '#1e293b', fontFamily: "'Inter', sans-serif" };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Transactions" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>💳 All Transactions</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>From:</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={dateInput} />
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>To:</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={dateInput} />
          {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '12px', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Clear</button>}
          <button onClick={handleExportCSV} style={{ padding: '6px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#3b82f6', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", marginLeft: 'auto' }}>Export CSV</button>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {['all', 'held', 'paid', 'refunded'].map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} style={{
              padding: '6px 16px', borderRadius: '8px', border: '1px solid ' + (statusFilter === f ? '#3b82f6' : '#e2e8f0'),
              background: statusFilter === f ? '#eff6ff' : 'white', color: statusFilter === f ? '#3b82f6' : '#64748b',
              fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", textTransform: 'capitalize',
            }}>{f === 'held' ? 'In Escrow' : f}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: m ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: '16px', marginBottom: '25px' }}>
          {[
            { label: 'Total Volume', value: `$${filteredStats.total.toFixed(2)}`, color: '#3b82f6', icon: '💰' },
            { label: 'Commission Earned', value: `$${filteredStats.commission.toFixed(2)}`, color: '#059669', icon: '🎯' },
            { label: 'Driver Payouts', value: `$${filteredStats.payouts.toFixed(2)}`, color: '#f59e0b', icon: '🚗' },
            { label: 'In Escrow', value: `$${filteredStats.escrow.toFixed(2)}`, color: '#d97706', icon: '🔒' },
            { label: 'Total Transactions', value: filteredStats.count, color: '#8b5cf6', icon: '📊' },
          ].map((s, i) => (
            <div key={i} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', marginBottom: '6px' }}>{s.label}</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: s.color }}>{s.value}</div>
                </div>
                <span style={{ fontSize: '24px' }}>{s.icon}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={card}>
          {filteredTxns.map(t => (
            <div key={t.id} style={{ padding: '14px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{t.job?.job_number}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Client: {t.client?.company_name || t.client?.contact_name} → Driver: {t.driver?.contact_name}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(t.created_at).toLocaleString()}</div>
                {t.held_at && <div style={{ fontSize: '11px', color: '#d97706' }}>Held: {new Date(t.held_at).toLocaleString()}</div>}
                {t.released_at && <div style={{ fontSize: '11px', color: '#059669' }}>Released: {new Date(t.released_at).toLocaleString()}</div>}
                {t.refunded_at && <div style={{ fontSize: '11px', color: '#ef4444' }}>Refunded: {new Date(t.refunded_at).toLocaleString()}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>${parseFloat(t.total_amount).toFixed(2)}</div>
                <div style={{ fontSize: '11px', color: '#059669' }}>Commission: ${parseFloat(t.commission_amount).toFixed(2)}</div>
                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', background: t.payment_status === 'paid' ? '#f0fdf4' : t.payment_status === 'refunded' ? '#fef2f2' : '#fffbeb', color: t.payment_status === 'paid' ? '#10b981' : t.payment_status === 'refunded' ? '#ef4444' : '#d97706' }}>{t.payment_status === 'held' ? 'HELD' : t.payment_status === 'refunded' ? 'REFUNDED' : t.payment_status.toUpperCase()}</span>
              </div>
            </div>
          ))}
          {filteredTxns.length === 0 && <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No transactions found</p>}
        </div>
      </div>
    </div>
  );
}
