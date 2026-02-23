import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';
import { notify } from '../../../../../lib/notify';

export async function POST(request, { params }) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'client') return NextResponse.json({ error: 'Only clients can reject bids' }, { status: 403 });

    const { id } = await params;

    // Fetch bid with job info
    const { data: bid } = await supabaseAdmin
      .from('express_bids')
      .select('id, job_id, driver_id, amount, status')
      .eq('id', id)
      .single();

    if (!bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
    if (bid.status !== 'pending') return NextResponse.json({ error: 'Can only reject pending bids' }, { status: 400 });

    // Verify the client owns this job
    const { data: job } = await supabaseAdmin
      .from('express_jobs')
      .select('id, client_id, job_number')
      .eq('id', bid.job_id)
      .single();

    if (!job || job.client_id !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update bid status to rejected
    const { data, error } = await supabaseAdmin
      .from('express_bids')
      .update({ status: 'rejected' })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notify driver
    try {
      await notify(bid.driver_id, {
        type: 'bid_rejected',
        category: 'bid_activity',
        title: 'Bid rejected',
        message: `Your bid of $${parseFloat(bid.amount).toFixed(2)} on job ${job.job_number || ''} was rejected. You may submit a new bid with a different price.`,
        url: '/driver/jobs',
      });
    } catch {}

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('POST /api/bids/[id]/reject error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
