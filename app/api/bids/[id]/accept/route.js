import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';
import { notify } from '../../../../../lib/notify';

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
      .select('id, job_id, driver_id, amount, status')
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
      .select('id, client_id, job_number, status')
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

    // Zero Commission: new drivers within 30 days get 0% commission
    try {
      const { data: driver } = await supabaseAdmin
        .from('express_users')
        .select('created_at')
        .eq('id', bid.driver_id)
        .single();
      if (driver?.created_at) {
        const daysSinceCreation = (Date.now() - new Date(driver.created_at).getTime()) / 86400000;
        if (daysSinceCreation < 30) {
          rate = 0;
          console.log(`[bid/accept] Zero commission applied for new driver ${bid.driver_id} (${Math.floor(daysSinceCreation)} days old)`);
        }
      }
    } catch {}

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
        }),
        notify(session.userId, {
          type: 'job', category: 'job_updates',
          title: `Driver assigned for ${job.job_number}`,
          message: `${driver?.contact_name || 'A driver'} has been assigned ($${parseFloat(bid.amount).toFixed(2)}).`,
          referenceId: bid.job_id,
          url: `/client/jobs/${bid.job_id}`,
        }),
      ]);
    } catch {}

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
