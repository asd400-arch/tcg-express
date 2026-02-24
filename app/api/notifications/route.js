import { NextResponse } from 'next/server';
import { createNotification } from '../../../lib/notifications';
import { getSession } from '../../../lib/auth';
import { rateLimiters, applyRateLimit } from '../../../lib/rate-limiters';
import { requireString, cleanString } from '../../../lib/validate';

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
