'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { supabase } from '../../../lib/supabase';
import useMobile from '../../components/useMobile';

export default function ClientTransactions() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const m = useMobile();
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({ total: 0, thisMonth: 0, count: 0 });

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'client') router.push('/');
    if (user && user.role === 'client') loadData();
  }, [user, loading]);

  const loadData = async () => {
    const { data } = await supabase.from('express_transactions').select('*, job:job_id(job_number, item_description)').eq('client_id', user.id).order('created_at', { ascending: false });
    const txns = data || [];
    setTransactions(txns);
    const now = new Date();
    setStats({
      total: txns.reduce((s, t) => s + parseFloat(t.total_amount || 0), 0),
      thisMonth: txns.filter(t => { const d = new Date(t.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).reduce((s, t) => s + parseFloat(t.total_amount || 0), 0),
      count: txns.length,
    });
  };

  if (loading || !user) return <Spinner />;
  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Transactions" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>💳 Transactions</h1>
        <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '16px', marginBottom: '25px' }}>
          {[
            { label: 'Total Spent', value: `$${stats.total.toFixed(2)}`, color: '#3b82f6', icon: '💳' },
            { label: 'This Month', value: `$${stats.thisMonth.toFixed(2)}`, color: '#f59e0b', icon: '📅' },
            { label: 'Deliveries', value: stats.count, color: '#10b981', icon: '📦' },
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
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Payment History</h3>
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
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>${parseFloat(t.total_amount).toFixed(2)}</div>
                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', background: t.payment_status === 'paid' ? '#f0fdf4' : '#fef9c3', color: t.payment_status === 'paid' ? '#10b981' : '#f59e0b' }}>{t.payment_status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
