import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth';
import { notify } from '../../../lib/notify';

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, type, category, title, message, emailTemplate, emailData, url } = await request.json();
    if (!userId || !type || !category || !title || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await notify(userId, { type, category, title, message, emailTemplate, emailData, url });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
