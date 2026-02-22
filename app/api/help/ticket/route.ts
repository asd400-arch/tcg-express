import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createSupportTicket } from '@/lib/chatbotService';

// POST /api/help/ticket — create support ticket
export async function POST(request: Request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Please log in to create a support ticket' }, { status: 401 });
    }

    const body = await request.json();
    const { subject, description, category, priority, contact_email, chat_session_id } = body;

    // Validate required fields
    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }

    if (!description || typeof description !== 'string' || !description.trim()) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    const ticket = await createSupportTicket({
      user_id: session.userId,
      subject: subject.trim(),
      description: description.trim(),
      category: category || undefined,
      priority: priority || undefined,
      contact_email: contact_email || undefined,
      chat_session_id: chat_session_id || undefined,
    });

    return NextResponse.json({
      data: {
        ticket_number: ticket.ticket_number,
        ticket_id: ticket.id,
        message: `Support ticket ${ticket.ticket_number} created successfully. Our team will respond within 24 hours.`,
      },
    });
  } catch (err: any) {
    console.error('POST /api/help/ticket error:', err);
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    );
  }
}
