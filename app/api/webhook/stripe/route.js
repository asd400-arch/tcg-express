import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getStripe } from '../../../../lib/stripe';

export async function POST(request) {
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });

  const body = await request.text();
  const sig = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      event = JSON.parse(body);
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const { user_id, type, bonus } = pi.metadata || {};

    if (type === 'wallet_topup' && user_id) {
      const amount = pi.amount / 100;
      const bonusAmount = parseFloat(bonus) || 0;

      // Credit wallet
      let { data: wallet } = await supabaseAdmin
        .from('express_wallets')
        .select('*')
        .eq('user_id', user_id)
        .single();

      if (!wallet) {
        const { data: w } = await supabaseAdmin
          .from('express_wallets')
          .insert([{ user_id }])
          .select()
          .single();
        wallet = w;
      }

      const newBalance = parseFloat(wallet.balance) + amount;
      const newBonus = parseFloat(wallet.bonus_balance) + bonusAmount;

      await supabaseAdmin.from('express_wallets').update({
        balance: newBalance.toFixed(2),
        bonus_balance: newBonus.toFixed(2),
        updated_at: new Date().toISOString(),
      }).eq('user_id', user_id);

      await supabaseAdmin.from('express_wallet_transactions').insert([{
        user_id,
        type: 'topup',
        amount: amount.toFixed(2),
        balance_after: newBalance.toFixed(2),
        description: `Wallet top-up via PayNow $${amount.toFixed(2)}`,
        stripe_payment_intent: pi.id,
      }]);

      if (bonusAmount > 0) {
        await supabaseAdmin.from('express_wallet_transactions').insert([{
          user_id,
          type: 'bonus',
          amount: bonusAmount.toFixed(2),
          balance_after: (newBalance + bonusAmount).toFixed(2),
          description: `Top-up bonus for $${amount.toFixed(2)} deposit`,
        }]);
      }
    }
  }

  return NextResponse.json({ received: true });
}
