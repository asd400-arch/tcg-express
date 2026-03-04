import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { sendPushToUser } from '../../../../lib/web-push';
import { supabaseAdmin } from '../../../../lib/supabase-server';

// GET /api/push/test — step-by-step push notification diagnostic
export async function GET(request) {
  const diag = { steps: [] };
  const step = (name, status, data) => {
    diag.steps.push({ step: name, status, ...data });
    console.log(`[push/test] ${name}: ${status}`, data || '');
  };

  try {
    // Step 1: Session
    const session = getSession(request);
    if (!session) {
      step('session', 'FAIL', { error: 'No session — middleware may not be setting x-user-id headers' });
      return NextResponse.json(diag, { status: 401 });
    }
    step('session', 'OK', { userId: session.userId, role: session.role });

    // Step 2: VAPID configuration
    const vapidPublic = !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = !!process.env.VAPID_PRIVATE_KEY;
    if (!vapidPublic || !vapidPrivate) {
      step('vapid', 'FAIL', { NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapidPublic, VAPID_PRIVATE_KEY: vapidPrivate });
      return NextResponse.json(diag, { status: 500 });
    }
    step('vapid', 'OK', { publicKey: vapidPublic, privateKey: vapidPrivate });

    // Step 3: Table existence check
    const { data: tableCheck, error: tableErr } = await supabaseAdmin
      .from('express_push_subscriptions')
      .select('id')
      .limit(1);

    if (tableErr) {
      step('table', 'FAIL', { error: tableErr.message, hint: tableErr.hint, code: tableErr.code });
      return NextResponse.json(diag, { status: 500 });
    }
    step('table', 'OK', { note: 'express_push_subscriptions exists' });

    // Step 4: User subscriptions
    const { data: subs, error: subsErr } = await supabaseAdmin
      .from('express_push_subscriptions')
      .select('id, endpoint, p256dh, auth, type, platform, last_used_at, created_at')
      .eq('user_id', session.userId);

    if (subsErr) {
      step('subscriptions', 'FAIL', { error: subsErr.message });
      return NextResponse.json(diag, { status: 500 });
    }
    if (!subs || subs.length === 0) {
      step('subscriptions', 'EMPTY', {
        error: 'No subscriptions found for this user',
        fix: 'Enable push notifications in Settings > Notification Preferences, or use the push notification banner',
      });
      return NextResponse.json(diag, { status: 404 });
    }
    step('subscriptions', 'OK', {
      count: subs.length,
      details: subs.map(s => ({
        id: s.id,
        type: s.type || 'web',
        platform: s.platform,
        endpoint: s.endpoint?.substring(0, 80) + '...',
        hasP256dh: !!s.p256dh,
        hasAuth: !!s.auth,
        lastUsed: s.last_used_at,
        created: s.created_at,
      })),
    });

    // Step 5: Send test push
    const results = await sendPushToUser(session.userId, {
      title: 'TCG Express Test',
      body: `Push is working! ${new Date().toLocaleTimeString('en-SG', { timeZone: 'Asia/Singapore' })} SGT`,
      url: '/',
    });

    const sent = (results || []).filter(r => r.status === 'fulfilled').length;
    const failed = (results || []).filter(r => r.status === 'rejected').length;
    const errors = (results || []).filter(r => r.status === 'rejected').map(r => ({
      message: r.reason?.message,
      statusCode: r.reason?.statusCode,
      body: r.reason?.body,
    }));

    if (failed > 0 && sent === 0) {
      step('send', 'FAIL', { sent, failed, errors });
    } else {
      step('send', 'OK', { sent, failed, errors: errors.length ? errors : undefined });
    }

    diag.success = sent > 0;
    diag.summary = `${sent} sent, ${failed} failed out of ${subs.length} subscription(s)`;
    return NextResponse.json(diag);
  } catch (err) {
    step('unexpected', 'FAIL', { error: err.message, stack: err.stack?.split('\n').slice(0, 3) });
    return NextResponse.json(diag, { status: 500 });
  }
}
