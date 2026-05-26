import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';
import { notify } from '../../../../../lib/notify';

export async function POST(request, { params }) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'client') {
      return NextResponse.json({ error: 'Only clients can assign drivers' }, { status: 403 });
    }

    const { id: jobId } = await params;
    const body = await request.json();
    const bidId = body.bid_id || body.bidId;
    if (!bidId) return NextResponse.json({ error: 'bid_id is required' }, { status: 400 });

    const { data: bid, error: bidErr } = await supabaseAdmin
      .from('express_bids')
      .select('id, job_id, driver_id, amount, status')
      .eq('id', bidId)
      .single();

    if (bidErr || !bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
    if (bid.job_id !== jobId) {
      return NextResponse.json({ error: 'Bid does not belong to this job' }, { status: 400 });
    }
    if (bid.status !== 'pending') {
      return NextResponse.json({ error: 'Bid is no longer pending' }, { status: 400 });
    }

    const { data: job, error: jobErr } = await supabaseAdmin
      .from('express_jobs')
      .select('id, client_id, job_number, status')
      .eq('id', jobId)
      .single();

    if (jobErr || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (job.client_id !== session.userId) return NextResponse.json({ error: 'Not your job' }, { status: 403 });
    if (!['open', 'bidding'].includes(job.status)) {
      return NextResponse.json({ error: 'Job is no longer accepting bids' }, { status: 400 });
    }

    let rate = 15;
    try {
      const { data: settings } = await supabaseAdmin
        .from('express_settings')
        .select('value')
        .eq('key', 'commission_rate')
        .single();
      if (settings?.value) rate = parseFloat(settings.value);
    } catch {}

    try {
      const { data: driver } = await supabaseAdmin
        .from('express_users')
        .select('created_at')
        .eq('id', bid.driver_id)
        .single();
      if (driver?.created_at) {
        const daysSinceCreation = (Date.now() - new Date(driver.created_at).getTime()) / 86400000;
        if (daysSinceCreation < 30) rate = 0;
      }
    } catch {}

    const idempotencyKey = `accept_${job.id}_${bid.id}`;
    const { data: result, error: rpcErr } = await supabaseAdmin.rpc('process_bid_acceptance', {
      p_job_id: job.id,
      p_bid_id: bid.id,
      p_payer_id: session.userId,
      p_commission_rate: rate,
      p_coupon_discount: 0,
      p_coupon_id: null,
      p_idempotency_key: idempotencyKey,
    });

    if (rpcErr) {
      const msg = rpcErr.message || '';
      if (msg.includes('Insufficient wallet balance') || msg.includes('insufficient')) {
        const { data: wallet } = await supabaseAdmin
          .from('wallets')
          .select('balance')
          .eq('user_id', session.userId)
          .single();
        const available = parseFloat(wallet?.balance) || 0;
        const required = parseFloat(bid.amount) || 0;
        return NextResponse.json({
          error: 'Insufficient wallet balance',
          available: available.toFixed(2),
          required: required.toFixed(2),
        }, { status: 400 });
      }
      return NextResponse.json({ error: msg || 'Failed to accept bid' }, { status: 400 });
    }

    const { data: driver } = await supabaseAdmin
      .from('express_users')
      .select('contact_name')
      .eq('id', bid.driver_id)
      .single();

    try {
      await notify({
        userId: bid.driver_id,
        type: 'job',
        title: `Job ${job.job_number} assigned to you!`,
        message: 'Check My Jobs for pickup details.',
        referenceId: job.id,
      });
      await notify({
        userId: session.userId,
        type: 'job',
        title: `Driver assigned for ${job.job_number}`,
        message: `${driver?.contact_name || 'A driver'} has been assigned ($${parseFloat(bid.amount).toFixed(2)}).`,
        referenceId: job.id,
      });
    } catch {}

    return NextResponse.json({ data: result, success: true });
  } catch (err) {
    console.error('POST /api/jobs/[id]/assign error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
