'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { supabase } from '../../../lib/supabase';
import useMobile from '../../components/useMobile';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DriverEarnings() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const m = useMobile();
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({ total: 0, thisMonth: 0, pending: 0, count: 0 });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'driver') router.push('/');
    if (user && user.role === 'driver') loadData();
  }, [user, loading]);

  const loadData = async () => {
    const { data } = await supabase.from('express_transactions').select('*, job:job_id(job_number, item_description)').eq('driver_id', user.id).order('created_at', { ascending: false });
    const txns = data || [];
    setTransactions(txns);
    const now = new Date();
    const thisMonth = txns.filter(t => { const d = new Date(t.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.payment_status === 'paid'; });
    const pending = txns.filter(t => t.payment_status === 'held');
    setStats({
      total: txns.filter(t => t.payment_status === 'paid').reduce((s, t) => s + parseFloat(t.driver_payout || 0), 0),
      thisMonth: thisMonth.reduce((s, t) => s + parseFloat(t.driver_payout || 0), 0),
      pending: pending.reduce((s, t) => s + parseFloat(t.driver_payout || 0), 0),
      count: txns.filter(t => t.payment_status === 'paid').length,
    });
  };

  const filteredTxns = transactions.filter(t => {
    if (dateFrom && new Date(t.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(t.created_at) > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  const filteredStats = {
    total: filteredTxns.filter(t => t.payment_status === 'paid').reduce((s, t) => s + parseFloat(t.driver_payout || 0), 0),
    thisMonth: (() => { const now = new Date(); return filteredTxns.filter(t => { const d = new Date(t.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.payment_status === 'paid'; }).reduce((s, t) => s + parseFloat(t.driver_payout || 0), 0); })(),
    pending: filteredTxns.filter(t => t.payment_status === 'held').reduce((s, t) => s + parseFloat(t.driver_payout || 0), 0),
    count: filteredTxns.filter(t => t.payment_status === 'paid').length,
  };

  if (loading || !user) return <Spinner />;
  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' };
  const dateInput = { padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', background: '#f8fafc', color: '#1e293b', fontFamily: "'Inter', sans-serif" };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Earnings" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>💰 Earnings</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>From:</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={dateInput} />
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>To:</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={dateInput} />
          {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '12px', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Clear</button>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: m ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '16px', marginBottom: '25px' }}>
          {[
            { label: 'Total Earned', value: `$${filteredStats.total.toFixed(2)}`, color: '#059669', icon: '💰' },
            { label: 'This Month', value: `$${filteredStats.thisMonth.toFixed(2)}`, color: '#3b82f6', icon: '📅' },
            { label: 'In Escrow', value: `$${filteredStats.pending.toFixed(2)}`, color: '#f59e0b', icon: '🔒' },
            { label: 'Deliveries', value: filteredStats.count, color: '#8b5cf6', icon: '📦' },
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
        {/* 7-Day Earnings Chart */}
        {(() => {
          const days = {};
          for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            days[d.toISOString().split('T')[0]] = 0;
          }
          transactions.filter(t => t.payment_status === 'paid').forEach(t => {
            const key = new Date(t.created_at).toISOString().split('T')[0];
            if (days[key] !== undefined) days[key] += parseFloat(t.driver_payout || 0);
          });
          const chartData = Object.entries(days).map(([date, amount]) => ({
            date: new Date(date).toLocaleDateString('en', { weekday: 'short' }),
            earnings: parseFloat(amount.toFixed(2)),
          }));
          return (
            <div style={{ ...card, marginBottom: '25px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Last 7 Days Earnings</h3>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip formatter={(v) => [`$${v}`, 'Earnings']} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                    <Bar dataKey="earnings" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })()}

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
                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', background: t.payment_status === 'paid' ? '#f0fdf4' : '#fffbeb', color: t.payment_status === 'paid' ? '#10b981' : '#d97706' }}>{t.payment_status === 'held' ? 'IN ESCROW' : t.payment_status.toUpperCase()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
