import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';
import { getStripe } from '../../../../lib/stripe';

const BONUS_TIERS = [
  { min: 500, bonus: 50 },
  { min: 200, bonus: 15 },
  { min: 100, bonus: 5 },
];

function getBonus(amount) {
  for (const tier of BONUS_TIERS) {
    if (amount >= tier.min) return tier.bonus;
  }
  return 0;
}

export async function POST(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { amount, platform } = await request.json();
  const numAmount = parseFloat(amount);

  if (!numAmount || numAmount < 10 || numAmount > 10000) {
    return NextResponse.json({ error: 'Amount must be between $10 and $10,000' }, { status: 400 });
  }

  const bonus = getBonus(numAmount);
  const stripe = getStripe();

  if (!stripe) {
    // No Stripe configured — simulate direct top-up for testing
    return await directTopup(session.userId, numAmount, bonus);
  }

  try {
    // Create Stripe PaymentIntent with PayNow
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(numAmount * 100), // cents
      currency: 'sgd',
      payment_method_types: ['paynow'],
      metadata: {
        user_id: session.userId,
        type: 'wallet_topup',
        bonus: String(bonus),
      },
    });

    if (platform === 'mobile') {
      return NextResponse.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: numAmount,
        bonus,
      });
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: numAmount,
      bonus,
    });
  } catch (err) {
    console.error('Stripe PaymentIntent error:', err);
    // Fallback to direct topup for testing
    return await directTopup(session.userId, numAmount, bonus);
  }
}

async function directTopup(userId, amount, bonus) {
  // Ensure wallet exists
  let { data: wallet } = await supabaseAdmin
    .from('express_wallets')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!wallet) {
    const { data: w } = await supabaseAdmin
      .from('express_wallets')
      .insert([{ user_id: userId }])
      .select()
      .single();
    wallet = w;
  }

  const newBalance = parseFloat(wallet.balance) + amount;
  const newBonus = parseFloat(wallet.bonus_balance) + bonus;

  await supabaseAdmin
    .from('express_wallets')
    .update({ balance: newBalance.toFixed(2), bonus_balance: newBonus.toFixed(2), updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  // Record topup transaction
  await supabaseAdmin.from('express_wallet_transactions').insert([{
    user_id: userId,
    type: 'topup',
    amount: amount.toFixed(2),
    balance_after: newBalance.toFixed(2),
    description: `Wallet top-up $${amount.toFixed(2)}`,
  }]);

  // Record bonus if any
  if (bonus > 0) {
    await supabaseAdmin.from('express_wallet_transactions').insert([{
      user_id: userId,
      type: 'bonus',
      amount: bonus.toFixed(2),
      balance_after: (newBalance + bonus).toFixed(2),
      description: `Top-up bonus for $${amount.toFixed(2)} deposit`,
    }]);
  }

  return NextResponse.json({
    success: true,
    wallet: { balance: newBalance.toFixed(2), bonus_balance: newBonus.toFixed(2) },
    bonus,
  });
}
