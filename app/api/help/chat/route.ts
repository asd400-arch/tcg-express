import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { processChat } from '@/lib/chatbotService';
import { HELP_CONSTANTS } from '@/types/help';

// POST /api/help/chat — send message to AI chatbot
export async function POST(request: Request) {
  try {
    // Auth optional — anonymous users can chat too
    const session = getSession(request);
    const userId = session?.userId || undefined;

    const body = await request.json();
    const { message, session_id } = body;

    // Validate message
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.length > HELP_CONSTANTS.MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message must be under ${HELP_CONSTANTS.MAX_MESSAGE_LENGTH} characters` },
        { status: 400 }
      );
    }

    const result = await processChat(message.trim(), session_id || undefined, userId);

    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error('POST /api/help/chat error:', err);
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    );
  }
}
