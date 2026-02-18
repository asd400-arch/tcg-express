import { NextResponse } from 'next/server';
import { sendTemplateEmail } from '../../../../lib/send-email';

export async function POST(request) {
  try {
    const { to, type, data } = await request.json();
    if (!to || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    await sendTemplateEmail(to, type, data);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
