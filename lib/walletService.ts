// ============================================================
// Wallet Service - Server-side wallet operations
// Uses Supabase service role client (bypasses RLS)
// ============================================================

import { supabaseAdmin } from './supabase-server';
import { getStripe } from './stripe';
import { generatePayNowQR } from './paynow-qr';
import { WALLET_CONSTANTS } from '@/types/wallet';
import type {
  Wallet,
  WalletTransaction,
  WalletTopup,
  WalletWithdrawal,
  WalletOverview,
  TopupResponse,
  WithdrawalRequest,
  Payment,
  PromoCode,
  PaymentMethodType,
  WithdrawalMethod,
  FareBreakdown,
} from '@/types/wallet';

// ============================================================
// 0. attachFareBreakdown — enrich payment transactions with fare data
// ============================================================

async function attachFareBreakdown(transactions: WalletTransaction[]): Promise<void> {
  const paymentTxIds = transactions
    .filter(tx => tx.type === 'payment')
    .map(tx => tx.id);
  if (paymentTxIds.length === 0) return;

  const { data: payments } = await supabaseAdmin
    .from('payments')
    .select('customer_wallet_tx_id, base_fare, distance_surcharge, urgency_surcharge, helper_fee, special_handling_fee, save_mode_discount, ev_discount, promo_discount, total_amount')
    .in('customer_wallet_tx_id', paymentTxIds);

  if (!payments?.length) return;

  const paymentMap = new Map<string, FareBreakdown>(
    payments.map(p => [p.customer_wallet_tx_id as string, {
      base_fare:            Number(p.base_fare),
      distance_surcharge:   Number(p.distance_surcharge),
      urgency_surcharge:    Number(p.urgency_surcharge),
      helper_fee:           Number(p.helper_fee),
      special_handling_fee: Number(p.special_handling_fee),
      save_mode_discount:   Number(p.save_mode_discount),
      ev_discount:          Number(p.ev_discount),
      promo_discount:       Number(p.promo_discount),
      total_amount:         Number(p.total_amount),
    }])
  );

  for (const tx of transactions) {
    if (tx.type === 'payment') {
      const breakdown = paymentMap.get(tx.id);
      if (breakdown) tx.fare_breakdown = breakdown;
    }
  }
}

// --- Top-up Bonus Tiers (non-withdrawable credits) ---
const TOPUP_BONUSES: Record<number, number> = {
  1000: 75,  // $1000+ → +$75 (7.5%)
  500: 25,   // $500+  → +$25 (5%)
};

function getBonusAmount(topupAmount: number): number {
  if (topupAmount >= 1000) return 75;
  if (topupAmount >= 500) return 25;
  return 0;
}

// ============================================================
// 0b. applyTopupBonus — credit tiered bonus (non-withdrawable)
// Shared by the manual admin-confirm path and the Stripe
// webhook auto-credit path so both apply the same bonus rules.
// ============================================================

export async function applyTopupBonus(topup: {
  id: string;
  wallet_id: string;
  user_id: string;
  amount: number | string;
}): Promise<number> {
  const bonusAmount = getBonusAmount(Number(topup.amount));
  if (bonusAmount <= 0) return 0;

  // Guard: never credit the same topup's bonus twice
  const { data: existingBonus } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id')
    .eq('reference_type', 'topup_bonus')
    .eq('reference_id', topup.id)
    .limit(1);
  if (existingBonus && existingBonus.length > 0) return 0;

  await supabaseAdmin.rpc('wallet_credit', {
    p_wallet_id: topup.wallet_id,
    p_user_id: topup.user_id,
    p_amount: bonusAmount,
    p_type: 'bonus',
    p_reference_type: 'topup_bonus',
    p_reference_id: topup.id,
    p_payment_method: 'system',
    p_payment_provider_ref: null,
    p_description: `Top-up bonus: +$${bonusAmount.toFixed(2)} for $${Number(topup.amount).toFixed(2)} top-up`,
    p_metadata: { bonus_type: 'topup', non_withdrawable: true },
  });

  // Track in bonus_balance (non-withdrawable portion)
  const { data: currentWallet } = await supabaseAdmin
    .from('wallets')
    .select('bonus_balance')
    .eq('id', topup.wallet_id)
    .single();

  await supabaseAdmin
    .from('wallets')
    .update({ bonus_balance: Number(currentWallet?.bonus_balance || 0) + bonusAmount })
    .eq('id', topup.wallet_id);

  return bonusAmount;
}

// ============================================================
// 1. getOrCreateWallet
// ============================================================

export async function getOrCreateWallet(userId: string): Promise<Wallet> {
  const { data: wallet, error } = await supabaseAdmin
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (wallet) return wallet as Wallet;

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch wallet: ${error.message}`);
  }

  // Create wallet if not found
  const { data: newWallet, error: createError } = await supabaseAdmin
    .from('wallets')
    .insert({ user_id: userId })
    .select()
    .single();

  if (createError) throw new Error(`Failed to create wallet: ${createError.message}`);
  return newWallet as Wallet;
}

// ============================================================
// 2. getWalletOverview
// ============================================================

export async function getWalletOverview(userId: string): Promise<WalletOverview> {
  const wallet = await getOrCreateWallet(userId);

  // Start of current month in ISO
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [txResult, withdrawalResult, monthlyResult] = await Promise.all([
    // Last 20 transactions
    supabaseAdmin
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),

    // Pending withdrawals
    supabaseAdmin
      .from('wallet_withdrawals')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'approved', 'processing']),

    // Monthly aggregates
    supabaseAdmin
      .from('wallet_transactions')
      .select('type, direction, amount')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('created_at', monthStart),
  ]);

  if (txResult.error) throw new Error(`Failed to fetch transactions: ${txResult.error.message}`);
  if (withdrawalResult.error) throw new Error(`Failed to fetch withdrawals: ${withdrawalResult.error.message}`);
  if (monthlyResult.error) throw new Error(`Failed to fetch monthly stats: ${monthlyResult.error.message}`);

  // Calculate monthly stats
  let monthly_earned = 0;
  let monthly_spent = 0;
  let monthly_withdrawn = 0;

  for (const tx of monthlyResult.data || []) {
    const amount = Number(tx.amount);
    if (tx.type === 'earning' || tx.type === 'commission') {
      monthly_earned += amount;
    } else if (tx.type === 'payment') {
      monthly_spent += amount;
    } else if (tx.type === 'withdrawal') {
      monthly_withdrawn += amount;
    }
  }

  const recentTransactions = (txResult.data || []) as WalletTransaction[];
  await attachFareBreakdown(recentTransactions);

  return {
    wallet,
    recent_transactions: recentTransactions,
    pending_withdrawals: (withdrawalResult.data || []) as WalletWithdrawal[],
    monthly_earned: Math.round(monthly_earned * 100) / 100,
    monthly_spent: Math.round(monthly_spent * 100) / 100,
    monthly_withdrawn: Math.round(monthly_withdrawn * 100) / 100,
  };
}

// ============================================================
// 3. getTransactionHistory
// ============================================================

export async function getTransactionHistory(
  userId: string,
  page: number = 1,
  limit: number = 20,
  type?: string
): Promise<{ transactions: WalletTransaction[]; total: number }> {
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('wallet_transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error, count } = await query;

  if (error) throw new Error(`Failed to fetch transactions: ${error.message}`);

  const transactions = (data || []) as WalletTransaction[];
  await attachFareBreakdown(transactions);

  return { transactions, total: count ?? 0 };
}

// ============================================================
// 3b. pickUniqueTopupAmount — unique-cent amount assignment
//
// Direct-UEN PayNow transfers carry no reference we can rely on,
// so each pending top-up is assigned a unique cent suffix
// (e.g. $50 → $50.07). The bank's incoming-credit alert is then
// matched to exactly one pending top-up by the exact amount.
// The customer is credited exactly what they paid.
// ============================================================

async function pickUniqueTopupAmount(baseAmount: number): Promise<number> {
  const baseCents = Math.round(baseAmount * 100);

  // Cents already taken by pending, unexpired PayNow top-ups in [base, base+0.99]
  const { data: pending } = await supabaseAdmin
    .from('wallet_topups')
    .select('amount')
    .eq('status', 'pending')
    .eq('payment_method', 'paynow')
    .gte('amount', baseCents / 100)
    .lte('amount', (baseCents + 99) / 100)
    .gt('expires_at', new Date().toISOString());

  const used = new Set(
    (pending || []).map(t => Math.round(Number(t.amount) * 100) - baseCents)
  );

  for (let k = 0; k <= 99; k++) {
    const candidate = (baseCents + k) / 100;
    if (candidate > WALLET_CONSTANTS.MAX_TOPUP) break;
    if (!used.has(k)) return candidate;
  }
  throw new Error('Too many pending top-ups for this amount right now. Please try again in a few minutes.');
}

// ============================================================
// 3c. autoConfirmTopupByAmount — bank-alert auto reconciliation
//
// Called when the company bank account reports an incoming
// PayNow credit (via /api/wallet/paynow-incoming). Matches the
// exact amount to a single pending manual top-up and credits it
// with NO admin involvement. Ambiguous matches (should not
// happen thanks to unique-cent amounts) are left for the admin.
// ============================================================

export async function autoConfirmTopupByAmount(
  amount: number,
  bankReference?: string
): Promise<WalletTopup | null> {
  // Tiny window around the amount to avoid float-equality issues,
  // and a 10-minute grace period past QR expiry (bank alerts lag).
  const graceCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: matches } = await supabaseAdmin
    .from('wallet_topups')
    .select('*')
    .eq('status', 'pending')
    .eq('payment_method', 'paynow')
    .is('stripe_payment_intent_id', null)
    .gte('amount', amount - 0.005)
    .lte('amount', amount + 0.005)
    .gt('expires_at', graceCutoff);

  if (!matches || matches.length === 0) return null;
  if (matches.length > 1) {
    console.warn('[autoConfirmTopupByAmount] Ambiguous amount match — leaving for admin:', { amount, count: matches.length });
    return null;
  }

  const topup = matches[0];

  const { error: creditErr } = await supabaseAdmin.rpc('wallet_credit', {
    p_wallet_id: topup.wallet_id,
    p_user_id: topup.user_id,
    p_amount: topup.amount,
    p_type: 'top_up',
    p_reference_type: 'topup',
    p_reference_id: topup.id,
    p_payment_method: 'paynow',
    p_payment_provider_ref: bankReference || 'bank_alert',
    p_description: `PayNow top-up of $${Number(topup.amount).toFixed(2)}`,
    p_metadata: { auto_matched: true, bank_reference: bankReference || null },
  });

  if (creditErr) {
    console.error('[autoConfirmTopupByAmount] wallet_credit FAILED:', { topupId: topup.id, error: creditErr.message });
    throw new Error(`Credit failed: ${creditErr.message}`);
  }

  const { data: updated } = await supabaseAdmin
    .from('wallet_topups')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', topup.id)
    .select()
    .single();

  try {
    await applyTopupBonus(topup);
  } catch (e: any) {
    console.error('[autoConfirmTopupByAmount] bonus credit failed (non-fatal):', e?.message);
  }

  return (updated || topup) as WalletTopup;
}

// ============================================================
// 4. createPayNowTopup
// ============================================================

export async function createPayNowTopup(
  userId: string,
  amount: number,
  reference?: string
): Promise<TopupResponse> {
  if (amount < WALLET_CONSTANTS.MIN_TOPUP || amount > WALLET_CONSTANTS.MAX_TOPUP) {
    throw new Error(`Top-up amount must be between $${WALLET_CONSTANTS.MIN_TOPUP} and $${WALLET_CONSTANTS.MAX_TOPUP}`);
  }

  const wallet = await getOrCreateWallet(userId);
  const ref = (reference || '').trim();
  if (!ref) throw new Error('PayNow reference is required');
  const referenceId = ref.slice(0, 25);

  // Unique-cent amount: lets the bank-alert reconciler identify this
  // exact top-up (e.g. $50 → $50.07). Customer pays and is credited
  // this exact amount.
  const uniqueAmount = await pickUniqueTopupAmount(amount);
  const qrString = generatePayNowQR(uniqueAmount);

  const expiry = new Date(Date.now() + WALLET_CONSTANTS.PAYNOW_QR_EXPIRY_MINUTES * 60 * 1000).toISOString();

  const { data: topup, error } = await supabaseAdmin
    .from('wallet_topups')
    .insert({
      wallet_id: wallet.id,
      user_id: userId,
      amount: uniqueAmount,
      payment_method: 'paynow',
      paynow_qr_data: qrString,
      paynow_reference: referenceId,
      paynow_expiry: expiry,
      status: 'pending',
      expires_at: expiry,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create top-up: ${error.message}`);

  return {
    topup: topup as WalletTopup,
    mode: 'manual',
    paynow_qr: {
      qr_string: qrString,
      reference: referenceId,
      amount: uniqueAmount,
      expiry,
      // Bank-registered PayNow name — still the former company name until
      // DBS processes the ACRA change. Must match what the customer's
      // banking app shows. Flip to 'Tech Chain Global Pte Ltd' after DBS
      // confirms (and update lib/paynow-qr.js field 59 together).
      recipient_name: 'HHI Solutions Pte Ltd',
      uen: '202005872W',
    },
  };
}

// ============================================================
// 5. confirmPayNowTopup
// ============================================================

export async function confirmPayNowTopup(
  paynowReference: string,
  adminId?: string
): Promise<WalletTopup> {
  // Find pending topup by PayNow reference
  const { data: topup, error: findError } = await supabaseAdmin
    .from('wallet_topups')
    .select('*')
    .eq('paynow_reference', paynowReference)
    .eq('status', 'pending')
    .single();

  if (findError || !topup) {
    throw new Error('Pending top-up not found for this reference');
  }

  // Check expiry
  if (topup.paynow_expiry && new Date(topup.paynow_expiry) < new Date()) {
    await supabaseAdmin
      .from('wallet_topups')
      .update({ status: 'expired' })
      .eq('id', topup.id);
    throw new Error('Top-up QR code has expired');
  }

  // Credit wallet via RPC
  const { error: rpcError } = await supabaseAdmin.rpc('wallet_credit', {
    p_wallet_id: topup.wallet_id,
    p_user_id: topup.user_id,
    p_amount: topup.amount,
    p_type: 'top_up',
    p_reference_type: 'topup',
    p_reference_id: topup.id,
    p_payment_method: 'paynow',
    p_payment_provider_ref: paynowReference,
    p_description: `PayNow top-up of $${Number(topup.amount).toFixed(2)}`,
    p_metadata: { paynow_reference: paynowReference },
  });

  if (rpcError) throw new Error(`Failed to credit wallet: ${rpcError.message}`);

  // Update topup record to completed
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('wallet_topups')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      admin_verified_by: adminId || null,
      admin_verified_at: adminId ? new Date().toISOString() : null,
    })
    .eq('id', topup.id)
    .select()
    .single();

  if (updateError) throw new Error(`Failed to update top-up: ${updateError.message}`);

  // Credit bonus if eligible (non-withdrawable)
  await applyTopupBonus(topup);

  return updated as WalletTopup;
}

// ============================================================
// 5b. createStripePayNowTopup — automatic PayNow via Stripe
//
// Creates a Stripe PaymentIntent with the 'paynow' payment
// method and confirms it server-side. Stripe returns a SGQR
// string in next_action.paynow_display_qr_code — the customer
// scans it with any SG banking app, Stripe receives the funds,
// and the payment_intent.succeeded webhook credits the wallet
// automatically. NO admin confirmation involved.
// ============================================================

export async function createStripePayNowTopup(
  userId: string,
  amount: number
): Promise<TopupResponse> {
  if (amount < WALLET_CONSTANTS.MIN_TOPUP || amount > WALLET_CONSTANTS.MAX_TOPUP) {
    throw new Error(`Top-up amount must be between $${WALLET_CONSTANTS.MIN_TOPUP} and $${WALLET_CONSTANTS.MAX_TOPUP}`);
  }

  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe is not configured');

  const wallet = await getOrCreateWallet(userId);

  // Create + confirm PaymentIntent (amount in cents).
  // Confirming a 'paynow' intent server-side yields the QR code
  // in next_action without needing Stripe.js on the client.
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: 'sgd',
    payment_method_types: ['paynow'],
    payment_method_data: { type: 'paynow' },
    confirm: true,
    metadata: {
      type: 'wallet_topup',
      user_id: userId,
      wallet_id: wallet.id,
    },
  });

  const qrAction: any = (paymentIntent.next_action as any)?.paynow_display_qr_code;
  if (!qrAction?.data) {
    // Stripe accepted the intent but returned no QR — cancel and bail
    try { await stripe.paymentIntents.cancel(paymentIntent.id); } catch {}
    throw new Error('Failed to generate PayNow QR via Stripe');
  }

  const expiry = new Date(Date.now() + WALLET_CONSTANTS.PAYNOW_QR_EXPIRY_MINUTES * 60 * 1000).toISOString();

  const { data: topup, error } = await supabaseAdmin
    .from('wallet_topups')
    .insert({
      wallet_id: wallet.id,
      user_id: userId,
      amount,
      payment_method: 'paynow',
      paynow_qr_data: qrAction.data,
      paynow_reference: paymentIntent.id.slice(0, 50),
      paynow_expiry: expiry,
      stripe_payment_intent_id: paymentIntent.id,
      stripe_client_secret: paymentIntent.client_secret,
      status: 'pending',
      expires_at: expiry,
    })
    .select()
    .single();

  if (error) {
    try { await stripe.paymentIntents.cancel(paymentIntent.id); } catch {}
    throw new Error(`Failed to create top-up: ${error.message}`);
  }

  return {
    topup: topup as WalletTopup,
    mode: 'auto',
    paynow_qr: {
      qr_string: qrAction.data,
      reference: paymentIntent.id,
      amount,
      expiry,
      recipient_name: 'TCG Express (via Stripe)',
      uen: '202005872W',
      hosted_instructions_url: qrAction.hosted_instructions_url || null,
    },
  };
}

// ============================================================
// 5c. completeStripeTopup — webhook-side auto credit
//
// Called from the Stripe webhook on payment_intent.succeeded.
// Finds the pending topup by PaymentIntent id, credits the
// wallet atomically, marks the topup completed, and applies
// the tiered bonus. Idempotent: a topup already completed
// (or not found pending) is a no-op.
// ============================================================

export async function completeStripeTopup(paymentIntent: {
  id: string;
  metadata?: Record<string, string>;
}): Promise<WalletTopup | null> {
  const { data: topup } = await supabaseAdmin
    .from('wallet_topups')
    .select('*')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .eq('status', 'pending')
    .single();

  if (!topup) return null; // already processed or unknown — idempotent no-op

  const isPayNow = topup.payment_method === 'paynow';

  const { error: creditErr } = await supabaseAdmin.rpc('wallet_credit', {
    p_wallet_id: topup.wallet_id,
    p_user_id: topup.user_id,
    p_amount: topup.amount,
    p_type: 'top_up',
    p_reference_type: 'topup',
    p_reference_id: topup.id,
    p_payment_method: isPayNow ? 'paynow' : 'stripe_card',
    p_payment_provider_ref: paymentIntent.id,
    p_description: `${isPayNow ? 'PayNow' : 'Card'} top-up of $${Number(topup.amount).toFixed(2)}`,
    p_metadata: { stripe_payment_intent_id: paymentIntent.id, auto_credited: true },
  });

  if (creditErr) {
    console.error('[completeStripeTopup] wallet_credit FAILED:', { topupId: topup.id, error: creditErr.message });
    await supabaseAdmin.from('wallet_topups').update({ status: 'failed' }).eq('id', topup.id);
    throw new Error(`Credit failed: ${creditErr.message}`);
  }

  const { data: updated } = await supabaseAdmin
    .from('wallet_topups')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', topup.id)
    .select()
    .single();

  // Apply tiered bonus (idempotent — guarded inside)
  try {
    await applyTopupBonus(topup);
  } catch (e: any) {
    console.error('[completeStripeTopup] bonus credit failed (non-fatal):', e?.message);
  }

  return (updated || topup) as WalletTopup;
}

// ============================================================
// 6. createStripeTopup
// ============================================================

export async function createStripeTopup(
  userId: string,
  amount: number
): Promise<TopupResponse> {
  if (amount < WALLET_CONSTANTS.MIN_TOPUP || amount > WALLET_CONSTANTS.MAX_TOPUP) {
    throw new Error(`Top-up amount must be between $${WALLET_CONSTANTS.MIN_TOPUP} and $${WALLET_CONSTANTS.MAX_TOPUP}`);
  }

  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe is not configured');

  const wallet = await getOrCreateWallet(userId);

  // Create Stripe PaymentIntent (amount in cents)
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: 'sgd',
    metadata: {
      type: 'wallet_topup',
      user_id: userId,
      wallet_id: wallet.id,
    },
  });

  const { data: topup, error } = await supabaseAdmin
    .from('wallet_topups')
    .insert({
      wallet_id: wallet.id,
      user_id: userId,
      amount,
      payment_method: 'stripe_card',
      stripe_payment_intent_id: paymentIntent.id,
      stripe_client_secret: paymentIntent.client_secret,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create top-up: ${error.message}`);

  return {
    topup: topup as WalletTopup,
    client_secret: paymentIntent.client_secret!,
  };
}

// ============================================================
// 7. requestWithdrawal
// ============================================================

export async function requestWithdrawal(
  userId: string,
  request: WithdrawalRequest
): Promise<WalletWithdrawal> {
  const { amount, method } = request;

  // Validate amount
  if (amount < WALLET_CONSTANTS.MIN_WITHDRAWAL) {
    throw new Error(`Minimum withdrawal is $${WALLET_CONSTANTS.MIN_WITHDRAWAL}`);
  }
  if (amount > WALLET_CONSTANTS.MAX_WITHDRAWAL) {
    throw new Error(`Maximum withdrawal is $${WALLET_CONSTANTS.MAX_WITHDRAWAL}`);
  }

  const wallet = await getOrCreateWallet(userId);

  // Check balance (exclude non-withdrawable bonus)
  const withdrawable = Number(wallet.balance) - Number(wallet.bonus_balance || 0);
  if (withdrawable < amount) {
    throw new Error(`Insufficient withdrawable balance. Your withdrawable balance is $${withdrawable.toFixed(2)} (excludes $${Number(wallet.bonus_balance || 0).toFixed(2)} bonus credits)`);
  }

  // Validate withdrawal method setup
  if (method === 'paynow') {
    const paynow = request.paynow_number || wallet.paynow_number;
    if (!paynow) throw new Error('PayNow number is not configured');
  } else if (method === 'bank_transfer') {
    const bankName = request.bank_name || wallet.bank_name;
    const bankAccount = request.bank_account_number || wallet.bank_account_number;
    const bankHolder = request.bank_account_holder || wallet.bank_account_holder;
    if (!bankName || !bankAccount || !bankHolder) {
      throw new Error('Bank account details are not configured');
    }
  }

  // Check daily withdrawal limit
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: todayWithdrawals } = await supabaseAdmin
    .from('wallet_withdrawals')
    .select('amount')
    .eq('user_id', userId)
    .in('status', ['pending', 'approved', 'processing', 'completed'])
    .gte('created_at', todayStart.toISOString());

  const dailyTotal = (todayWithdrawals || []).reduce(
    (sum, w) => sum + Number(w.amount), 0
  );
  if (dailyTotal + amount > wallet.daily_withdrawal_limit) {
    throw new Error(`Daily withdrawal limit of $${wallet.daily_withdrawal_limit} exceeded`);
  }

  // Check monthly withdrawal limit
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: monthlyWithdrawals } = await supabaseAdmin
    .from('wallet_withdrawals')
    .select('amount')
    .eq('user_id', userId)
    .in('status', ['pending', 'approved', 'processing', 'completed'])
    .gte('created_at', monthStart.toISOString());

  const monthlyTotal = (monthlyWithdrawals || []).reduce(
    (sum, w) => sum + Number(w.amount), 0
  );
  if (monthlyTotal + amount > wallet.monthly_withdrawal_limit) {
    throw new Error(`Monthly withdrawal limit of $${wallet.monthly_withdrawal_limit} exceeded`);
  }

  // Calculate processing fee
  const fee = WALLET_CONSTANTS.PROCESSING_FEES[method] ?? 0;
  const netAmount = Math.round((amount - fee) * 100) / 100;

  // Debit wallet to hold funds via RPC
  const { error: rpcError } = await supabaseAdmin.rpc('wallet_debit', {
    p_wallet_id: wallet.id,
    p_user_id: userId,
    p_amount: amount,
    p_type: 'withdrawal',
    p_description: `Withdrawal request of $${amount.toFixed(2)} via ${method}`,
    p_metadata: { method, fee, net_amount: netAmount },
  });

  if (rpcError) throw new Error(`Failed to debit wallet: ${rpcError.message}`);

  // Insert withdrawal record
  const { data: withdrawal, error } = await supabaseAdmin
    .from('wallet_withdrawals')
    .insert({
      wallet_id: wallet.id,
      user_id: userId,
      amount,
      method,
      bank_name: request.bank_name || wallet.bank_name,
      bank_account_number: request.bank_account_number || wallet.bank_account_number,
      bank_account_holder: request.bank_account_holder || wallet.bank_account_holder,
      paynow_number: request.paynow_number || wallet.paynow_number,
      status: 'pending',
      processing_fee: fee,
      net_amount: netAmount,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create withdrawal: ${error.message}`);

  return withdrawal as WalletWithdrawal;
}

// ============================================================
// 8. approveWithdrawal
// ============================================================

export async function approveWithdrawal(
  withdrawalId: string,
  adminId: string,
  transferReference?: string
): Promise<WalletWithdrawal> {
  const { data: withdrawal, error: updateError } = await supabaseAdmin
    .from('wallet_withdrawals')
    .update({
      status: 'completed',
      approved_by: adminId,
      approved_at: new Date().toISOString(),
      transfer_reference: transferReference || null,
      transfer_completed_at: new Date().toISOString(),
    })
    .eq('id', withdrawalId)
    .eq('status', 'pending')
    .select()
    .single();

  if (updateError || !withdrawal) {
    throw new Error('Withdrawal not found or not in pending status');
  }

  return withdrawal as WalletWithdrawal;
}

// ============================================================
// 9. rejectWithdrawal
// ============================================================

export async function rejectWithdrawal(
  withdrawalId: string,
  adminId: string,
  reason: string
): Promise<WalletWithdrawal> {
  // Fetch the withdrawal first
  const { data: withdrawal, error: fetchError } = await supabaseAdmin
    .from('wallet_withdrawals')
    .select('*')
    .eq('id', withdrawalId)
    .eq('status', 'pending')
    .single();

  if (fetchError || !withdrawal) {
    throw new Error('Withdrawal not found or not in pending status');
  }

  // Refund the held funds back to wallet via RPC
  const { error: rpcError } = await supabaseAdmin.rpc('wallet_credit', {
    p_wallet_id: withdrawal.wallet_id,
    p_user_id: withdrawal.user_id,
    p_amount: withdrawal.amount,
    p_type: 'refund',
    p_reference_type: 'withdrawal_rejection',
    p_reference_id: withdrawalId,
    p_description: `Refund for rejected withdrawal: ${reason}`,
    p_metadata: { rejected_by: adminId, reason },
  });

  if (rpcError) throw new Error(`Failed to refund wallet: ${rpcError.message}`);

  // Update withdrawal to rejected
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('wallet_withdrawals')
    .update({
      status: 'rejected',
      approved_by: adminId,
      approved_at: new Date().toISOString(),
      rejected_reason: reason,
    })
    .eq('id', withdrawalId)
    .select()
    .single();

  if (updateError) throw new Error(`Failed to update withdrawal: ${updateError.message}`);

  return updated as WalletWithdrawal;
}

// ============================================================
// 10. updateWithdrawalSettings
// ============================================================

interface WithdrawalSettings {
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  paynow_number?: string;
  paynow_type?: 'phone' | 'uen' | 'nric';
  preferred_withdrawal?: WithdrawalMethod;
}

export async function updateWithdrawalSettings(
  userId: string,
  settings: WithdrawalSettings
): Promise<Wallet> {
  const { data: wallet, error } = await supabaseAdmin
    .from('wallets')
    .update({
      ...settings,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update settings: ${error.message}`);

  return wallet as Wallet;
}

// ============================================================
// 11. processJobPayment
// ============================================================

export async function processJobPayment(
  jobId: string,
  customerId: string,
  driverId: string,
  totalAmount: number,
  commissionRate: number,
  paymentMethod: PaymentMethodType
): Promise<Payment> {
  const { data: payment, error } = await supabaseAdmin.rpc('process_job_payment', {
    p_job_id: jobId,
    p_customer_id: customerId,
    p_driver_id: driverId,
    p_total_amount: totalAmount,
    p_commission_rate: commissionRate,
    p_payment_method: paymentMethod,
  });

  if (error) throw new Error(`Failed to process payment: ${error.message}`);

  return payment as Payment;
}

// ============================================================
// 12. validatePromoCode
// ============================================================

interface PromoValidationResult {
  valid: boolean;
  promo?: PromoCode;
  discount: number;
  error?: string;
}

export async function validatePromoCode(
  code: string,
  userId: string,
  orderAmount: number,
  jobType?: string,
  vehicleMode?: string
): Promise<PromoValidationResult> {
  const { data: promo, error } = await supabaseAdmin
    .from('promo_codes')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .single();

  if (error || !promo) {
    return { valid: false, discount: 0, error: 'Invalid promo code' };
  }

  const now = new Date();

  // Check validity period
  if (promo.valid_from && new Date(promo.valid_from) > now) {
    return { valid: false, discount: 0, error: 'Promo code is not yet active' };
  }
  if (promo.valid_until && new Date(promo.valid_until) < now) {
    return { valid: false, discount: 0, error: 'Promo code has expired' };
  }

  // Check global usage limit
  if (promo.usage_limit !== null && promo.usage_count >= promo.usage_limit) {
    return { valid: false, discount: 0, error: 'Promo code usage limit reached' };
  }

  // Check per-user limit
  if (promo.per_user_limit) {
    const { count } = await supabaseAdmin
      .from('wallet_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('reference_type', 'promo')
      .eq('reference_id', promo.id);

    if ((count ?? 0) >= promo.per_user_limit) {
      return { valid: false, discount: 0, error: 'You have already used this promo code' };
    }
  }

  // Check minimum order amount
  if (orderAmount < promo.min_order_amount) {
    return {
      valid: false,
      discount: 0,
      error: `Minimum order amount is $${Number(promo.min_order_amount).toFixed(2)}`,
    };
  }

  // Check applicable job types
  if (promo.applicable_job_types?.length && jobType) {
    if (!promo.applicable_job_types.includes(jobType)) {
      return { valid: false, discount: 0, error: 'Promo code not applicable for this job type' };
    }
  }

  // Check applicable vehicle modes
  if (promo.applicable_vehicle_modes?.length && vehicleMode) {
    if (!promo.applicable_vehicle_modes.includes(vehicleMode)) {
      return { valid: false, discount: 0, error: 'Promo code not applicable for this vehicle type' };
    }
  }

  // Calculate discount
  let discount = 0;
  if (promo.discount_type === 'percentage') {
    discount = Math.round(orderAmount * (promo.discount_value / 100) * 100) / 100;
    if (promo.max_discount !== null) {
      discount = Math.min(discount, promo.max_discount);
    }
  } else {
    discount = Math.min(promo.discount_value, orderAmount);
  }

  return {
    valid: true,
    promo: promo as PromoCode,
    discount: Math.round(discount * 100) / 100,
  };
}
