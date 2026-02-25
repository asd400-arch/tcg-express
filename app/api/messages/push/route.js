import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { sendPushToUser } from '../../../../lib/web-push';

// POST: Send push notification when a message is sent
export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { receiverId, senderName, content, jobId } = await request.json();

    if (!receiverId || !content) {
      return NextResponse.json({ error: 'Missing receiverId or content' }, { status: 400 });
    }

    const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;

    await sendPushToUser(receiverId, {
      title: `Message from ${senderName || 'Someone'}`,
      body: preview,
      url: `/client/jobs/${jobId || ''}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Push notification error:', err.message);
    // Non-critical — don't fail the message send
    return NextResponse.json({ ok: false });
  }
}
