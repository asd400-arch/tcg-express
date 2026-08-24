import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-server';
import { completeStripeTopup } from '@/lib/walletService';

// Disable body parsing — Stripe needs the raw body for signature verification
export const runtime = 'nodejs';

// POST /api/payment/stripe-webhook — handle Stripe webhook events
//
// Wallet top-ups (card AND PayNow-via-Stripe) are credited here
// automatically on payment_intent.succeeded — no admin confirmation.
// Configure this URL in Stripe Dashboard → Webhooks with events:
//   payment_intent.succeeded, payment_intent.payment_failed,
//   payment_intent.canceled
export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const body = await request.text();
  const sig = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // ============================================================
  // Idempotency: skip events we've already processed.
  // Tolerates the tracking table being absent (falls through to
  // the per-topup status guard inside completeStripeTopup).
  // ============================================================
  // Namespaced per endpoint — the job-payment webhook (/api/stripe/webhook)
  // may receive the same Stripe event id via its own endpoint subscription.
  const idempotencyId = `${event.id}:wallet`;
  try {
    const { data: existing } = await supabaseAdmin
      .from('processed_webhook_events')
      .select('event_id')
      .eq('event_id', idempotencyId)
      .single();

    if (existing) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    await supabaseAdmin.from('processed_webhook_events').insert({
      event_id: idempotencyId,
      event_type: event.type,
      metadata: { livemode: event.livemode },
    });
  } catch (idempErr: any) {
    if (idempErr?.code === '23505') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error('Webhook idempotency check error:', idempErr?.message);
  }

  try {
    // ============================================================
    // payment_intent.succeeded — auto-credit wallet top-ups
    // (works for both stripe_card and PayNow-via-Stripe top-ups)
    // ============================================================
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent: any = event.data.object;
      const { type } = paymentIntent.metadata || {};

      if (type === 'wallet_topup') {
        try {
          const topup = await completeStripeTopup(paymentIntent);
          if (!topup) {
            console.warn('[stripe-webhook] No pending topup for', paymentIntent.id);
          }
        } catch (creditErr: any) {
          console.error('[stripe-webhook] auto-credit failed:', creditErr?.message);
          return NextResponse.json({ received: true, error: 'Credit failed' });
        }
      }
    }

    // ============================================================
    // payment_intent.payment_failed — mark topup as failed
    // ============================================================
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent: any = event.data.object;
      const { type } = paymentIntent.metadata || {};

      if (type === 'wallet_topup') {
        await supabaseAdmin
          .from('wallet_topups')
          .update({ status: 'failed' })
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .eq('status', 'pending');
      }
    }

    // ============================================================
    // payment_intent.canceled — mark topup as cancelled
    // (e.g. PayNow QR expired without payment)
    // ============================================================
    if (event.type === 'payment_intent.canceled') {
      const paymentIntent: any = event.data.object;
      const { type } = paymentIntent.metadata || {};

      if (type === 'wallet_topup') {
        await supabaseAdmin
          .from('wallet_topups')
          .update({ status: 'cancelled' })
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .eq('status', 'pending');
      }
    }
  } catch (err) {
    console.error('Webhook event processing error:', err);
    // Still return 200 to acknowledge receipt
  }

  return NextResponse.json({ received: true });
}
