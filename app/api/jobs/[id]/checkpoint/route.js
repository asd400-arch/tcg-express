import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';
import { notify } from '../../../../../lib/notify';
import { rateLimiters, applyRateLimit } from '../../../../../lib/rate-limiters';
import { requireUUID, requireEnum } from '../../../../../lib/validate';
import { isSchemaMissing } from '../../../../../lib/dispatch';
import { isCrossBorder, crossBorderCity, CROSS_BORDER_EVENTS, crossBorderEventInfo } from '../../../../../lib/pricing-mode';

const EVENT_KEYS = CROSS_BORDER_EVENTS.map((e) => e.key);
const ACTIVE_STATUSES = ['pickup_confirmed', 'in_transit'];

/**
 * POST /api/jobs/[id]/checkpoint  { event }
 * Cross-border (Malaysia) jobs only. The assigned driver logs where the load is:
 *   at_sg_checkpoint → cleared_sg → at_my_checkpoint → cleared_my
 * Events are appended to express_jobs.cross_border_events (idempotent per event) and the
 * customer is told straight away (app only). Order is not enforced — a driver may skip a step.
 */
export async function POST(request, { params }) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'driver') {
      return NextResponse.json({ error: 'Only the assigned driver can log checkpoints' }, { status: 403 });
    }

    const blocked = applyRateLimit(rateLimiters.general, session.userId);
    if (blocked) return blocked;

    const { id } = await params;
    const idCheck = requireUUID(id, 'Job ID');
    if (idCheck.error) return NextResponse.json({ error: idCheck.error }, { status: 400 });
    const jobId = idCheck.value;

    const body = await request.json().catch(() => ({}));
    const eventCheck = requireEnum(body.event, EVENT_KEYS, 'Checkpoint');
    if (eventCheck.error) return NextResponse.json({ error: eventCheck.error }, { status: 400 });
    const event = eventCheck.value;

    const { data: job, error: jobErr } = await supabaseAdmin
      .from('express_jobs')
      .select('id, job_number, client_id, assigned_driver_id, status, cross_border, destination_country, cross_border_details, cross_border_events')
      .eq('id', jobId)
      .single();
    if (jobErr && isSchemaMissing(jobErr)) {
      return NextResponse.json({ error: 'This feature is being switched on — please try again shortly.' }, { status: 503 });
    }
    if (jobErr || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (job.assigned_driver_id !== session.userId) {
      return NextResponse.json({ error: 'Not your job' }, { status: 403 });
    }
    if (!isCrossBorder(job)) {
      return NextResponse.json({ error: 'Checkpoints apply to cross-border jobs only' }, { status: 400 });
    }
    if (!ACTIVE_STATUSES.includes(job.status)) {
      return NextResponse.json({ error: 'Log checkpoints after pickup and before delivery.' }, { status: 400 });
    }

    const events = Array.isArray(job.cross_border_events) ? job.cross_border_events : [];
    const already = events.find((e) => e && e.event === event);
    if (already) {
      return NextResponse.json({ data: { jobId, events, already: true } });
    }

    const nowIso = new Date().toISOString();
    const nextEvents = [...events, { event, at: nowIso, by: session.userId }];
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('express_jobs')
      .update({ cross_border_events: nextEvents })
      .eq('id', jobId)
      .eq('assigned_driver_id', session.userId)
      .in('status', ACTIVE_STATUSES)
      .select('id, cross_border_events')
      .maybeSingle();
    if (updErr) {
      console.error('[checkpoint] update failed:', updErr.message);
      return NextResponse.json({ error: 'Could not save the checkpoint. Please try again.' }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: 'The job just changed — refresh and check.' }, { status: 409 });
    }

    try {
      const info = crossBorderEventInfo(event);
      await notify(job.client_id, {
        type: 'delivery',
        category: 'delivery_status',
        title: `${info.icon} ${info.label} — ${job.job_number}`,
        message: `Your ${crossBorderCity(job)} delivery: ${info.label.toLowerCase()}.`,
        referenceId: jobId,
        url: `/client/jobs/${jobId}`,
        data: { type: 'job', jobId, job_id: jobId, role: 'client' },
      });
    } catch (e) {
      console.error('[checkpoint] notify failed:', e?.message);
    }

    return NextResponse.json({ data: { jobId, events: updated.cross_border_events } });
  } catch (err) {
    console.error('POST /api/jobs/[id]/checkpoint error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
