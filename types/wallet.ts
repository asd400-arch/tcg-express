// ============================================================
// Wallet Payment System - TypeScript Types
// ============================================================

// --- Union Types ---

export type WalletStatus = 'active' | 'frozen' | 'suspended' | 'closed';

export type PayNowType = 'phone' | 'uen' | 'nric';

export type WithdrawalMethod = 'paynow' | 'bank_transfer';

export type TransactionType =
  | 'top_up'
  | 'payment'
  | 'earning'
  | 'withdrawal'
  | 'refund'
  | 'bonus'
  | 'commission'
  | 'adjustment';

export type TransactionDirection = 'credit' | 'debit';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'reversed';

export type TopupStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'cancelled';

export type TopupPaymentMethod = 'paynow' | 'stripe_card';

export type WithdrawalStatus =
  | 'pending'
  | 'approved'
  | 'processing'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export type PaymentMethodType = 'wallet' | 'paynow' | 'stripe_card' | 'invoice';

export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'paid'
  | 'settled'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type DiscountType = 'percentage' | 'fixed';

// --- Interfaces ---

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  status: WalletStatus;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
  paynow_number: string | null;
  paynow_type: PayNowType | null;
  preferred_withdrawal: WithdrawalMethod;
  daily_withdrawal_limit: number;
  monthly_withdrawal_limit: number;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  direction: TransactionDirection;
  balance_before: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  payment_method: string | null;
  payment_provider_ref: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  status: TransactionStatus;
  created_at: string;
  completed_at: string | null;
}

export interface WalletTopup {
  id: string;
  wallet_id: string;
  user_id: string;
  amount: number;
  currency: string;
  payment_method: TopupPaymentMethod;
  paynow_qr_data: string | null;
  paynow_reference: string | null;
  paynow_expiry: string | null;
  stripe_payment_intent_id: string | null;
  stripe_client_secret: string | null;
  status: TopupStatus;
  admin_verified_by: string | null;
  admin_verified_at: string | null;
  admin_notes: string | null;
  created_at: string;
  completed_at: string | null;
  expires_at: string | null;
}

export interface WalletWithdrawal {
  id: string;
  wallet_id: string;
  user_id: string;
  amount: number;
  currency: string;
  method: WithdrawalMethod;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
  paynow_number: string | null;
  status: WithdrawalStatus;
  processing_fee: number;
  net_amount: number | null;
  transfer_reference: string | null;
  transfer_completed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  job_id: string;
  customer_id: string;
  driver_id: string | null;
  total_amount: number;
  platform_commission: number;
  driver_earning: number;
  commission_rate: number;
  base_fare: number;
  distance_surcharge: number;
  urgency_surcharge: number;
  helper_fee: number;
  special_handling_fee: number;
  save_mode_discount: number;
  ev_discount: number;
  promo_discount: number;
  payment_method: PaymentMethodType;
  payment_status: PaymentStatus;
  customer_wallet_tx_id: string | null;
  driver_wallet_tx_id: string | null;
  stripe_payment_intent_id: string | null;
  paynow_reference: string | null;
  invoice_number: string | null;
  created_at: string;
  paid_at: string | null;
  settled_at: string | null;
}

export interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  max_discount: number | null;
  min_order_amount: number;
  usage_limit: number | null;
  usage_count: number;
  per_user_limit: number;
  valid_from: string;
  valid_until: string | null;
  applicable_job_types: string[] | null;
  applicable_vehicle_modes: string[] | null;
  is_active: boolean;
  created_at: string;
}

export interface PayNowQRData {
  qr_string: string;
  reference: string;
  amount: number;
  expiry: string;
  recipient_name: string;
  uen: string;
}

// --- Request / Response Types ---

export interface TopupRequest {
  amount: number;
  payment_method: TopupPaymentMethod;
}

export interface TopupResponse {
  topup: WalletTopup;
  /** PayNow QR data returned when payment_method is 'paynow' */
  paynow_qr?: PayNowQRData;
  /** Stripe client secret returned when payment_method is 'stripe_card' */
  client_secret?: string;
}

export interface WithdrawalRequest {
  amount: number;
  method: WithdrawalMethod;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  paynow_number?: string;
}

export interface PaymentRequest {
  job_id: string;
  payment_method: PaymentMethodType;
  promo_code?: string;
}

export interface WalletOverview {
  wallet: Wallet;
  recent_transactions: WalletTransaction[];
  pending_withdrawals: WalletWithdrawal[];
  monthly_earned: number;
  monthly_spent: number;
  monthly_withdrawn: number;
}

// --- Constants ---

export const WALLET_CONSTANTS = {
  MIN_TOPUP: 10,
  MAX_TOPUP: 10000,
  MIN_WITHDRAWAL: 50,
  MAX_WITHDRAWAL: 10000,
  PAYNOW_QR_EXPIRY_MINUTES: 30,
  WITHDRAWAL_PROCESSING_DAYS: { min: 1, max: 3 },
  PROCESSING_FEES: {
    paynow: 0,
    bank_transfer: 0.50,
  },
  TOPUP_AMOUNTS_QUICK: [50, 100, 200, 500, 1000],
} as const;

// --- Singapore Banks ---

export const SG_BANKS = [
  { code: 'DBS', name: 'DBS/POSB' },
  { code: 'OCBC', name: 'OCBC Bank' },
  { code: 'UOB', name: 'United Overseas Bank (UOB)' },
  { code: 'SCB', name: 'Standard Chartered Bank' },
  { code: 'CITI', name: 'Citibank' },
  { code: 'HSBC', name: 'HSBC' },
  { code: 'MBB', name: 'Maybank' },
  { code: 'BOC', name: 'Bank of China' },
  { code: 'ICBC', name: 'ICBC' },
] as const;

export type SGBankCode = (typeof SG_BANKS)[number]['code'];
