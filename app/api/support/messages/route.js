import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

// GET messages for a ticket
export async function GET(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const ticketId = searchParams.get('ticketId');
  if (!ticketId) return NextResponse.json({ error: 'ticketId required' }, { status: 400 });

  // Verify access
  if (session.role !== 'admin') {
    const { data: ticket } = await supabaseAdmin
      .from('express_support_tickets')
      .select('user_id')
      .eq('id', ticketId)
      .single();
    if (!ticket || ticket.user_id !== session.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  }

  const { data } = await supabaseAdmin
    .from('express_support_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  return NextResponse.json({ data: data || [] });
}

// POST: Send message
export async function POST(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ticketId, content, requestAgent } = await request.json();
  if (!ticketId || !content) return NextResponse.json({ error: 'ticketId and content required' }, { status: 400 });

  const senderType = session.role === 'admin' ? 'admin' : 'user';

  // Insert message
  const { data: msg, error } = await supabaseAdmin.from('express_support_messages').insert([{
    ticket_id: ticketId,
    sender_id: session.userId,
    sender_type: senderType,
    content,
  }]).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update ticket status
  const statusUpdate = { updated_at: new Date().toISOString() };
  if (senderType === 'admin') {
    statusUpdate.status = 'in_progress';
    statusUpdate.assigned_admin = session.userId;
  }
  if (requestAgent) {
    statusUpdate.status = 'waiting_agent';
  }

  await supabaseAdmin.from('express_support_tickets').update(statusUpdate).eq('id', ticketId);

  return NextResponse.json({ data: msg });
}
