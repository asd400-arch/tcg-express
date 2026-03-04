import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { endpoint, keys, userAgent } = await request.json();
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Missing subscription data' }, { status: 400 });
    }

    // Upsert: update keys if endpoint already exists for this user
    const { error } = await supabaseAdmin
      .from('express_push_subscriptions')
      .upsert(
        {
          user_id: session.userId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: userAgent || null,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,endpoint' }
      );

    if (error) {
      console.error('[push/subscribe] Upsert failed:', error.message, error.details, error.hint);
      return NextResponse.json({ error: 'Failed to save subscription', details: error.message }, { status: 500 });
    }

    console.log('[push/subscribe] Saved subscription for user', session.userId, '— endpoint:', endpoint.substring(0, 60));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[push/subscribe] Server error:', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
