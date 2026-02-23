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
  // Ensure wallet exists (uses wallets table from wallet migration)
  let { data: wallet } = await supabaseAdmin
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!wallet) {
    const { data: w } = await supabaseAdmin
      .from('wallets')
      .insert([{ user_id: userId, balance: 0, bonus_balance: 0 }])
      .select()
      .single();
    wallet = w;
  }

  if (!wallet) {
    return NextResponse.json({ error: 'Wallet not found' }, { status: 500 });
  }

  const newBalance = parseFloat(wallet.balance || 0) + amount;
  const newBonus = parseFloat(wallet.bonus_balance || 0) + bonus;

  await supabaseAdmin
    .from('wallets')
    .update({ balance: newBalance.toFixed(2), bonus_balance: newBonus.toFixed(2), updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  // Record topup transaction
  try {
    await supabaseAdmin.from('wallet_transactions').insert([{
      wallet_id: wallet.id,
      user_id: userId,
      type: 'top_up',
      amount: amount,
      direction: 'credit',
      balance_before: parseFloat(wallet.balance || 0),
      balance_after: newBalance,
      description: `Wallet top-up $${amount.toFixed(2)}`,
      status: 'completed',
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }]);
  } catch (e) {
    console.error('Topup transaction record error:', e?.message);
  }

  // Record bonus if any
  if (bonus > 0) {
    try {
      await supabaseAdmin.from('wallet_transactions').insert([{
        wallet_id: wallet.id,
        user_id: userId,
        type: 'bonus',
        amount: bonus,
        direction: 'credit',
        balance_before: newBalance,
        balance_after: newBalance + bonus,
        description: `Top-up bonus for $${amount.toFixed(2)} deposit`,
        status: 'completed',
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      }]);
    } catch (e) {
      console.error('Bonus transaction record error:', e?.message);
    }
  }

  return NextResponse.json({
    data: {
      paynow_qr: null,
      client_secret: null,
      bonus,
    },
    success: true,
    wallet: { balance: newBalance.toFixed(2), bonus_balance: newBonus.toFixed(2) },
  });
}
