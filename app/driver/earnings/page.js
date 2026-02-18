'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import { supabase } from '../../../lib/supabase';
import useMobile from '../../components/useMobile';

export default function DriverEarnings() {
  const { user, loading } = useAuth();
  const m = useMobile();
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({ total: 0, thisMonth: 0, pending: 0, count: 0 });

  useEffect(() => {
    if (!loading && !user) window.location.href = '/login';
    if (!loading && user && user.role !== 'driver') window.location.href = '/';
    if (user && user.role === 'driver') loadData();
  }, [user, loading]);

  const loadData = async () => {
    const { data } = await supabase.from('express_transactions').select('*, job:job_id(job_number, item_description)').eq('driver_id', user.id).order('created_at', { ascending: false });
    const txns = data || [];
    setTransactions(txns);
    const now = new Date();
    const thisMonth = txns.filter(t => { const d = new Date(t.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.payment_status === 'paid'; });
    const pending = txns.filter(t => t.payment_status === 'pending');
    setStats({
      total: txns.filter(t => t.payment_status === 'paid').reduce((s, t) => s + parseFloat(t.driver_payout || 0), 0),
      thisMonth: thisMonth.reduce((s, t) => s + parseFloat(t.driver_payout || 0), 0),
      pending: pending.reduce((s, t) => s + parseFloat(t.driver_payout || 0), 0),
      count: txns.filter(t => t.payment_status === 'paid').length,
    });
  };

  if (loading || !user) return null;
  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Earnings" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>💰 Earnings</h1>
        <div style={{ display: 'grid', gridTemplateColumns: m ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '16px', marginBottom: '25px' }}>
          {[
            { label: 'Total Earned', value: `$${stats.total.toFixed(2)}`, color: '#059669', icon: '💰' },
            { label: 'This Month', value: `$${stats.thisMonth.toFixed(2)}`, color: '#3b82f6', icon: '📅' },
            { label: 'Pending', value: `$${stats.pending.toFixed(2)}`, color: '#f59e0b', icon: '⏳' },
            { label: 'Deliveries', value: stats.count, color: '#8b5cf6', icon: '📦' },
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
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Transaction History</h3>
          {transactions.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No transactions yet</p>
          ) : transactions.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{t.job?.job_number}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>{t.job?.item_description}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(t.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#059669' }}>+${parseFloat(t.driver_payout).toFixed(2)}</div>
                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', background: t.payment_status === 'paid' ? '#f0fdf4' : '#fef9c3', color: t.payment_status === 'paid' ? '#10b981' : '#f59e0b' }}>{t.payment_status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
