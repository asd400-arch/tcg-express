import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';
import { notify } from '../../../../../lib/notify';
import { buildPaymentsBreakdown } from '../../../../../lib/bid-breakdown';
import { getCommissionRate } from '../../../../../lib/zero-commission';

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
      .select('id, job_id, driver_id, amount, status, equipment_charges')
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
      .select('id, client_id, job_number, status, fare_breakdown, coupon_discount')
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

    // Zero Commission: 0% for 30 days after driver's first completed delivery
    rate = await getCommissionRate(supabaseAdmin, bid.driver_id, rate);

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

    // Promote inquiry thread → job_chat (non-fatal)
    try {
      const { promoteInquiry } = await import('../../../../../lib/promote-inquiry.js');
      await promoteInquiry(job.id, bid.driver_id);
    } catch (e) {
      console.error('[assign] promoteInquiry error:', e);
    }

    // payments INSERT — mirrors bids/[id]/accept pattern
    // wallet_tx: RPC writes type='payment', reference_type='job', reference_id=job_id, user_id=payer_id
    try {
      const { data: customerTx, error: txLookupErr } = await supabaseAdmin
        .from('wallet_transactions')
        .select('id')
        .eq('user_id', session.userId)
        .eq('reference_type', 'job')
        .eq('reference_id', job.id)
        .eq('type', 'payment')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (txLookupErr) {
        console.error('[PAYMENTS][assign] wallet_tx lookup error:', txLookupErr.message, { job_id: job.id });
      }
      console.log('[PAYMENTS][assign] customer_wallet_tx_id:', customerTx?.id ?? null, { job_id: job.id });

      const breakdown = buildPaymentsBreakdown(
        bid.equipment_charges,
        job.fare_breakdown,
        job.coupon_discount,
      );

      const { error: pmtErr } = await supabaseAdmin.from('payments').insert({
        job_id:               job.id,
        customer_id:          session.userId,
        driver_id:            bid.driver_id,
        total_amount:         bid.amount,
        platform_commission:  result.commission,
        driver_earning:       result.payout,
        commission_rate:      rate,
        ...breakdown,
        payment_method:       'wallet',
        payment_status:       'paid',
        customer_wallet_tx_id: customerTx?.id ?? null,
        paid_at:              new Date().toISOString(),
      });

      if (pmtErr) {
        console.error('[PAYMENTS][assign] INSERT failed:', pmtErr.message, { job_id: job.id, bid_amount: bid.amount });
      } else {
        console.log('[PAYMENTS][assign] INSERT ok', { job_id: job.id });
      }
    } catch (pmtErr) {
      console.error('[PAYMENTS][assign] unexpected error:', pmtErr?.message, { job_id: job.id });
    }

    const { data: driver } = await supabaseAdmin
      .from('express_users')
      .select('contact_name')
      .eq('id', bid.driver_id)
      .single();

    try {
      await notify(bid.driver_id, {
        type: 'job',
        category: 'bid_activity',
        title: `Job ${job.job_number} assigned to you!`,
        message: 'Check My Jobs for pickup details.',
        referenceId: job.id,
        url: '/driver/my-jobs',
        data: { job_id: job.id, role: 'driver' },
      });
      await notify(session.userId, {
        type: 'job',
        category: 'job_updates',
        title: `Driver assigned for ${job.job_number}`,
        message: `${driver?.contact_name || 'A driver'} has been assigned ($${parseFloat(bid.amount).toFixed(2)}).`,
        referenceId: job.id,
        url: `/client/jobs/${job.id}`,
        data: { job_id: job.id, role: 'client' },
      });
    } catch {}

    return NextResponse.json({ data: result, success: true });
  } catch (err) {
    console.error('POST /api/jobs/[id]/assign error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
