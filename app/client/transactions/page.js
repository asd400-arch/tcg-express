'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { supabase } from '../../../lib/supabase';
import useMobile from '../../components/useMobile';
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CATEGORY_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899', '#64748b'];

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

export default function ClientTransactions() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const m = useMobile();
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'client') router.push('/');
    if (user && user.role === 'client') loadData();
  }, [user, loading]);

  const loadData = async () => {
    const { data } = await supabase.from('express_transactions').select('*, job:job_id(job_number, item_description, item_category)').eq('client_id', user.id).order('created_at', { ascending: false });
    setTransactions(data || []);
  };

  const displayed = filter === 'all' ? transactions : transactions.filter(t => t.payment_status === filter);

  const stats = useMemo(() => {
    const now = new Date();
    const paid = transactions.filter(t => t.payment_status === 'paid');
    const totalSpent = paid.reduce((s, t) => s + parseFloat(t.total_amount || 0), 0);
    const thisMonth = paid.filter(t => { const d = new Date(t.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).reduce((s, t) => s + parseFloat(t.total_amount || 0), 0);
    const escrow = transactions.filter(t => t.payment_status === 'held').reduce((s, t) => s + parseFloat(t.total_amount || 0), 0);
    const avgPerDelivery = paid.length > 0 ? totalSpent / paid.length : 0;
    const categories = new Set(transactions.map(t => t.job?.item_category).filter(Boolean));

    return {
      total: totalSpent,
      thisMonth,
      escrow,
      count: transactions.length,
      avgPerDelivery,
      categoriesUsed: categories.size,
    };
  }, [transactions]);

  // 6-month spending chart
  const monthlyData = useMemo(() => {
    const now = new Date();
    const buckets = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets[key] = 0;
    }
    transactions.forEach(t => {
      const d = new Date(t.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (buckets[key] !== undefined) buckets[key] += parseFloat(t.total_amount || 0);
    });
    return Object.entries(buckets).map(([month, amount]) => ({
      month: new Date(month + '-01').toLocaleDateString('en', { month: 'short' }),
      spending: parseFloat(amount.toFixed(2)),
    }));
  }, [transactions]);

  // Spending by category
  const categoryData = useMemo(() => {
    const sums = {};
    transactions.forEach(t => {
      const cat = t.job?.item_category || 'Other';
      sums[cat] = (sums[cat] || 0) + parseFloat(t.total_amount || 0);
    });
    return Object.entries(sums).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2)),
    }));
  }, [transactions]);

  const handleExportCSV = () => {
    const headers = ['Date', 'Job #', 'Description', 'Category', 'Amount', 'Status'];
    const rows = displayed.map(t => [
      new Date(t.created_at).toLocaleDateString(),
      t.job?.job_number || '',
      t.job?.item_description || '',
      t.job?.item_category || '',
      parseFloat(t.total_amount || 0).toFixed(2),
      t.payment_status,
    ]);
    const today = new Date().toISOString().split('T')[0];
    exportCSV(headers, rows, `tcg-spending-${today}.csv`);
  };

  if (loading || !user) return <Spinner />;
  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Transactions" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>Transactions</h1>
        <div style={{ display: 'grid', gridTemplateColumns: m ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '16px', marginBottom: '25px' }}>
          {[
            { label: 'Total Spent', value: `$${stats.total.toFixed(2)}`, color: '#3b82f6', icon: '💳' },
            { label: 'This Month', value: `$${stats.thisMonth.toFixed(2)}`, color: '#f59e0b', icon: '📅' },
            { label: 'In Escrow', value: `$${stats.escrow.toFixed(2)}`, color: '#d97706', icon: '🔒' },
            { label: 'Deliveries', value: stats.count, color: '#10b981', icon: '📦' },
            { label: 'Avg per Delivery', value: `$${stats.avgPerDelivery.toFixed(2)}`, color: '#8b5cf6', icon: '📊' },
            { label: 'Categories Used', value: stats.categoriesUsed, color: '#06b6d4', icon: '🏷' },
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

        {/* Filter + Export */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {['all', 'held', 'paid', 'refunded'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 16px', borderRadius: '8px', border: '1px solid ' + (filter === f ? '#3b82f6' : '#e2e8f0'),
              background: filter === f ? '#eff6ff' : 'white', color: filter === f ? '#3b82f6' : '#64748b',
              fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", textTransform: 'capitalize',
            }}>{f === 'held' ? 'In Escrow' : f}</button>
          ))}
          <button onClick={handleExportCSV} style={{ padding: '6px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#3b82f6', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", marginLeft: 'auto' }}>Export CSV</button>
        </div>

        {/* 6-Month Spending Chart */}
        <div style={{ ...card, marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Monthly Spending (Last 6 Months)</h3>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip formatter={(v) => [`$${v}`, 'Spent']} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                <Line type="monotone" dataKey="spending" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Spending by Category */}
        {categoryData.length > 0 && (
          <div style={{ ...card, marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Spending by Category</h3>
            <div style={{ width: '100%', height: Math.max(200, categoryData.length * 40) }}>
              <ResponsiveContainer>
                <BarChart data={categoryData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#94a3b8' }} width={80} />
                  <Tooltip formatter={(v) => [`$${v}`, 'Spent']} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Payment History</h3>
          {displayed.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No transactions found</p>
          ) : displayed.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{t.job?.job_number}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>{t.job?.item_description}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(t.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>${parseFloat(t.total_amount).toFixed(2)}</div>
                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', background: t.payment_status === 'paid' ? '#f0fdf4' : t.payment_status === 'refunded' ? '#fef2f2' : '#fffbeb', color: t.payment_status === 'paid' ? '#10b981' : t.payment_status === 'refunded' ? '#ef4444' : '#d97706' }}>{t.payment_status === 'held' ? 'HELD' : t.payment_status === 'refunded' ? 'REFUNDED' : t.payment_status.toUpperCase()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
