import { NextResponse } from 'next/server';
import { Expo } from 'expo-server-sdk';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.role !== 'driver') {
      return NextResponse.json({ error: 'Drivers only' }, { status: 403 });
    }

    const body = await request.json();
    const token = body.token?.trim();
    const platform = body.platform;

    if (!token) {
      return NextResponse.json({ error: 'Push token required' }, { status: 400 });
    }

    if (!Expo.isExpoPushToken(token)) {
      return NextResponse.json({ error: 'Invalid Expo push token' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('express_users')
      .update({
        expo_push_token: token,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.userId)
      .select('id, expo_push_token')
      .single();

    if (error) {
      if (error.message?.includes('expo_push_token')) {
        return NextResponse.json(
          { error: 'expo_push_token column missing — run add_expo_push_token.sql in Supabase' },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: { id: data.id, platform: platform || null, registered: true },
    });
  } catch (err) {
    console.error('POST /api/driver/push-token error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
