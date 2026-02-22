// ============================================================
// DEPRECATED: Legacy Stripe webhook endpoint
//
// The canonical Stripe webhook is: /api/payment/stripe-webhook
// Configure that URL in Stripe Dashboard → Webhooks.
//
// This endpoint is kept for backward compatibility only.
// It now uses wallet_credit() RPC (same as the canonical endpoint)
// instead of directly updating express_wallets.
// ============================================================

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getStripe } from '../../../../lib/stripe';

export async function POST(request) {
  console.warn(
    'DEPRECATED: /api/webhook/stripe was called. ' +
    'Update Stripe Dashboard to use /api/payment/stripe-webhook instead.'
  );

  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });

  const body = await request.text();
  const sig = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Require signature verification — no more unsigned fallback
  if (!webhookSecret || !sig) {
    console.error('DEPRECATED webhook: missing STRIPE_WEBHOOK_SECRET or stripe-signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    // ============================================================
    // payment_intent.succeeded — credit wallet via RPC
    // ============================================================
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const { user_id, type, wallet_id } = pi.metadata || {};

      if (type === 'wallet_topup' && user_id) {
        // Try the new wallet system first (wallet_topups table)
        const { data: topup } = await supabaseAdmin
          .from('wallet_topups')
          .select('*')
          .eq('stripe_payment_intent_id', pi.id)
          .eq('status', 'pending')
          .single();

        if (topup) {
          // Credit wallet via atomic RPC (same logic as canonical endpoint)
          await supabaseAdmin.rpc('wallet_credit', {
            p_wallet_id: topup.wallet_id,
            p_user_id: topup.user_id,
            p_amount: topup.amount,
            p_type: 'top_up',
            p_reference_type: 'topup',
            p_reference_id: topup.id,
            p_payment_method: 'stripe_card',
            p_payment_provider_ref: pi.id,
            p_description: `Card top-up of $${Number(topup.amount).toFixed(2)}`,
            p_metadata: { stripe_payment_intent_id: pi.id },
          });

          await supabaseAdmin
            .from('wallet_topups')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', topup.id);
        } else if (wallet_id) {
          // Fallback: topup record exists with wallet_id in metadata
          const amount = pi.amount / 100;
          await supabaseAdmin.rpc('wallet_credit', {
            p_wallet_id: wallet_id,
            p_user_id: user_id,
            p_amount: amount,
            p_type: 'top_up',
            p_reference_type: 'stripe_payment',
            p_reference_id: null,
            p_payment_method: 'stripe_card',
            p_payment_provider_ref: pi.id,
            p_description: `Card top-up of $${amount.toFixed(2)}`,
            p_metadata: { stripe_payment_intent_id: pi.id },
          });
        } else {
          console.warn('DEPRECATED webhook: No matching topup record or wallet_id for', pi.id);
        }
      }
    }

    // ============================================================
    // payment_intent.payment_failed — mark topup as failed
    // ============================================================
    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object;
      const { type } = pi.metadata || {};

      if (type === 'wallet_topup') {
        await supabaseAdmin
          .from('wallet_topups')
          .update({ status: 'failed' })
          .eq('stripe_payment_intent_id', pi.id)
          .eq('status', 'pending');
      }
    }
  } catch (err) {
    console.error('DEPRECATED webhook event processing error:', err);
  }

  return NextResponse.json({ received: true });
}
