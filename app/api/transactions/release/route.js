import { supabaseAdmin } from '../../../../lib/supabase-server';
import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';

export async function POST(req) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await req.json();
    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    // Verify user is the job's client
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('express_jobs')
      .select('id, client_id')
      .eq('id', jobId)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (job.client_id !== session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Find the held transaction for this job
    const { data: txn, error: txnErr } = await supabaseAdmin
      .from('express_transactions')
      .select('*')
      .eq('job_id', jobId)
      .eq('payment_status', 'held')
      .single();

    if (txnErr || !txn) {
      return NextResponse.json({ error: 'No held transaction found' }, { status: 404 });
    }

    // Release: update to paid
    const now = new Date().toISOString();
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('express_transactions')
      .update({ payment_status: 'paid', released_at: now, paid_at: now })
      .eq('id', txn.id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to release payment' }, { status: 500 });
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
