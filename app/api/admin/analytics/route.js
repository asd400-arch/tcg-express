import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function GET(request) {
  try {
    const session = getSession(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';

    const periodDays = { '7d': 7, '30d': 30, '90d': 90, all: null };
    const days = periodDays[period] ?? 30;

    const now = new Date();
    const cutoff = days ? new Date(now.getTime() - days * 86400000) : null;
    const priorCutoff = days ? new Date(cutoff.getTime() - days * 86400000) : null;
    const cutoffISO = cutoff?.toISOString();
    const priorCutoffISO = priorCutoff?.toISOString();

    // Run all queries in parallel
    const [txnRes, priorTxnRes, jobsRes, priorJobsRes, allJobsCatRes, allJobsUrgRes, allJobsStatusRes, disputeRes, driversRes] = await Promise.all([
      // Current period transactions
      cutoffISO
        ? supabaseAdmin.from('express_transactions').select('commission_amount, created_at').gte('created_at', cutoffISO)
        : supabaseAdmin.from('express_transactions').select('commission_amount, created_at').order('created_at', { ascending: true }),
      // Prior period transactions
      cutoffISO
        ? supabaseAdmin.from('express_transactions').select('commission_amount').gte('created_at', priorCutoffISO).lt('created_at', cutoffISO)
        : Promise.resolve({ data: [] }),
      // Current period jobs
      cutoffISO
        ? supabaseAdmin.from('express_jobs').select('id, status, created_at, completed_at, item_category, urgency').gte('created_at', cutoffISO)
        : supabaseAdmin.from('express_jobs').select('id, status, created_at, completed_at, item_category, urgency'),
      // Prior period jobs
      cutoffISO
        ? supabaseAdmin.from('express_jobs').select('id, status, created_at, completed_at').gte('created_at', priorCutoffISO).lt('created_at', cutoffISO)
        : Promise.resolve({ data: [] }),
      // Category breakdown (current period)
      cutoffISO
        ? supabaseAdmin.from('express_jobs').select('item_category').gte('created_at', cutoffISO)
        : supabaseAdmin.from('express_jobs').select('item_category'),
      // Urgency breakdown (current period)
      cutoffISO
        ? supabaseAdmin.from('express_jobs').select('urgency').gte('created_at', cutoffISO)
        : supabaseAdmin.from('express_jobs').select('urgency'),
      // Status distribution (current period)
      cutoffISO
        ? supabaseAdmin.from('express_jobs').select('status').gte('created_at', cutoffISO)
        : supabaseAdmin.from('express_jobs').select('status'),
      // Open disputes
      supabaseAdmin.from('express_disputes').select('id').in('status', ['open', 'under_review']),
      // Top drivers
      supabaseAdmin.from('express_users').select('contact_name, total_deliveries, driver_rating').eq('role', 'driver').order('total_deliveries', { ascending: false }).limit(10),
    ]);

    const currentTxns = txnRes.data || [];
    const priorTxns = priorTxnRes.data || [];
    const currentJobs = jobsRes.data || [];
    const priorJobs = priorJobsRes.data || [];

    // Revenue metrics
    const sumCommission = (txns) => txns.reduce((s, t) => s + parseFloat(t.commission_amount || 0), 0);
    const currCommission = sumCommission(currentTxns);
    const prevCommission = sumCommission(priorTxns);

    // Job counts
    const currJobCount = currentJobs.length;
    const prevJobCount = priorJobs.length;

    // Completion rate
    const completionRate = (jobs) => {
      if (!jobs.length) return 0;
      const done = jobs.filter(j => j.status === 'confirmed' || j.status === 'completed').length;
      return (done / jobs.length) * 100;
    };
    const currCompletion = completionRate(currentJobs);
    const prevCompletion = completionRate(priorJobs);

    // Avg fulfillment time
    const avgFulfillment = (jobs) => {
      const completed = jobs.filter(j => j.completed_at);
      if (!completed.length) return 0;
      const total = completed.reduce((s, j) => s + (new Date(j.completed_at) - new Date(j.created_at)) / 3600000, 0);
      return total / completed.length;
    };
    const currFulfillment = avgFulfillment(currentJobs);
    const prevFulfillment = avgFulfillment(priorJobs);

    // Pct change helper
    const pctChange = (curr, prev) => {
      if (!prev || prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / Math.abs(prev)) * 100;
    };
    const showChange = period !== 'all';

    // Revenue trend
    let revenueData = [];
    if (!days || days <= 90) {
      const numDays = days || Math.max(30, currentTxns.length > 0
        ? Math.ceil((now - new Date(currentTxns[0].created_at)) / 86400000)
        : 30);
      const buckets = {};
      for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        buckets[d.toISOString().split('T')[0]] = 0;
      }
      currentTxns.forEach(t => {
        const key = new Date(t.created_at).toISOString().split('T')[0];
        if (buckets[key] !== undefined) buckets[key] += parseFloat(t.commission_amount || 0);
      });
      revenueData = Object.entries(buckets).map(([date, amount]) => ({
        date: date.slice(5),
        revenue: parseFloat(amount.toFixed(2)),
      }));
    } else {
      const buckets = {};
      currentTxns.forEach(t => {
        const d = new Date(t.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        buckets[key] = (buckets[key] || 0) + parseFloat(t.commission_amount || 0);
      });
      revenueData = Object.entries(buckets).sort().map(([month, amount]) => ({
        date: month,
        revenue: parseFloat(amount.toFixed(2)),
      }));
    }

    // Category breakdown
    const categoryCounts = {};
    (allJobsCatRes.data || []).forEach(j => {
      const cat = j.item_category || 'Other';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    const categoryData = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

    // Urgency breakdown
    const urgencyCounts = {};
    (allJobsUrgRes.data || []).forEach(j => {
      const u = j.urgency || 'standard';
      urgencyCounts[u] = (urgencyCounts[u] || 0) + 1;
    });
    const urgencyData = Object.entries(urgencyCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));

    // Status distribution
    const statusCounts = {};
    (allJobsStatusRes.data || []).forEach(j => {
      statusCounts[j.status] = (statusCounts[j.status] || 0) + 1;
    });
    const jobStatusData = Object.entries(statusCounts).map(([status, count]) => ({
      name: status.replace(/_/g, ' '),
      status,
      value: count,
    }));

    // Top drivers
    const topDrivers = (driversRes.data || []).map(d => ({
      name: d.contact_name?.split(' ')[0] || 'Driver',
      deliveries: d.total_deliveries || 0,
      rating: d.driver_rating || 0,
    }));

    // Open disputes count
    const openDisputes = (disputeRes.data || []).length;

    // Build metrics
    const metrics = [
      { label: 'Commission Revenue', value: `$${currCommission.toFixed(2)}`, change: showChange ? pctChange(currCommission, prevCommission) : null, color: '#059669', icon: '\u{1f4b0}' },
      { label: 'Total Jobs', value: currJobCount, change: showChange ? pctChange(currJobCount, prevJobCount) : null, color: '#3b82f6', icon: '\u{1f4e6}' },
      { label: 'Completion Rate', value: `${currCompletion.toFixed(1)}%`, change: showChange ? (currCompletion - prevCompletion) : null, suffix: 'pts', color: '#8b5cf6', icon: '\u2705' },
      { label: 'Avg Fulfillment Time', value: `${currFulfillment.toFixed(1)}h`, change: showChange ? pctChange(currFulfillment, prevFulfillment) : null, invert: true, color: '#f59e0b', icon: '\u23f1' },
      { label: 'Open Disputes', value: openDisputes, change: null, color: '#ef4444', icon: '\u26a0' },
    ];

    return NextResponse.json({
      metrics,
      revenueData,
      categoryData,
      urgencyData,
      jobStatusData,
      topDrivers,
    });
  } catch (err) {
    console.error('Analytics API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
