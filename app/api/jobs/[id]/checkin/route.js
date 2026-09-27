import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';
import { notify } from '../../../../../lib/notify';
import { rateLimiters, applyRateLimit } from '../../../../../lib/rate-limiters';
import { requireUUID } from '../../../../../lib/validate';
import { CHECKIN_OPENS_MIN, isSchemaMissing, sgTime } from '../../../../../lib/dispatch';

/**
 * POST /api/jobs/[id]/checkin
 * The assigned driver confirms they're on the way to the pickup ("I'm on my way").
 * Opens 2 hours before the pickup time. The customer is told straight away (app only).
 * Drivers who haven't confirmed 10 minutes after the pickup time are released automatically.
 */
export async function POST(request, { params }) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'driver') {
      return NextResponse.json({ error: 'Only the assigned driver can confirm' }, { status: 403 });
    }

    const blocked = applyRateLimit(rateLimiters.general, session.userId);
    if (blocked) return blocked;

    const { id } = await params;
    const idCheck = requireUUID(id, 'Job ID');
    if (idCheck.error) return NextResponse.json({ error: idCheck.error }, { status: 400 });
    const jobId = idCheck.value;

    const { data: job, error: jobErr } = await supabaseAdmin
      .from('express_jobs')
      .select('id, job_number, client_id, assigned_driver_id, status, pickup_by, driver_checkin_at')
      .eq('id', jobId)
      .single();
    if (jobErr && isSchemaMissing(jobErr)) {
      return NextResponse.json({ error: 'This feature is being switched on — please try again shortly.' }, { status: 503 });
    }
    if (jobErr || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (job.assigned_driver_id !== session.userId) {
      return NextResponse.json({ error: 'Not your job' }, { status: 403 });
    }
    if (job.status !== 'assigned') {
      return NextResponse.json({ error: 'You can only confirm before pickup.' }, { status: 400 });
    }
    if (job.driver_checkin_at) {
      return NextResponse.json({ data: { jobId, driver_checkin_at: job.driver_checkin_at, already: true } });
    }

    if (job.pickup_by) {
      const opensAt = new Date(job.pickup_by).getTime() - CHECKIN_OPENS_MIN * 60000;
      if (Date.now() < opensAt) {
        return NextResponse.json({
          error: `You can confirm from ${sgTime(new Date(opensAt).toISOString())} (2 hours before pickup).`,
          opens_at: new Date(opensAt).toISOString(),
        }, { status: 400 });
      }
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('express_jobs')
      .update({ driver_checkin_at: nowIso })
      .eq('id', jobId)
      .eq('status', 'assigned')
      .eq('assigned_driver_id', session.userId)
      .is('driver_checkin_at', null)
      .select('id, driver_checkin_at')
      .maybeSingle();
    if (updErr) {
      if (isSchemaMissing(updErr)) {
        return NextResponse.json({ error: 'This feature is being switched on — please try again shortly.' }, { status: 503 });
      }
      console.error('[checkin] update failed:', updErr.message);
      return NextResponse.json({ error: 'Could not confirm. Please try again.' }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: 'The job just changed — refresh and check.' }, { status: 409 });
    }

    try {
      const { data: me } = await supabaseAdmin.from('express_users').select('contact_name').eq('id', session.userId).single();
      await notify(job.client_id, {
        type: 'job',
        category: 'job_updates',
        title: `Driver on the way — ${job.job_number}`,
        message: `${me?.contact_name || 'Your driver'} confirmed they're heading to the pickup${job.pickup_by ? ` (pickup ${sgTime(job.pickup_by)})` : ''}.`,
        referenceId: jobId,
        url: `/client/jobs/${jobId}`,
        data: { type: 'job', jobId, job_id: jobId, role: 'client' },
      });
    } catch (e) {
      console.error('[checkin] notify failed:', e?.message);
    }

    return NextResponse.json({ data: { jobId, driver_checkin_at: updated.driver_checkin_at } });
  } catch (err) {
    console.error('POST /api/jobs/[id]/checkin error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
