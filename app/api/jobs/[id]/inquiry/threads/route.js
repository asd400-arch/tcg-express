import { NextResponse } from 'next/server';
import { getSession } from '../../../../../../lib/auth';
import { supabaseAdmin } from '../../../../../../lib/supabase-server';

// ---------------------------------------------------------------------------
// GET /api/jobs/[id]/inquiry/threads
// Client-only. Returns all inquiry threads for this job.
// Each thread: { driver_id, driver_name, last_message, unread_count, has_bid }
// Uses parallel queries — no N+1.
// ---------------------------------------------------------------------------
export async function GET(request, { params }) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: jobId } = await params;

  const { data: job, error: jobErr } = await supabaseAdmin
    .from('express_jobs')
    .select('id, client_id')
    .eq('id', jobId)
    .single();

  if (jobErr || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (job.client_id !== session.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Three parallel queries — no per-thread round-trips
  const [msgRes, readRes, bidRes] = await Promise.all([
    supabaseAdmin
      .from('chat_messages')
      .select('driver_id, sender_id, content, type, image_urls, created_at')
      .eq('job_id', jobId)
      .eq('thread_type', 'inquiry')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('job_chat_reads')
      .select('driver_id, last_read_at')
      .eq('job_id', jobId)
      .eq('user_id', session.userId)
      .not('driver_id', 'is', null),
    supabaseAdmin
      .from('express_bids')
      .select('driver_id')
      .eq('job_id', jobId)
      .eq('status', 'pending'),
  ]);

  if (msgRes.error) return NextResponse.json({ error: msgRes.error.message }, { status: 500 });

  const messages = msgRes.data || [];
  if (messages.length === 0) return NextResponse.json({ data: [] });

  // Group by driver_id — first occurrence per driver is the latest (desc order)
  const threadMap = new Map();
  for (const msg of messages) {
    if (!threadMap.has(msg.driver_id)) {
      threadMap.set(msg.driver_id, { lastMessage: msg, messages: [] });
    }
    threadMap.get(msg.driver_id).messages.push(msg);
  }

  // Lookup maps for read timestamps and bids
  const readMap = new Map();
  for (const r of readRes.data || []) {
    readMap.set(r.driver_id, r.last_read_at);
  }

  const bidSet = new Set();
  for (const b of bidRes.data || []) {
    bidSet.add(b.driver_id);
  }

  // Fetch driver names (single query for all threads)
  const driverIds = [...threadMap.keys()];
  const { data: drivers } = await supabaseAdmin
    .from('express_users')
    .select('id, contact_name')
    .in('id', driverIds);

  const nameMap = new Map();
  for (const d of drivers || []) {
    nameMap.set(d.id, d.contact_name);
  }

  // Build response
  const threads = driverIds.map((driverId) => {
    const { lastMessage, messages: threadMsgs } = threadMap.get(driverId);
    const lastReadAt = readMap.get(driverId) || null;

    let unreadCount = 0;
    for (const msg of threadMsgs) {
      if (msg.sender_id === session.userId) continue;
      if (!lastReadAt || msg.created_at > lastReadAt) unreadCount++;
    }

    return {
      driver_id: driverId,
      driver_name: nameMap.get(driverId) || null,
      last_message: {
        content: lastMessage.content,
        type: lastMessage.type,
        image_urls: lastMessage.image_urls,
        created_at: lastMessage.created_at,
        sender_id: lastMessage.sender_id,
      },
      unread_count: unreadCount,
      has_bid: bidSet.has(driverId),
    };
  });

  // Most recent thread first
  threads.sort((a, b) => new Date(b.last_message.created_at) - new Date(a.last_message.created_at));

  return NextResponse.json({ data: threads });
}
