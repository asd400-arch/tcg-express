import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function GET(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'driver') {
      return NextResponse.json({ error: 'Drivers only' }, { status: 403 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    const [userRes, txnRes, activeRes, completedRes] = await Promise.all([
      supabaseAdmin
        .from('express_users')
        .select('driver_rating')
        .eq('id', session.userId)
        .single(),
      supabaseAdmin
        .from('express_transactions')
        .select('driver_payout')
        .eq('driver_id', session.userId)
        .eq('payment_status', 'paid')
        .gte('created_at', todayIso),
      supabaseAdmin
        .from('express_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_driver_id', session.userId)
        .in('status', ['assigned', 'pickup_confirmed', 'in_transit']),
      supabaseAdmin
        .from('express_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_driver_id', session.userId)
        .in('status', ['confirmed', 'completed'])
        .gte('completed_at', todayIso),
    ]);

    const todayEarnings = (txnRes.data || []).reduce(
      (sum, t) => sum + (parseFloat(t.driver_payout) || 0),
      0,
    );

    return NextResponse.json({
      data: {
        todayEarnings,
        activeJobs: activeRes.count ?? 0,
        completed: completedRes.count ?? 0,
        rating: parseFloat(userRes.data?.driver_rating) || 5.0,
      },
    });
  } catch (err) {
    console.error('GET /api/driver/stats error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
