'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import useMobile from '../../components/useMobile';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const statusColors = {
  open: '#3b82f6', bidding: '#8b5cf6', assigned: '#f59e0b', pickup_confirmed: '#f59e0b',
  in_transit: '#06b6d4', delivered: '#10b981', confirmed: '#10b981', completed: '#059669', cancelled: '#ef4444',
};

const CATEGORY_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899', '#64748b'];
const URGENCY_COLORS = { standard: '#3b82f6', express: '#f59e0b', urgent: '#ef4444' };

const PERIODS = [
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
  { key: 'all', label: 'All Time' },
];

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

export default function AdminAnalytics() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const m = useMobile();
  const [data, setData] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'admin') router.push('/');
  }, [user, loading]);

  useEffect(() => {
    if (user && user.role === 'admin') loadData();
  }, [user, period]);

  const loadData = async () => {
    setDataLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?period=${period}`);
      const result = await res.json();
      if (res.ok) setData(result);
    } catch (e) {
      console.error('Failed to load analytics:', e);
    }
    setDataLoading(false);
  };

  const handleExportCSV = () => {
    if (!data?.revenueData) return;
    const headers = ['Date', 'Revenue'];
    const rows = data.revenueData.map(r => [r.date, r.revenue]);
    const today = new Date().toISOString().split('T')[0];
    exportCSV(headers, rows, `tcg-revenue-${period}-${today}.csv`);
  };

  if (loading || !user) return <Spinner />;

  const metrics = data?.metrics || [];
  const revenueData = data?.revenueData || [];
  const categoryData = data?.categoryData || [];
  const urgencyData = (data?.urgencyData || []).map(d => ({
    ...d,
    color: URGENCY_COLORS[d.name.toLowerCase()] || '#64748b',
  }));
  const jobStatusData = (data?.jobStatusData || []).map(d => ({
    ...d,
    color: statusColors[d.status] || '#64748b',
  }));
  const topDrivers = data?.topDrivers || [];

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '20px' };
  const pillBase = { padding: '6px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', border: '1px solid', fontFamily: "'Inter', sans-serif", transition: 'all 0.15s' };
  const btnStyle = { padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#3b82f6', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Analytics" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '12px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', margin: 0 }}>Analytics</h1>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                ...pillBase,
                borderColor: period === p.key ? '#3b82f6' : '#e2e8f0',
                background: period === p.key ? '#eff6ff' : 'white',
                color: period === p.key ? '#3b82f6' : '#64748b',
              }}>{p.label}</button>
            ))}
            <button onClick={handleExportCSV} style={btnStyle}>Export CSV</button>
          </div>
        </div>

        {dataLoading ? <Spinner /> : (
          <>
            {/* Key Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: m ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: '16px', marginBottom: '20px' }}>
              {metrics.map((metric, i) => (
                <div key={i} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500', marginBottom: '6px' }}>{metric.label}</div>
                      <div style={{ fontSize: '22px', fontWeight: '800', color: metric.color }}>{metric.value}</div>
                      {metric.change !== null && (
                        <div style={{
                          display: 'inline-block', marginTop: '6px', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                          background: (metric.invert ? metric.change <= 0 : metric.change >= 0) ? '#f0fdf4' : '#fef2f2',
                          color: (metric.invert ? metric.change <= 0 : metric.change >= 0) ? '#059669' : '#ef4444',
                        }}>
                          {metric.change >= 0 ? '+' : ''}{metric.change.toFixed(1)}{metric.suffix || '%'}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '22px' }}>{metric.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Revenue Trend */}
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Revenue Trend</h3>
              {revenueData.length === 0 ? (
                <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px 0' }}>No revenue data for this period</p>
              ) : (
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <LineChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} interval={m ? Math.max(Math.floor(revenueData.length / 5), 1) : Math.max(Math.floor(revenueData.length / 10), 1)} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <Tooltip formatter={(v) => [`$${v}`, 'Commission']} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                      <Line type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Jobs by Category + Urgency */}
            <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: '20px' }}>
              <div style={card}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Jobs by Category</h3>
                {categoryData.length === 0 ? (
                  <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px 0' }}>No category data</p>
                ) : (
                  <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                      <BarChart data={categoryData} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#94a3b8' }} width={80} />
                        <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                          {categoryData.map((_, i) => (
                            <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div style={card}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Jobs by Urgency</h3>
                {urgencyData.length === 0 ? (
                  <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px 0' }}>No urgency data</p>
                ) : (
                  <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={urgencyData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name} (${value})`}>
                          {urgencyData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Jobs by Status + Top Drivers */}
            <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: '20px' }}>
              <div style={card}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Jobs by Status</h3>
                {jobStatusData.length === 0 ? (
                  <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px 0' }}>No job data</p>
                ) : (
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
                )}
              </div>

              <div style={card}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Top Drivers by Deliveries</h3>
                {topDrivers.length === 0 ? (
                  <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px 0' }}>No driver data</p>
                ) : (
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
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
