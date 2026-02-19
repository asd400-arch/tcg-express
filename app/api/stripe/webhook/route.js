import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getStripe } from '../../../../lib/stripe';
import { notify } from '../../../../lib/notify';

export async function POST(request) {
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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { jobId, bidId, clientId, driverId } = session.metadata;

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
        .select('amount')
        .eq('id', bidId)
        .single();
      const amount = parseFloat(bid?.amount || session.amount_total / 100);
      const commission = amount * (rate / 100);
      const payout = amount - commission;

      // Accept bid, reject others
      await supabaseAdmin.from('express_bids').update({ status: 'accepted' }).eq('id', bidId);
      await supabaseAdmin.from('express_bids').update({ status: 'rejected' }).eq('job_id', jobId).neq('id', bidId);

      // Update job
      await supabaseAdmin.from('express_jobs').update({
        status: 'assigned',
        assigned_driver_id: driverId,
        assigned_bid_id: bidId,
        final_amount: amount,
        commission_rate: rate,
        commission_amount: commission.toFixed(2),
        driver_payout: payout.toFixed(2),
      }).eq('id', jobId);

      // Create transaction with Stripe IDs
      await supabaseAdmin.from('express_transactions').insert([{
        job_id: jobId,
        client_id: clientId,
        driver_id: driverId,
        total_amount: amount,
        commission_amount: commission.toFixed(2),
        driver_payout: payout.toFixed(2),
        payment_status: 'held',
        held_at: new Date().toISOString(),
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent,
      }]);

      // Get job number for notification
      const { data: job } = await supabaseAdmin
        .from('express_jobs')
        .select('job_number, pickup_address')
        .eq('id', jobId)
        .single();

      // Notify driver
      await notify(driverId, {
        type: 'job', category: 'bid_activity',
        title: 'Bid accepted!',
        message: `Your bid of $${amount} for ${job?.job_number || 'a job'} has been accepted`,
        emailTemplate: 'bid_accepted',
        emailData: { jobNumber: job?.job_number, amount, pickupAddress: job?.pickup_address },
        url: '/driver/my-jobs',
      });
    } catch (err) {
      console.error('Webhook processing error:', err);
    }
  }

  // checkout.session.expired - no action needed

  return NextResponse.json({ received: true });
}
