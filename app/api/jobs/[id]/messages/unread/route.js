import { NextResponse } from 'next/server';
import { getSession } from '../../../../../../lib/auth';
import { supabaseAdmin } from '../../../../../../lib/supabase-server';

// ---------------------------------------------------------------------------
// GET /api/jobs/[id]/messages/unread
// Returns the count of unread messages for the caller in this job's chat.
// A message is "unread" if:
//   • it was not sent by the caller, AND
//   • it was created after the caller's last_read_at (or they have no read row)
//
// Used to drive the unread badge on chat entry points.
// ---------------------------------------------------------------------------
export async function GET(request, { params }) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: jobId } = await params;

  // Verify the caller belongs to this job
  const { data: job, error: jobErr } = await supabaseAdmin
    .from('express_jobs')
    .select('id, client_id, assigned_driver_id')
    .eq('id', jobId)
    .single();

  if (jobErr || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (job.client_id !== session.userId && job.assigned_driver_id !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch caller's last read timestamp (null = never read)
  const { data: readRow } = await supabaseAdmin
    .from('job_chat_reads')
    .select('last_read_at')
    .eq('job_id', jobId)
    .eq('user_id', session.userId)
    .is('driver_id', null)
    .maybeSingle();

  const lastReadAt = readRow?.last_read_at ?? null;

  // Count messages not sent by caller, created after last_read_at
  let countQuery = supabaseAdmin
    .from('chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .neq('sender_id', session.userId);

  if (lastReadAt) countQuery = countQuery.gt('created_at', lastReadAt);

  const { count, error: countErr } = await countQuery;
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });

  return NextResponse.json({ count: count ?? 0 });
}
