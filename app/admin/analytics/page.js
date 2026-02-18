'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { supabase } from '../../../lib/supabase';
import useMobile from '../../components/useMobile';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const statusColors = {
  open: '#3b82f6', bidding: '#8b5cf6', assigned: '#f59e0b', pickup_confirmed: '#f59e0b',
  in_transit: '#06b6d4', delivered: '#10b981', confirmed: '#10b981', completed: '#059669', cancelled: '#ef4444',
};

export default function AdminAnalytics() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const m = useMobile();
  const [revenueData, setRevenueData] = useState([]);
  const [jobStatusData, setJobStatusData] = useState([]);
  const [topDrivers, setTopDrivers] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'admin') router.push('/');
    if (user && user.role === 'admin') loadData();
  }, [user, loading]);

  const loadData = async () => {
    setDataLoading(true);
    const [txnRes, jobsRes, usersRes] = await Promise.all([
      supabase.from('express_transactions').select('*').order('created_at', { ascending: true }),
      supabase.from('express_jobs').select('status'),
      fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, role: 'driver' }),
      }).then(r => r.json()),
    ]);

    // Revenue over time - last 30 days
    const txns = txnRes.data || [];
    const now = new Date();
    const days = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      days[key] = 0;
    }
    txns.forEach(t => {
      const key = new Date(t.created_at).toISOString().split('T')[0];
      if (days[key] !== undefined) {
        days[key] += parseFloat(t.commission_amount || 0);
      }
    });
    setRevenueData(Object.entries(days).map(([date, amount]) => ({
      date: date.slice(5), // MM-DD
      revenue: parseFloat(amount.toFixed(2)),
    })));

    // Jobs by status
    const jobs = jobsRes.data || [];
    const statusCount = {};
    jobs.forEach(j => {
      statusCount[j.status] = (statusCount[j.status] || 0) + 1;
    });
    setJobStatusData(Object.entries(statusCount).map(([status, count]) => ({
      name: status.replace(/_/g, ' '),
      value: count,
      color: statusColors[status] || '#64748b',
    })));

    // Top 10 drivers by total_deliveries
    const drivers = (usersRes.data || [])
      .sort((a, b) => (b.total_deliveries || 0) - (a.total_deliveries || 0))
      .slice(0, 10);
    setTopDrivers(drivers.map(d => ({
      name: d.contact_name?.split(' ')[0] || 'Driver',
      deliveries: d.total_deliveries || 0,
      rating: d.driver_rating || 0,
    })));

    setDataLoading(false);
  };

  if (loading || !user) return <Spinner />;

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '20px' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Analytics" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '25px' }}>📈 Analytics</h1>

        {dataLoading ? <Spinner /> : (
          <>
            {/* Revenue Chart */}
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Revenue Over Time (Last 30 Days)</h3>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} interval={m ? 6 : 3} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip formatter={(v) => [`$${v}`, 'Commission']} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                    <Line type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: '20px' }}>
              {/* Jobs by Status */}
              <div style={card}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Jobs by Status</h3>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={jobStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name} (${value})`}>
                        {jobStatusData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top Drivers */}
              <div style={card}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Top Drivers by Deliveries</h3>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart data={topDrivers}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                      <Bar dataKey="deliveries" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
