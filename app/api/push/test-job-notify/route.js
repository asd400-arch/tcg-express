import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { sendPushToUser } from '../../../../lib/web-push';
import { supabaseAdmin } from '../../../../lib/supabase-server';

// GET /api/push/test-job-notify — simulate new job push to all active drivers
// Admin only. Tests the exact same push pipeline used in POST /api/jobs
export async function GET(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    console.log('[test-job-notify] Starting simulated job push notification test...');

    // Step 1: Query all active drivers (same as job creation route)
    const { data: drivers, error: driverErr } = await supabaseAdmin
      .from('express_users')
      .select('id, contact_name, vehicle_type')
      .eq('role', 'driver')
      .eq('is_active', true);

    if (driverErr) {
      console.error('[test-job-notify] Failed to query drivers:', driverErr.message);
      return NextResponse.json({ error: 'Failed to query drivers', details: driverErr.message }, { status: 500 });
    }

    console.log(`[test-job-notify] Found ${drivers?.length || 0} active drivers`);

    if (!drivers || drivers.length === 0) {
      return NextResponse.json({ error: 'No active drivers found', drivers: 0 }, { status: 404 });
    }

    // Step 2: Check subscriptions for each driver
    const { data: allSubs, error: subsErr } = await supabaseAdmin
      .from('express_push_subscriptions')
      .select('user_id, type, platform, endpoint')
      .in('user_id', drivers.map(d => d.id));

    if (subsErr) {
      console.error('[test-job-notify] Failed to query subscriptions:', subsErr.message);
    }

    const subsByDriver = {};
    (allSubs || []).forEach(s => {
      if (!subsByDriver[s.user_id]) subsByDriver[s.user_id] = [];
      subsByDriver[s.user_id].push({ type: s.type, platform: s.platform, endpoint: s.endpoint?.substring(0, 50) });
    });

    console.log(`[test-job-notify] Total push subscriptions found: ${allSubs?.length || 0}`);
    console.log(`[test-job-notify] Drivers with subscriptions: ${Object.keys(subsByDriver).length} / ${drivers.length}`);

    // Step 3: Send test push to each driver (same payload format as real jobs)
    const testBody = 'JOB-TEST - Clementi → Tampines - $50-$80';
    const pushResults = await Promise.allSettled(
      drivers.map(d =>
        sendPushToUser(d.id, {
          title: 'New Job Available',
          body: testBody,
          url: '/driver/jobs',
        })
      )
    );

    const driverResults = drivers.map((d, i) => ({
      id: d.id,
      name: d.contact_name,
      vehicle: d.vehicle_type,
      subscriptions: subsByDriver[d.id]?.length || 0,
      subTypes: subsByDriver[d.id]?.map(s => s.type) || [],
      pushResult: pushResults[i].status,
      pushError: pushResults[i].reason?.message || null,
    }));

    const succeeded = pushResults.filter(r => r.status === 'fulfilled').length;
    const failed = pushResults.filter(r => r.status === 'rejected').length;

    console.log(`[test-job-notify] Push results: ${succeeded} fulfilled, ${failed} rejected`);

    return NextResponse.json({
      success: true,
      summary: {
        totalDrivers: drivers.length,
        driversWithSubs: Object.keys(subsByDriver).length,
        totalSubscriptions: allSubs?.length || 0,
        pushSent: succeeded,
        pushFailed: failed,
      },
      drivers: driverResults,
    });
  } catch (err) {
    console.error('[test-job-notify] Error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
