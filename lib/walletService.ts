// ============================================================
// Wallet Service - Server-side wallet operations
// Uses Supabase service role client (bypasses RLS)
// ============================================================

import { supabaseAdmin } from './supabase-server';
import { getStripe } from './stripe';
import { generatePayNowTopupQR } from './paynow';
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
} from '@/types/wallet';

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

  return {
    wallet,
    recent_transactions: (txResult.data || []) as WalletTransaction[],
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

  return {
    transactions: (data || []) as WalletTransaction[],
    total: count ?? 0,
  };
}

// ============================================================
// 4. createPayNowTopup
// ============================================================

export async function createPayNowTopup(
  userId: string,
  amount: number
): Promise<TopupResponse> {
  if (amount < WALLET_CONSTANTS.MIN_TOPUP || amount > WALLET_CONSTANTS.MAX_TOPUP) {
    throw new Error(`Top-up amount must be between $${WALLET_CONSTANTS.MIN_TOPUP} and $${WALLET_CONSTANTS.MAX_TOPUP}`);
  }

  const wallet = await getOrCreateWallet(userId);
  const qrData = generatePayNowTopupQR(amount);

  const { data: topup, error } = await supabaseAdmin
    .from('wallet_topups')
    .insert({
      wallet_id: wallet.id,
      user_id: userId,
      amount,
      payment_method: 'paynow',
      paynow_qr_data: qrData.qr_string,
      paynow_reference: qrData.reference,
      paynow_expiry: qrData.expiry,
      status: 'pending',
      expires_at: qrData.expiry,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create top-up: ${error.message}`);

  return {
    topup: topup as WalletTopup,
    paynow_qr: qrData,
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

  return updated as WalletTopup;
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

  // Check balance
  if (wallet.balance < amount) {
    throw new Error('Insufficient wallet balance');
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
