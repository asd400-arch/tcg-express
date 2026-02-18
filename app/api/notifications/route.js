import { NextResponse } from 'next/server';
import { createNotification } from '../../../lib/notifications';

export async function POST(request) {
  try {
    const { userId, type, title, message } = await request.json();
    if (!userId || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    await createNotification(userId, type || 'info', title, message || '');
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
