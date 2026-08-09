import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';
import { notify } from '../../../../../lib/notify';
import { buildPaymentsBreakdown } from '../../../../../lib/bid-breakdown';
import { getCommissionRate } from '../../../../../lib/zero-commission';

// POST: Client accepts a driver's bid — uses atomic process_bid_acceptance RPC
export async function POST(request, { params }) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'client') return NextResponse.json({ error: 'Only clients can accept bids' }, { status: 403 });

    const { id } = await params;

    // Fetch the bid
    const { data: bid, error: bidErr } = await supabaseAdmin
      .from('express_bids')
      .select('id, job_id, driver_id, amount, status, equipment_charges')
      .eq('id', id)
      .single();

    if (bidErr || !bid) {
      console.error('[bid/accept] Bid not found:', { bidId: id, bidErr: bidErr?.message, bidData: bid });
      return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
    }
    if (bid.status !== 'pending') {
      console.warn('[bid/accept] Bid no longer pending:', { bidId: id, bidStatus: bid.status, jobId: bid.job_id });
      return NextResponse.json({ error: 'Bid is no longer pending' }, { status: 400 });
    }

    // Verify job belongs to this client
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('express_jobs')
      .select('id, client_id, job_number, status, fare_breakdown, coupon_discount')
      .eq('id', bid.job_id)
      .single();

    if (jobErr || !job) {
      console.error('Accept bid — Job not found:', { bidId: id, jobIdFromBid: bid.job_id, jobErr: jobErr?.message, jobData: job, bidDetails: { id: bid.id, status: bid.status, driver_id: bid.driver_id, amount: bid.amount } });
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (job.client_id !== session.userId) return NextResponse.json({ error: 'Not your job' }, { status: 403 });
    if (!['open', 'bidding'].includes(job.status)) {
      return NextResponse.json({ error: 'Job is no longer accepting bids' }, { status: 400 });
    }

    // Get commission rate from settings (default 15%)
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

    // Idempotency key
    const idempotencyKey = `accept_${job.id}_${bid.id}`;

    // ATOMIC: single RPC call does wallet debit + bid accept + job assign + escrow
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
      console.error('[bid/accept] RPC error:', { msg, bidId: id, jobId: job.id, payerId: session.userId, bidAmount: bid.amount, idempotencyKey });
      if (msg.includes('Insufficient balance')) {
        const match = msg.match(/Available: ([0-9.]+), Required: ([0-9.]+)/);
        return NextResponse.json({
          error: 'Insufficient wallet balance',
          available: match ? match[1] : '0.00',
          required: match ? match[2] : '0.00',
        }, { status: 400 });
      }
      if (msg.includes('no longer accepting') || msg.includes('no longer pending')) {
        return NextResponse.json({ error: 'This bid is no longer available' }, { status: 409 });
      }
      console.error('accept bid RPC error:', msg);
      return NextResponse.json({ error: 'Payment processing failed. Please try again.' }, { status: 500 });
    }

    // Handle idempotent re-request
    if (result?.already_processed) {
      return NextResponse.json({ success: true, data: { job_id: bid.job_id, amount: bid.amount, note: 'Already processed' } });
    }

    // Promote inquiry thread → job_chat (non-fatal)
    try {
      const { promoteInquiry } = await import('../../../../../lib/promote-inquiry.js');
      await promoteInquiry(bid.job_id, bid.driver_id);
    } catch (e) {
      console.error('[bid/accept] promoteInquiry error:', e);
    }

    // Create payments record with fare breakdown (non-fatal — response already succeeded)
    try {
      const { data: customerTx } = await supabaseAdmin
        .from('wallet_transactions')
        .select('id')
        .eq('user_id', session.userId)
        .eq('reference_type', 'job')
        .eq('reference_id', job.id)
        .eq('type', 'payment')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const breakdown = buildPaymentsBreakdown(
        bid.equipment_charges,
        job.fare_breakdown,
        job.coupon_discount,
      );

      await supabaseAdmin.from('payments').insert({
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
        customer_wallet_tx_id: customerTx?.id || null,
        paid_at:              new Date().toISOString(),
      });
    } catch (pmtErr) {
      console.error('[bid/accept] payments insert failed (non-fatal):', pmtErr?.message);
    }

    // Notifications (non-critical)
    try {
      const [driverRes, clientRes] = await Promise.all([
        supabaseAdmin.from('express_users').select('contact_name, phone, vehicle_type, vehicle_plate, driver_rating').eq('id', bid.driver_id).single(),
        supabaseAdmin.from('express_users').select('contact_name, phone, company_name').eq('id', session.userId).single(),
      ]);
      const driver = driverRes.data;
      const client = clientRes.data;

      await Promise.all([
        notify(bid.driver_id, {
          type: 'job', category: 'bid_activity',
          title: `Job ${job.job_number} assigned to you!`,
          message: `Your bid of $${parseFloat(bid.amount).toFixed(2)} has been accepted.${client ? `\nClient: ${client.contact_name}${client.phone ? ` (${client.phone})` : ''}` : ''}`,
          referenceId: bid.job_id,
          url: '/driver/my-jobs',
          data: { job_id: bid.job_id, role: 'driver' },
        }),
        notify(session.userId, {
          type: 'job', category: 'job_updates',
          title: `Driver assigned for ${job.job_number}`,
          message: `${driver?.contact_name || 'A driver'} has been assigned ($${parseFloat(bid.amount).toFixed(2)}).`,
          referenceId: bid.job_id,
          url: `/client/jobs/${bid.job_id}`,
          data: { job_id: bid.job_id, role: 'client' },
        }),
      ]);
    } catch (notifyErr) {
      console.error('[notify-dispatch] bid accept failed:', notifyErr?.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        job_id: bid.job_id,
        amount: bid.amount,
        payout: result.payout ? parseFloat(result.payout).toFixed(2) : undefined,
        walletBalance: result.wallet_balance ? parseFloat(result.wallet_balance).toFixed(2) : undefined,
      },
    });
  } catch (err) {
    console.error('Accept bid error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
