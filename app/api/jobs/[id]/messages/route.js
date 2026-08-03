import { NextResponse } from 'next/server';
import { getSession } from '../../../../../lib/auth';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { chatTopic, inquiryChatTopic } from '../../../../../lib/chat-topic';
import { rateLimit } from '../../../../../lib/rate-limit';

/** Job statuses where job_chat is writable (assigned → confirmed) */
const CHAT_ACTIVE_STATUSES = new Set([
  'assigned', 'pickup_confirmed', 'picked_up', 'in_transit', 'delivered', 'confirmed',
]);

/** Job statuses where inquiry threads are writable */
const INQUIRY_OPEN_STATUSES = new Set(['open', 'bidding']);

/**
 * URL prefix for all files in our Supabase storage buckets.
 * image_urls must start with this to prevent third-party URL injection.
 */
const STORAGE_PREFIX = `${(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()}/storage/v1/object/public/`;

/** Recipient is considered "active in chat" if they read within this window → suppress push */
const PUSH_SUPPRESS_MS = 30_000;

/** Per-thread rate limiter: 10 messages / 60 s per user per thread */
const inquiryLimiter = rateLimit({ interval: 60_000, maxRequests: 10, name: 'inquiry_chat' });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchJob(jobId) {
  const { data: job, error } = await supabaseAdmin
    .from('express_jobs')
    .select('id, status, client_id, assigned_driver_id')
    .eq('id', jobId)
    .single();
  return error || !job ? null : job;
}

/**
 * Fire-and-forget Supabase Realtime broadcast (REST, serverless-safe).
 * Single HMAC-keyed topic per thread.
 */
function broadcastMessage(threadType, jobId, driverId, message) {
  const topic = threadType === 'inquiry'
    ? inquiryChatTopic(jobId, driverId)
    : chatTopic(jobId);
  const msgs = [{ topic, event: 'new_message', payload: message }];

  fetch(`${(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ messages: msgs }),
  })
    .then((res) => {
      console.log(`[CHAT-BROADCAST] status=${res.status} job=${jobId} topics=${msgs.map((m) => m.topic).join(',')}`);
      if (!res.ok) res.text().then((t) => console.error(`[CHAT-BROADCAST] error body: ${t}`)).catch(() => {});
    })
    .catch((e) => console.error(`[CHAT-BROADCAST] fetch error: ${e?.message}`));
}

// ---------------------------------------------------------------------------
// GET /api/jobs/[id]/messages
// Query params:
//   limit       – max per page (default 50, max 100)
//   before      – ISO timestamp cursor (exclusive upper bound)
//   thread_type – 'job_chat' (default) | 'inquiry'
//   driver_id   – required when client requests inquiry thread
// ---------------------------------------------------------------------------
export async function GET(request, { params }) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: jobId } = await params;
  const { searchParams } = new URL(request.url);
  const threadType = searchParams.get('thread_type') || 'job_chat';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
  const before = searchParams.get('before');

  if (threadType !== 'job_chat' && threadType !== 'inquiry') {
    return NextResponse.json({ error: 'thread_type must be "job_chat" or "inquiry"' }, { status: 400 });
  }

  const job = await fetchJob(jobId);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  let driverId = null;
  let topic;

  if (threadType === 'inquiry') {
    // Driver: forced to own thread. Client: must own job + provide driver_id.
    if (session.role === 'driver') {
      driverId = session.userId;
    } else {
      if (job.client_id !== session.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      driverId = searchParams.get('driver_id');
      if (!driverId) return NextResponse.json({ error: 'driver_id is required for inquiry threads' }, { status: 400 });
    }
    topic = inquiryChatTopic(jobId, driverId);
  } else {
    if (job.client_id !== session.userId && job.assigned_driver_id !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    topic = chatTopic(jobId);
  }

  let query = supabaseAdmin
    .from('chat_messages')
    .select('id, job_id, sender_id, type, content, image_urls, created_at')
    .eq('job_id', jobId)
    .eq('thread_type', threadType)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (threadType === 'inquiry') query = query.eq('driver_id', driverId);
  if (before) query = query.lt('created_at', before);

  const { data: messages, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: messages.reverse(), job_status: job.status, topic });
}

// ---------------------------------------------------------------------------
// POST /api/jobs/[id]/messages
// Body:
//   type        – "text" | "image"
//   content     – required if type="text"; non-blank, max 2000 chars
//   image_urls  – required if type="image"; array of 1–3 storage URLs
//   thread_type – "job_chat" (default) | "inquiry"
//   driver_id   – required when client sends inquiry message
// ---------------------------------------------------------------------------
export async function POST(request, { params }) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: jobId } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { type, content, image_urls, thread_type: bodyThreadType, driver_id: bodyDriverId } = body;
  const threadType = bodyThreadType || 'job_chat';

  if (threadType !== 'job_chat' && threadType !== 'inquiry') {
    return NextResponse.json({ error: 'thread_type must be "job_chat" or "inquiry"' }, { status: 400 });
  }

  const job = await fetchJob(jobId);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const isClient = session.userId === job.client_id;
  let driverId = null;
  let recipientId;
  let recipientRole;

  // ── Thread-specific auth & routing ──────────────────────────────────────
  if (threadType === 'inquiry') {
    if (!INQUIRY_OPEN_STATUSES.has(job.status)) {
      return NextResponse.json({ error: 'Inquiry is closed for this job status' }, { status: 400 });
    }
    if (job.assigned_driver_id) {
      return NextResponse.json({ error: 'Inquiry thread is read-only after assignment' }, { status: 400 });
    }
    if (session.role === 'driver') {
      driverId = session.userId; // forced
      recipientId = job.client_id;
      recipientRole = 'client';
    } else if (isClient) {
      if (!bodyDriverId) return NextResponse.json({ error: 'driver_id is required for client inquiry messages' }, { status: 400 });
      driverId = bodyDriverId;
      recipientId = driverId;
      recipientRole = 'driver';
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // Rate limit per user per thread
    const { success: rlOk } = inquiryLimiter.check(`${session.userId}:${jobId}:${driverId}`);
    if (!rlOk) return NextResponse.json({ error: 'Too many messages. Please slow down.' }, { status: 429 });
  } else {
    // job_chat — unchanged access rules
    if (job.client_id !== session.userId && job.assigned_driver_id !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!CHAT_ACTIVE_STATUSES.has(job.status)) {
      return NextResponse.json({ error: 'Chat is read-only for this job status' }, { status: 409 });
    }
    if (!job.assigned_driver_id) {
      return NextResponse.json({ error: 'No driver assigned to this job' }, { status: 409 });
    }
    recipientId = isClient ? job.assigned_driver_id : job.client_id;
    recipientRole = isClient ? 'driver' : 'client';
  }

  // ── Validate payload ────────────────────────────────────────────────────
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
    if (!trimmed) return NextResponse.json({ error: 'content cannot be blank' }, { status: 400 });
    if (trimmed.length > 2000) return NextResponse.json({ error: 'content must be 2000 characters or fewer' }, { status: 400 });
    storedContent = trimmed;
  }

  if (type === 'image') {
    if (!Array.isArray(image_urls) || image_urls.length < 1 || image_urls.length > 3) {
      return NextResponse.json({ error: 'image_urls must be an array of 1–3 URLs' }, { status: 400 });
    }
    for (const url of image_urls) {
      if (typeof url !== 'string' || !url.startsWith(STORAGE_PREFIX)) {
        return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
      }
    }
    storedImageUrls = image_urls;
  }

  // ── Insert ──────────────────────────────────────────────────────────────
  const insertRow = {
    job_id: jobId,
    sender_id: session.userId,
    type,
    content: storedContent,
    image_urls: storedImageUrls,
    thread_type: threadType,
  };
  if (threadType === 'inquiry') insertRow.driver_id = driverId;

  const { data: message, error: insertErr } = await supabaseAdmin
    .from('chat_messages')
    .insert(insertRow)
    .select('id, job_id, sender_id, type, content, image_urls, created_at')
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // ── Mark sender as read ─────────────────────────────────────────────────
  const readDriverId = threadType === 'inquiry' ? driverId : null;
  await supabaseAdmin
    .from('job_chat_reads')
    .upsert(
      { job_id: jobId, user_id: session.userId, driver_id: readDriverId, last_read_at: message.created_at },
      { onConflict: 'job_id,user_id,driver_id' },
    );

  // ── Broadcast (fire-and-forget) ─────────────────────────────────────────
  broadcastMessage(threadType, jobId, driverId, message);

  // ── Push notification (job_chat + inquiry) ─────────────────────────────
  {
    let recipientReadQ = supabaseAdmin
      .from('job_chat_reads')
      .select('last_read_at')
      .eq('job_id', jobId)
      .eq('user_id', recipientId);

    recipientReadQ = threadType === 'inquiry'
      ? recipientReadQ.eq('driver_id', driverId)
      : recipientReadQ.is('driver_id', null);

    const { data: readRow } = await recipientReadQ.maybeSingle();
    const recipientActive =
      readRow?.last_read_at &&
      Date.now() - new Date(readRow.last_read_at).getTime() < PUSH_SUPPRESS_MS;

    const { notify } = await import('../../../../../lib/notify.js');
    const pushBody =
      type === 'text'
        ? storedContent.slice(0, 100)
        : storedImageUrls.length > 1
          ? `📷 ${storedImageUrls.length} Photos`
          : '📷 Photo';
    const recipientUrl = recipientRole === 'client'
      ? `/client/jobs/${jobId}`
      : '/driver/my-jobs';

    const title = threadType === 'inquiry'
      ? (isClient ? 'Reply to your inquiry' : 'New inquiry from driver')
      : `${isClient ? 'Customer' : 'Driver'} sent a message`;

    notify(recipientId, {
      type: 'chat',
      category: 'chat',
      title,
      message: pushBody,
      referenceId: jobId,
      url: recipientUrl,
      data: {
        type: 'chat',
        jobId,
        role: recipientRole,
        threadType,
        ...(threadType === 'inquiry' ? { driverId } : {}),
      },
      inApp: !recipientActive,
      push: true,
      channelId: 'chat',
    }).catch((e) => console.error('[chat] notify error:', e));
  }

  return NextResponse.json({ data: message }, { status: 201 });
}
