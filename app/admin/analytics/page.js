'use client';
import { useState, useEffect, useMemo } from 'react';
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

const CATEGORY_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899', '#64748b'];
const URGENCY_COLORS = { standard: '#3b82f6', express: '#f59e0b', urgent: '#ef4444' };

const PERIODS = [
  { key: '7d', label: '7 Days', days: 7 },
  { key: '30d', label: '30 Days', days: 30 },
  { key: '90d', label: '90 Days', days: 90 },
  { key: 'all', label: 'All Time', days: null },
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
  const [allTxns, setAllTxns] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [allDisputes, setAllDisputes] = useState([]);
  const [topDrivers, setTopDrivers] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'admin') router.push('/');
    if (user && user.role === 'admin') loadData();
  }, [user, loading]);

  const loadData = async () => {
    setDataLoading(true);
    const [txnRes, jobsRes, disputeRes, usersRes] = await Promise.all([
      supabase.from('express_transactions').select('*').order('created_at', { ascending: true }),
      supabase.from('express_jobs').select('id, status, created_at, completed_at, item_category, urgency'),
      supabase.from('express_disputes').select('id, status, created_at'),
      fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'driver' }),
      }).then(r => r.json()),
    ]);

    setAllTxns(txnRes.data || []);
    setAllJobs(jobsRes.data || []);
    setAllDisputes(disputeRes.data || []);

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

  const periodConfig = PERIODS.find(p => p.key === period);

  const { currentTxns, priorTxns, currentJobs, priorJobs } = useMemo(() => {
    const now = new Date();
    const days = periodConfig.days;
    if (!days) {
      return { currentTxns: allTxns, priorTxns: [], currentJobs: allJobs, priorJobs: [] };
    }
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
    const priorCutoff = new Date(cutoff);
    priorCutoff.setDate(priorCutoff.getDate() - days);

    return {
      currentTxns: allTxns.filter(t => new Date(t.created_at) >= cutoff),
      priorTxns: allTxns.filter(t => { const d = new Date(t.created_at); return d >= priorCutoff && d < cutoff; }),
      currentJobs: allJobs.filter(j => new Date(j.created_at) >= cutoff),
      priorJobs: allJobs.filter(j => { const d = new Date(j.created_at); return d >= priorCutoff && d < cutoff; }),
    };
  }, [allTxns, allJobs, period]);

  // Key metrics
  const metrics = useMemo(() => {
    const commission = (txns) => txns.reduce((s, t) => s + parseFloat(t.commission_amount || 0), 0);
    const completionRate = (jobs) => {
      if (!jobs.length) return 0;
      const done = jobs.filter(j => j.status === 'confirmed' || j.status === 'completed').length;
      return (done / jobs.length) * 100;
    };
    const avgFulfillment = (jobs) => {
      const completed = jobs.filter(j => j.completed_at);
      if (!completed.length) return 0;
      const total = completed.reduce((s, j) => s + (new Date(j.completed_at) - new Date(j.created_at)) / 3600000, 0);
      return total / completed.length;
    };
    const pctChange = (curr, prev) => {
      if (!prev || prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / Math.abs(prev)) * 100;
    };

    const currCommission = commission(currentTxns);
    const prevCommission = commission(priorTxns);
    const currJobs = currentJobs.length;
    const prevJobs = priorJobs.length;
    const currCompletion = completionRate(currentJobs);
    const prevCompletion = completionRate(priorJobs);
    const currFulfillment = avgFulfillment(currentJobs);
    const prevFulfillment = avgFulfillment(priorJobs);
    const openDisputes = allDisputes.filter(d => d.status === 'open' || d.status === 'pending').length;

    const showChange = period !== 'all';

    return [
      { label: 'Commission Revenue', value: `$${currCommission.toFixed(2)}`, change: showChange ? pctChange(currCommission, prevCommission) : null, color: '#059669', icon: '💰' },
      { label: 'Total Jobs', value: currJobs, change: showChange ? pctChange(currJobs, prevJobs) : null, color: '#3b82f6', icon: '📦' },
      { label: 'Completion Rate', value: `${currCompletion.toFixed(1)}%`, change: showChange ? (currCompletion - prevCompletion) : null, suffix: 'pts', color: '#8b5cf6', icon: '✅' },
      { label: 'Avg Fulfillment Time', value: `${currFulfillment.toFixed(1)}h`, change: showChange ? pctChange(currFulfillment, prevFulfillment) : null, invert: true, color: '#f59e0b', icon: '⏱' },
      { label: 'Open Disputes', value: openDisputes, change: null, color: '#ef4444', icon: '⚠' },
    ];
  }, [currentTxns, priorTxns, currentJobs, priorJobs, allDisputes, period]);

  // Revenue trend data
  const revenueData = useMemo(() => {
    const days = periodConfig.days;
    const now = new Date();
    if (!days || days <= 90) {
      // Daily buckets
      const numDays = days || Math.max(30, Math.ceil((now - new Date(Math.min(...allTxns.map(t => new Date(t.created_at).getTime()), now.getTime()))) / 86400000));
      const buckets = {};
      for (let i = (days || numDays) - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        buckets[d.toISOString().split('T')[0]] = 0;
      }
      currentTxns.forEach(t => {
        const key = new Date(t.created_at).toISOString().split('T')[0];
        if (buckets[key] !== undefined) buckets[key] += parseFloat(t.commission_amount || 0);
      });
      return Object.entries(buckets).map(([date, amount]) => ({
        date: date.slice(5),
        revenue: parseFloat(amount.toFixed(2)),
      }));
    }
    // Monthly buckets for all time
    const buckets = {};
    allTxns.forEach(t => {
      const d = new Date(t.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets[key] = (buckets[key] || 0) + parseFloat(t.commission_amount || 0);
    });
    return Object.entries(buckets).sort().map(([month, amount]) => ({
      date: month,
      revenue: parseFloat(amount.toFixed(2)),
    }));
  }, [currentTxns, allTxns, period]);

  // Jobs by category
  const categoryData = useMemo(() => {
    const counts = {};
    currentJobs.forEach(j => {
      const cat = j.item_category || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [currentJobs]);

  // Jobs by urgency
  const urgencyData = useMemo(() => {
    const counts = {};
    currentJobs.forEach(j => {
      const u = j.urgency || 'standard';
      counts[u] = (counts[u] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: URGENCY_COLORS[name] || '#64748b',
    }));
  }, [currentJobs]);

  // Jobs by status
  const jobStatusData = useMemo(() => {
    const counts = {};
    currentJobs.forEach(j => { counts[j.status] = (counts[j.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({
      name: status.replace(/_/g, ' '),
      value: count,
      color: statusColors[status] || '#64748b',
    }));
  }, [currentJobs]);

  const handleExportCSV = () => {
    const headers = ['Date', 'Revenue'];
    const rows = revenueData.map(r => [r.date, r.revenue]);
    const today = new Date().toISOString().split('T')[0];
    exportCSV(headers, rows, `tcg-revenue-${period}-${today}.csv`);
  };

  if (loading || !user) return <Spinner />;

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
