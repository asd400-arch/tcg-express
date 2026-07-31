import { NextResponse } from 'next/server';
import { getSession } from '../../../../../../lib/auth';
import { supabaseAdmin } from '../../../../../../lib/supabase-server';

// ---------------------------------------------------------------------------
// POST /api/jobs/[id]/messages/read
// Upsert the caller's last_read_at for this job's chat.
// Call this when the chat screen is opened and periodically while it is open
// (every ~20 s) so the push-suppression window stays fresh.
// No body required.
// ---------------------------------------------------------------------------
export async function POST(request, { params }) {
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

  const { error } = await supabaseAdmin
    .from('job_chat_reads')
    .upsert(
      { job_id: jobId, user_id: session.userId, driver_id: null, last_read_at: new Date().toISOString() },
      { onConflict: 'job_id,user_id,driver_id' },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
