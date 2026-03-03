import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getStripe } from '../../../../lib/stripe';
import { notify } from '../../../../lib/notify';

export async function POST(request) {
  // Return 200 immediately on any error to prevent Stripe retries for bad requests
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const sig = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  let event;
  try {
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // ============================================================
  // IDEMPOTENCY: Check if this event was already processed
  // ============================================================
  try {
    const { data: existing } = await supabaseAdmin
      .from('processed_webhook_events')
      .select('event_id')
      .eq('event_id', event.id)
      .single();

    if (existing) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    await supabaseAdmin.from('processed_webhook_events').insert({
      event_id: event.id,
      event_type: event.type,
      metadata: { livemode: event.livemode },
    });
  } catch (idempErr) {
    if (idempErr?.code === '23505') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error('Webhook idempotency check error:', idempErr?.message);
  }

  // Handle both checkout.session.completed (web) and payment_intent.succeeded (mobile)
  if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
    const eventObject = event.data.object;
    const metadata = eventObject.metadata || {};
    const { jobId, bidId, clientId } = metadata;

    if (!jobId || !bidId) {
      return NextResponse.json({ received: true });
    }

    try {
      // Get bid to check status
      const { data: bid } = await supabaseAdmin
        .from('express_bids')
        .select('amount, status')
        .eq('id', bidId)
        .single();

      // Guard: bid already accepted (race condition with wallet payment)
      if (bid?.status === 'accepted') {
        return NextResponse.json({ received: true, note: 'bid already accepted' });
      }

      // Get commission rate
      let rate = 15;
      const { data: settingsData } = await supabaseAdmin
        .from('express_settings')
        .select('value')
        .eq('key', 'commission_rate')
        .single();
      if (settingsData?.value) rate = parseFloat(settingsData.value);

      // Use atomic RPC — wallet debit + bid accept + job assign + escrow
      const idempotencyKey = `stripe_${jobId}_${bidId}`;
      const { data: result, error: rpcErr } = await supabaseAdmin.rpc('process_bid_acceptance', {
        p_job_id: jobId,
        p_bid_id: bidId,
        p_payer_id: clientId,
        p_commission_rate: rate,
        p_coupon_discount: 0,
        p_coupon_id: null,
        p_idempotency_key: idempotencyKey,
      });

      if (rpcErr) {
        const msg = rpcErr.message || '';
        console.error('[stripe/webhook] process_bid_acceptance FAILED:', { msg, jobId, bidId, clientId });

        // If wallet insufficient but Stripe already charged, we need to handle this
        // The Stripe charge succeeded so the money is collected — log for manual resolution
        if (msg.includes('Insufficient balance')) {
          console.error('[stripe/webhook] CRITICAL: Stripe charged but wallet debit failed — needs manual resolution', { jobId, bidId, clientId });
        }
        return NextResponse.json({ received: true, error: msg });
      }

      if (result?.already_processed) {
        return NextResponse.json({ received: true, note: 'already processed' });
      }

      // Notify driver (non-critical)
      try {
        const { data: job } = await supabaseAdmin
          .from('express_jobs')
          .select('job_number, pickup_address')
          .eq('id', jobId)
          .single();

        const driverId = result.driver_id;
        await notify(driverId, {
          type: 'job', category: 'bid_activity',
          title: 'Bid accepted!',
          message: `Your bid of $${parseFloat(result.bid_amount).toFixed(2)} for ${job?.job_number || 'a job'} has been accepted`,
          url: '/driver/my-jobs',
        });
      } catch {}
    } catch (err) {
      console.error('Webhook processing error:', err);
    }
  }

  return NextResponse.json({ received: true });
}
