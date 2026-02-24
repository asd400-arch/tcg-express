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
      // Already processed — return 200 immediately
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Mark as processing (insert immediately to prevent race with parallel webhook delivery)
    await supabaseAdmin.from('processed_webhook_events').insert({
      event_id: event.id,
      event_type: event.type,
      metadata: { livemode: event.livemode },
    });
  } catch (idempErr) {
    // If insert fails due to duplicate key, another process already handles it
    if (idempErr?.code === '23505') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    // Non-critical — proceed with processing even if idempotency check fails
    console.error('Webhook idempotency check error:', idempErr?.message);
  }

  // Handle both checkout.session.completed (web) and payment_intent.succeeded (mobile)
  if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
    const eventObject = event.data.object;
    const metadata = eventObject.metadata || {};
    const { jobId, bidId, clientId, driverId } = metadata;

    if (!jobId || !bidId) {
      return NextResponse.json({ received: true });
    }

    try {
      // Get commission rate
      let rate = 15;
      const { data: settingsData } = await supabaseAdmin
        .from('express_settings')
        .select('value')
        .eq('key', 'commission_rate')
        .single();
      if (settingsData?.value) rate = parseFloat(settingsData.value);

      // Get bid amount
      const { data: bid } = await supabaseAdmin
        .from('express_bids')
        .select('amount, status')
        .eq('id', bidId)
        .single();

      // Guard: bid already accepted (race condition with wallet payment)
      if (bid?.status === 'accepted') {
        return NextResponse.json({ received: true, note: 'bid already accepted' });
      }

      const fallbackAmount = event.type === 'checkout.session.completed'
        ? eventObject.amount_total / 100
        : eventObject.amount / 100;
      const amount = parseFloat(bid?.amount || fallbackAmount);

      if (!amount || !isFinite(amount) || amount <= 0) {
        console.error('Webhook: invalid bid amount', { bidId, amount });
        return NextResponse.json({ received: true });
      }

      const commission = ROUND_2(amount * (rate / 100));
      const payout = amount - commission;

      // Accept bid + outbid others (use WHERE status check for optimistic locking)
      const { error: acceptErr } = await supabaseAdmin
        .from('express_bids')
        .update({ status: 'accepted' })
        .eq('id', bidId)
        .eq('status', 'pending');

      if (acceptErr) {
        console.error('Webhook: bid accept failed', acceptErr.message);
        return NextResponse.json({ received: true });
      }

      await supabaseAdmin.from('express_bids')
        .update({ status: 'outbid' })
        .eq('job_id', jobId).neq('id', bidId).eq('status', 'pending');

      // Update job (optimistic lock on status)
      await supabaseAdmin.from('express_jobs').update({
        status: 'assigned',
        assigned_driver_id: driverId,
        assigned_bid_id: bidId,
        final_amount: amount,
        commission_rate: rate,
        commission_amount: commission.toFixed(2),
        driver_payout: payout.toFixed(2),
      }).eq('id', jobId).in('status', ['open', 'bidding']);

      // Create escrow with Stripe IDs
      const stripePaymentIntentId = event.type === 'checkout.session.completed'
        ? eventObject.payment_intent
        : eventObject.id;

      await supabaseAdmin.from('express_transactions').insert([{
        job_id: jobId,
        client_id: clientId,
        driver_id: driverId,
        total_amount: amount,
        commission_amount: commission.toFixed(2),
        driver_payout: payout.toFixed(2),
        payment_status: 'held',
        held_at: new Date().toISOString(),
        stripe_checkout_session_id: event.type === 'checkout.session.completed' ? eventObject.id : null,
        stripe_payment_intent_id: stripePaymentIntentId,
      }]);

      // Notify driver (non-critical)
      try {
        const { data: job } = await supabaseAdmin
          .from('express_jobs')
          .select('job_number, pickup_address')
          .eq('id', jobId)
          .single();

        await notify(driverId, {
          type: 'job', category: 'bid_activity',
          title: 'Bid accepted!',
          message: `Your bid of $${amount.toFixed(2)} for ${job?.job_number || 'a job'} has been accepted`,
          url: '/driver/my-jobs',
        });
      } catch {}
    } catch (err) {
      console.error('Webhook processing error:', err);
    }
  }

  return NextResponse.json({ received: true });
}

function ROUND_2(n) {
  return Math.round(n * 100) / 100;
}
