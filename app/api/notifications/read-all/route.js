import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase-server';

export async function PATCH(req) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('express_notifications')
      .update({ is_read: true })
      .eq('user_id', session.userId)
      .eq('is_read', false)
      .select('id');

    if (error) {
      console.error('Mark all notifications read error:', error.message);
      return NextResponse.json({ error: 'Failed to mark all as read' }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: data?.length ?? 0 });
  } catch (err) {
    console.error('PATCH /api/notifications/read-all error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
