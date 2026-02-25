import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { sendPushToUser } from '../../../../lib/web-push';
import { supabaseAdmin } from '../../../../lib/supabase-server';

// GET /api/push/test — send a test push notification to the current user
export async function GET(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check how many subscriptions this user has
    const { data: subs } = await supabaseAdmin
      .from('express_push_subscriptions')
      .select('id, endpoint, type, platform, last_used_at, created_at')
      .eq('user_id', session.userId);

    if (!subs || subs.length === 0) {
      return NextResponse.json({
        error: 'No push subscriptions found for your account. Enable push notifications in Settings first.',
        subscriptions: [],
      }, { status: 404 });
    }

    // Send test notification
    const results = await sendPushToUser(session.userId, {
      title: 'TCG Express Test',
      body: `Push notifications are working! (${new Date().toLocaleTimeString()})`,
      url: '/',
    });

    return NextResponse.json({
      success: true,
      subscriptions: subs.length,
      details: subs.map(s => ({
        type: s.type || 'web',
        platform: s.platform,
        endpoint: s.endpoint?.substring(0, 60) + '...',
        lastUsed: s.last_used_at,
      })),
      results: (results || []).map(r => ({
        status: r.status,
        error: r.reason?.message || null,
      })),
    });
  } catch (err) {
    console.error('Push test error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
