import { NextResponse } from 'next/server';
import { clearSessionCookie, getSession } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase-server';

export async function POST(request) {
  const session = getSession(request);
  if (session?.userId) {
    await supabaseAdmin
      .from('express_push_subscriptions')
      .delete()
      .eq('user_id', session.userId);
    await supabaseAdmin
      .from('express_users')
      .update({ expo_push_token: null, updated_at: new Date().toISOString() })
      .eq('id', session.userId);
  }
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
