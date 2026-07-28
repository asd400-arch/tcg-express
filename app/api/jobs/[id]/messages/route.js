import { NextResponse } from 'next/server';
import { getSession } from '../../../../../lib/auth';
import { supabaseAdmin } from '../../../../../lib/supabase-server';

/** Job statuses where chat is writable (assigned → confirmed) */
const CHAT_ACTIVE_STATUSES = new Set([
  'assigned', 'pickup_confirmed', 'picked_up', 'in_transit', 'delivered', 'confirmed',
]);

/**
 * URL prefix for all files in our Supabase storage buckets.
 * image_urls must start with this to prevent third-party URL injection.
 */
const STORAGE_PREFIX = `${(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()}/storage/v1/object/public/`;

/** Recipient is considered "active in chat" if they read within this window → suppress push */
const PUSH_SUPPRESS_MS = 30_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch job and verify the caller is the job's client or assigned driver.
 * Returns { job } on success or { accessError, accessStatus } on failure.
 */
async function getJobAndVerifyAccess(jobId, userId) {
  const { data: job, error } = await supabaseAdmin
    .from('express_jobs')
    .select('id, status, client_id, assigned_driver_id')
    .eq('id', jobId)
    .single();
  if (error || !job) return { accessError: 'Job not found', accessStatus: 404 };
  if (job.client_id !== userId && job.assigned_driver_id !== userId) {
    return { accessError: 'Forbidden', accessStatus: 403 };
  }
  return { job };
}

/**
 * Fire-and-forget Supabase Realtime broadcast so the recipient's chat screen
 * updates without polling. Uses the REST broadcast API (serverless-safe).
 */
function broadcastMessage(jobId, message) {
  fetch(`${(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      messages: [{ topic: `chat:${jobId}`, event: 'new_message', payload: message }],
    }),
  })
    .then((res) => {
      console.log(`[CHAT-BROADCAST] status=${res.status} job=${jobId}`);
      if (!res.ok) {
        res.text().then((t) => console.error(`[CHAT-BROADCAST] error body: ${t}`)).catch(() => {});
      }
    })
    .catch((e) => console.error(`[CHAT-BROADCAST] fetch error: ${e?.message}`));
}

// ---------------------------------------------------------------------------
// GET /api/jobs/[id]/messages
// Returns paginated messages for the job, oldest-first within the page.
// Query params:
//   limit  – max messages per page (default 50, max 100)
//   before – ISO timestamp for cursor-based pagination (exclusive upper bound)
// ---------------------------------------------------------------------------
export async function GET(request, { params }) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: jobId } = await params;
  const { accessError, accessStatus, job } = await getJobAndVerifyAccess(jobId, session.userId);
  if (accessError) return NextResponse.json({ error: accessError }, { status: accessStatus });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
  const before = searchParams.get('before'); // ISO timestamp

  let query = supabaseAdmin
    .from('chat_messages')
    .select('id, job_id, sender_id, type, content, image_urls, created_at')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) query = query.lt('created_at', before);

  const { data: messages, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return in chronological order (oldest first) for the UI
  return NextResponse.json({ data: messages.reverse(), job_status: job.status });
}

// ---------------------------------------------------------------------------
// POST /api/jobs/[id]/messages
// Send a text or image message. Triggers Realtime broadcast + push.
//
// Body:
//   type        – "text" | "image"
//   content     – required if type="text"; non-blank, max 2000 chars
//   image_urls  – required if type="image"; array of 1–3 storage URLs
// ---------------------------------------------------------------------------
export async function POST(request, { params }) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: jobId } = await params;
  const { accessError, accessStatus, job } = await getJobAndVerifyAccess(jobId, session.userId);
  if (accessError) return NextResponse.json({ error: accessError }, { status: accessStatus });

  // Chat only active while job is in progress
  if (!CHAT_ACTIVE_STATUSES.has(job.status)) {
    return NextResponse.json(
      { error: 'Chat is read-only for this job status' },
      { status: 409 },
    );
  }
  if (!job.assigned_driver_id) {
    return NextResponse.json({ error: 'No driver assigned to this job' }, { status: 409 });
  }

  // Parse + validate body
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { type, content, image_urls } = body;

  if (type !== 'text' && type !== 'image') {
    return NextResponse.json({ error: 'type must be "text" or "image"' }, { status: 400 });
  }

  let storedContent = null;
  let storedImageUrls = [];

  if (type === 'text') {
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required for text messages' }, { status: 400 });
    }
    const trimmed = content.trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'content cannot be blank' }, { status: 400 });
    }
    if (trimmed.length > 2000) {
      return NextResponse.json({ error: 'content must be 2000 characters or fewer' }, { status: 400 });
    }
    storedContent = trimmed;
  }

  if (type === 'image') {
    if (!Array.isArray(image_urls) || image_urls.length < 1 || image_urls.length > 3) {
      return NextResponse.json(
        { error: 'image_urls must be an array of 1–3 URLs' },
        { status: 400 },
      );
    }
    for (const url of image_urls) {
      if (typeof url !== 'string' || !url.startsWith(STORAGE_PREFIX)) {
        return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
      }
    }
    storedImageUrls = image_urls;
  }

  // Determine recipient
  const isClient = session.userId === job.client_id;
  const recipientId = isClient ? job.assigned_driver_id : job.client_id;
  const recipientRole = isClient ? 'driver' : 'client';

  // Insert message
  const { data: message, error: insertErr } = await supabaseAdmin
    .from('chat_messages')
    .insert({
      job_id: jobId,
      sender_id: session.userId,
      type,
      content: storedContent,
      image_urls: storedImageUrls,
    })
    .select('id, job_id, sender_id, type, content, image_urls, created_at')
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Mark sender as having read up to this message
  await supabaseAdmin
    .from('job_chat_reads')
    .upsert(
      { job_id: jobId, user_id: session.userId, last_read_at: message.created_at },
      { onConflict: 'job_id,user_id' },
    );

  // Realtime broadcast (fire-and-forget — push notification is the fallback)
  broadcastMessage(jobId, message);

  // Determine whether recipient is actively reading this chat (suppress in-app only)
  const { data: readRow } = await supabaseAdmin
    .from('job_chat_reads')
    .select('last_read_at')
    .eq('job_id', jobId)
    .eq('user_id', recipientId)
    .maybeSingle();

  const recipientActive =
    readRow?.last_read_at &&
    Date.now() - new Date(readRow.last_read_at).getTime() < PUSH_SUPPRESS_MS;

  const { notify } = await import('../../../../../lib/notify.js');
  const senderLabel = isClient ? 'Customer' : 'Driver';
  const pushBody =
    type === 'text'
      ? storedContent.slice(0, 100)
      : storedImageUrls.length > 1
        ? `📷 ${storedImageUrls.length} Photos`
        : '📷 Photo';
  const recipientUrl = recipientRole === 'client'
    ? `/client/jobs/${jobId}`
    : '/driver/my-jobs';

  notify(recipientId, {
    type: 'chat',
    category: 'chat',
    title: `${senderLabel} sent a message`,
    message: pushBody,
    referenceId: jobId,
    url: recipientUrl,
    data: { type: 'chat', jobId, role: recipientRole, threadType: 'job_chat' },
    inApp: !recipientActive,
    push: true,
    channelId: 'chat',
  }).catch((e) => console.error('[chat] notify error:', e));

  return NextResponse.json({ data: message }, { status: 201 });
}
