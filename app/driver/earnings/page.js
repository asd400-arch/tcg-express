'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { supabase } from '../../../lib/supabase';
import useMobile from '../../components/useMobile';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

export default function DriverEarnings() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const m = useMobile();
  const [transactions, setTransactions] = useState([]);
  const [bids, setBids] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'driver') router.push('/');
    if (user && user.role === 'driver') loadData();
  }, [user, loading]);

  const loadData = async () => {
    const [txnRes, bidsRes, jobsRes] = await Promise.all([
      supabase.from('express_transactions').select('*, job:job_id(job_number, item_description)').eq('driver_id', user.id).order('created_at', { ascending: false }),
      supabase.from('express_bids').select('id, status').eq('driver_id', user.id),
      supabase.from('express_jobs').select('id, status, created_at, completed_at').eq('driver_id', user.id),
    ]);
    setTransactions(txnRes.data || []);
    setBids(bidsRes.data || []);
    setJobs(jobsRes.data || []);
  };

  const filteredTxns = transactions.filter(t => {
    if (dateFrom && new Date(t.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(t.created_at) > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  const stats = useMemo(() => {
    const now = new Date();
    const paid = filteredTxns.filter(t => t.payment_status === 'paid');
    const thisMonth = paid.filter(t => { const d = new Date(t.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
    const pending = filteredTxns.filter(t => t.payment_status === 'held');

    const acceptedBids = bids.filter(b => b.status === 'accepted').length;
    const totalBids = bids.length;
    const acceptanceRate = totalBids > 0 ? (acceptedBids / totalBids * 100) : 0;

    const completedJobs = jobs.filter(j => j.completed_at);
    const avgFulfillment = completedJobs.length > 0
      ? completedJobs.reduce((s, j) => s + (new Date(j.completed_at) - new Date(j.created_at)) / 3600000, 0) / completedJobs.length
      : 0;

    return {
      total: paid.reduce((s, t) => s + parseFloat(t.driver_payout || 0), 0),
      thisMonth: thisMonth.reduce((s, t) => s + parseFloat(t.driver_payout || 0), 0),
      pending: pending.reduce((s, t) => s + parseFloat(t.driver_payout || 0), 0),
      count: paid.length,
      acceptanceRate,
      avgFulfillment,
    };
  }, [filteredTxns, bids, jobs]);

  // 6-month earnings chart
  const monthlyData = useMemo(() => {
    const now = new Date();
    const buckets = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets[key] = 0;
    }
    transactions.filter(t => t.payment_status === 'paid').forEach(t => {
      const d = new Date(t.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (buckets[key] !== undefined) buckets[key] += parseFloat(t.driver_payout || 0);
    });
    return Object.entries(buckets).map(([month, amount]) => ({
      month: new Date(month + '-01').toLocaleDateString('en', { month: 'short' }),
      earnings: parseFloat(amount.toFixed(2)),
    }));
  }, [transactions]);

  const handleExportCSV = () => {
    const headers = ['Date', 'Job #', 'Description', 'Payout', 'Status'];
    const rows = filteredTxns.map(t => [
      new Date(t.created_at).toLocaleDateString(),
      t.job?.job_number || '',
      t.job?.item_description || '',
      parseFloat(t.driver_payout || 0).toFixed(2),
      t.payment_status,
    ]);
    const today = new Date().toISOString().split('T')[0];
    exportCSV(headers, rows, `tcg-earnings-${today}.csv`);
  };

  if (loading || !user) return <Spinner />;
  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' };
  const dateInput = { padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', background: '#f8fafc', color: '#1e293b', fontFamily: "'Inter', sans-serif" };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Earnings" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>Earnings</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>From:</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={dateInput} />
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>To:</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={dateInput} />
          {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '12px', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Clear</button>}
          <button onClick={handleExportCSV} style={{ padding: '6px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#3b82f6', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", marginLeft: 'auto' }}>Export CSV</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: m ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '16px', marginBottom: '25px' }}>
          {[
            { label: 'Total Earned', value: `$${stats.total.toFixed(2)}`, color: '#059669', icon: '💰' },
            { label: 'This Month', value: `$${stats.thisMonth.toFixed(2)}`, color: '#3b82f6', icon: '📅' },
            { label: 'In Escrow', value: `$${stats.pending.toFixed(2)}`, color: '#f59e0b', icon: '🔒' },
            { label: 'Deliveries', value: stats.count, color: '#8b5cf6', icon: '📦' },
            { label: 'Acceptance Rate', value: `${stats.acceptanceRate.toFixed(1)}%`, color: '#10b981', icon: '✅' },
            { label: 'Avg Fulfillment Time', value: `${stats.avgFulfillment.toFixed(1)}h`, color: '#06b6d4', icon: '⏱' },
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

        {/* 6-Month Earnings Chart */}
        <div style={{ ...card, marginBottom: '25px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Monthly Earnings (Last 6 Months)</h3>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip formatter={(v) => [`$${v}`, 'Earnings']} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                <Bar dataKey="earnings" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Transaction History</h3>
          {filteredTxns.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No transactions found</p>
          ) : filteredTxns.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{t.job?.job_number}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>{t.job?.item_description}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(t.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#059669' }}>+${parseFloat(t.driver_payout).toFixed(2)}</div>
                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', background: t.payment_status === 'paid' ? '#f0fdf4' : t.payment_status === 'refunded' ? '#fef2f2' : '#fffbeb', color: t.payment_status === 'paid' ? '#10b981' : t.payment_status === 'refunded' ? '#ef4444' : '#d97706' }}>{t.payment_status === 'held' ? 'IN ESCROW' : t.payment_status === 'refunded' ? 'REFUNDED' : t.payment_status.toUpperCase()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
