import { NextResponse, after } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';
import { alertDriversAboutJob, jobPriceLine, isSchemaMissing } from '../../../../../lib/dispatch';
import { getRouteLabel } from '../../../../../lib/job-helpers';
import { jobPool } from '../../../../../lib/driver-pool';

// POST /api/jobs/[id]/pool  { pool: 'open' }
// The booked driver or the TCG fleet hasn't taken the job → the customer (or an admin) opens it
// to every on-call driver, and they are alerted straight away (2 Oct 2026).
export async function POST(request, { params }) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: jobId } = await params;
    const body = await request.json().catch(() => ({}));
    if (body.pool !== 'open') return NextResponse.json({ error: 'Only opening to all drivers is supported' }, { status: 400 });

    const { data: job } = await supabaseAdmin.from('express_jobs').select('*').eq('id', jobId).maybeSingle();
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (session.role !== 'admin' && job.client_id !== session.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!['open', 'bidding'].includes(job.status)) {
      return NextResponse.json({ error: 'A driver has already taken this job.' }, { status: 409 });
    }
    if (jobPool(job) === 'open') return NextResponse.json({ data: job });

    const { data: updated, error } = await supabaseAdmin
      .from('express_jobs')
      .update({ driver_pool: 'open', target_driver_id: null })
      .eq('id', jobId)
      .in('status', ['open', 'bidding'])
      .select()
      .maybeSingle();
    if (error) {
      if (isSchemaMissing(error)) return NextResponse.json({ error: 'Not available yet — please try again shortly.' }, { status: 503 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!updated) return NextResponse.json({ error: 'A driver has just taken this job.' }, { status: 409 });

    after(() => alertDriversAboutJob(updated, {
      title: '🚚 New job — first to accept gets it',
      body: `${updated.job_number} | ${jobPriceLine(updated)} | ${getRouteLabel(updated)}`,
      inAppTitle: `New Job: ${(updated.item_description || 'Delivery').substring(0, 60)}`,
      inAppBody: `${jobPriceLine(updated)} · ${getRouteLabel(updated)} · Job #${updated.job_number}`,
    }).catch((e) => console.error('[pool] re-alert failed:', e?.message)));

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('POST /api/jobs/[id]/pool error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
