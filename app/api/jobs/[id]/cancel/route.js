import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';

export async function POST(request, { params }) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: jobId } = await params;

    const { data: job } = await supabaseAdmin
      .from('express_jobs')
      .select('id, client_id, status, job_number')
      .eq('id', jobId)
      .single();

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (session.role === 'client' && job.client_id !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!['open', 'bidding'].includes(job.status)) {
      return NextResponse.json({ error: 'Only open or bidding jobs can be cancelled this way' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('express_jobs')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: session.role,
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  } catch (err) {
    console.error('POST /api/jobs/[id]/cancel error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
