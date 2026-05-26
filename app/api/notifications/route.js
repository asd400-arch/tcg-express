import { NextResponse } from 'next/server';
import { createNotification } from '../../../lib/notifications';
import { getSession } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { rateLimiters, applyRateLimit } from '../../../lib/rate-limiters';
import { requireString, cleanString } from '../../../lib/validate';

export async function GET(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';

    let query = supabaseAdmin
      .from('express_notifications')
      .select('*')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { count: unreadCount, error: countError } = await supabaseAdmin
      .from('express_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.userId)
      .eq('is_read', false);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items = data || [];
    return NextResponse.json({
      data: items,
      unread_count: unreadCount ?? items.filter((n) => !n.is_read).length,
    });
  } catch (err) {
    console.error('GET /api/notifications error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const blocked = applyRateLimit(rateLimiters.notifications, session.userId);
    if (blocked) return blocked;

    const body = await request.json();

    const titleCheck = requireString(body.title, 'Title', 200);
    if (titleCheck.error) return NextResponse.json({ error: titleCheck.error }, { status: 400 });

    const type = cleanString(body.type, 50) || 'info';
    const message = cleanString(body.message, 1000) || '';

    // Users can only create notifications for themselves (admins can target others)
    let targetUserId = session.userId;
    if (session.role === 'admin' && body.userId) {
      targetUserId = body.userId;
    }

    await createNotification(targetUserId, type, titleCheck.value, message);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
