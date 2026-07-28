import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase-server';

export async function PATCH(req) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { notificationId } = await req.json();
    if (!notificationId) {
      return NextResponse.json({ error: 'Missing notificationId' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('express_notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', session.userId);

    if (error) {
      console.error('Mark notification read error:', error.message);
      return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/notifications/read error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
