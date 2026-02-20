import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token, type, platform } = await request.json();
    if (!token || !type) {
      return NextResponse.json({ error: 'Token and type required' }, { status: 400 });
    }

    if (type === 'expo') {
      // Upsert Expo push token
      const { data: existing } = await supabaseAdmin
        .from('express_push_subscriptions')
        .select('id')
        .eq('user_id', session.userId)
        .eq('expo_token', token)
        .single();

      if (existing) {
        await supabaseAdmin
          .from('express_push_subscriptions')
          .update({ last_used_at: new Date().toISOString(), platform })
          .eq('id', existing.id);
      } else {
        await supabaseAdmin
          .from('express_push_subscriptions')
          .insert([{
            user_id: session.userId,
            type: 'expo',
            expo_token: token,
            platform: platform || 'unknown',
            endpoint: `expo:${token}`,
          }]);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unsupported type' }, { status: 400 });
  } catch (err) {
    console.error('Push register error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
