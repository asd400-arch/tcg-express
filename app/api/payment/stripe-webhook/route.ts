import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-server';

// Disable body parsing — Stripe needs the raw body for signature verification
export const runtime = 'nodejs';

// POST /api/payment/stripe-webhook — handle Stripe webhook events
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

  try {
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const { type, user_id, wallet_id } = paymentIntent.metadata || {};

      if (type === 'wallet_topup' && user_id && wallet_id) {
        // Find the pending topup by stripe payment intent ID
        const { data: topup } = await supabaseAdmin
          .from('wallet_topups')
          .select('*')
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .eq('status', 'pending')
          .single();

        if (topup) {
          // Credit wallet via RPC
          await supabaseAdmin.rpc('wallet_credit', {
            p_wallet_id: topup.wallet_id,
            p_user_id: topup.user_id,
            p_amount: topup.amount,
            p_type: 'top_up',
            p_reference_type: 'topup',
            p_reference_id: topup.id,
            p_payment_method: 'stripe_card',
            p_payment_provider_ref: paymentIntent.id,
            p_description: `Card top-up of $${Number(topup.amount).toFixed(2)}`,
            p_metadata: { stripe_payment_intent_id: paymentIntent.id },
          });

          // Update topup to completed
          await supabaseAdmin
            .from('wallet_topups')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', topup.id);
        }
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      const { type } = paymentIntent.metadata || {};

      if (type === 'wallet_topup') {
        await supabaseAdmin
          .from('wallet_topups')
          .update({ status: 'failed' })
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
