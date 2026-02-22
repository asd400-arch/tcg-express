-- ============================================================
-- Wallet Payment System Migration
-- Comprehensive wallet, payments, top-ups, withdrawals, promos
-- ============================================================

-- Drop old phase 8 wallet tables if they exist (replaced by this migration)
DROP TABLE IF EXISTS express_wallet_transactions CASCADE;
DROP TABLE IF EXISTS express_wallets CASCADE;
DROP TABLE IF EXISTS express_coupon_usages CASCADE;
DROP TABLE IF EXISTS express_coupons CASCADE;

-- ============================================================
-- 1. wallets
-- ============================================================
CREATE TABLE wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES express_users(id) ON DELETE CASCADE UNIQUE,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'SGD',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'suspended', 'closed')),
  bank_name VARCHAR(100),
  bank_account_number VARCHAR(50),
  bank_account_holder VARCHAR(200),
  paynow_number VARCHAR(20),
  paynow_type VARCHAR(10) CHECK (paynow_type IN ('phone', 'uen', 'nric')),
  preferred_withdrawal VARCHAR(20) NOT NULL DEFAULT 'paynow' CHECK (preferred_withdrawal IN ('paynow', 'bank_transfer')),
  daily_withdrawal_limit DECIMAL(10,2) NOT NULL DEFAULT 5000,
  monthly_withdrawal_limit DECIMAL(12,2) NOT NULL DEFAULT 50000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. wallet_transactions
-- ============================================================
CREATE TABLE wallet_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES express_users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('top_up', 'payment', 'earning', 'withdrawal', 'refund', 'bonus', 'commission', 'adjustment')),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  direction VARCHAR(6) NOT NULL CHECK (direction IN ('credit', 'debit')),
  balance_before DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  reference_type VARCHAR(30),
  reference_id UUID,
  payment_method VARCHAR(30),
  payment_provider_ref VARCHAR(100),
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- 3. wallet_topups
-- ============================================================
CREATE TABLE wallet_topups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES express_users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0 AND amount <= 10000),
  currency VARCHAR(3) NOT NULL DEFAULT 'SGD',
  payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('paynow', 'stripe_card')),
  paynow_qr_data TEXT,
  paynow_reference VARCHAR(50),
  paynow_expiry TIMESTAMPTZ,
  stripe_payment_intent_id VARCHAR(100),
  stripe_client_secret VARCHAR(200),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'awaiting_payment', 'processing', 'completed', 'failed', 'expired', 'cancelled')),
  admin_verified_by UUID REFERENCES express_users(id),
  admin_verified_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- ============================================================
-- 4. wallet_withdrawals
-- ============================================================
CREATE TABLE wallet_withdrawals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES express_users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 50 AND amount <= 10000),
  currency VARCHAR(3) NOT NULL DEFAULT 'SGD',
  method VARCHAR(20) NOT NULL CHECK (method IN ('paynow', 'bank_transfer')),
  bank_name VARCHAR(100),
  bank_account_number VARCHAR(50),
  bank_account_holder VARCHAR(200),
  paynow_number VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'rejected', 'cancelled')),
  processing_fee DECIMAL(6,2) NOT NULL DEFAULT 0,
  net_amount DECIMAL(10,2),
  transfer_reference VARCHAR(100),
  transfer_completed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES express_users(id),
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. payments
-- ============================================================
CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES express_jobs(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES express_users(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES express_users(id),
  total_amount DECIMAL(10,2) NOT NULL,
  platform_commission DECIMAL(10,2) NOT NULL,
  driver_earning DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(4,2) NOT NULL,
  base_fare DECIMAL(10,2) NOT NULL DEFAULT 0,
  distance_surcharge DECIMAL(10,2) NOT NULL DEFAULT 0,
  urgency_surcharge DECIMAL(10,2) NOT NULL DEFAULT 0,
  helper_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  special_handling_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  save_mode_discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  ev_discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  promo_discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('wallet', 'paynow', 'stripe_card', 'invoice')),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'authorized', 'paid', 'settled', 'failed', 'refunded', 'partially_refunded')),
  customer_wallet_tx_id UUID REFERENCES wallet_transactions(id),
  driver_wallet_tx_id UUID REFERENCES wallet_transactions(id),
  stripe_payment_intent_id VARCHAR(100),
  paynow_reference VARCHAR(50),
  invoice_number VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ
);

-- ============================================================
-- 6. promo_codes
-- ============================================================
CREATE TABLE promo_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  description TEXT,
  discount_type VARCHAR(10) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
  max_discount DECIMAL(10,2),
  min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  usage_limit INTEGER,
  usage_count INTEGER NOT NULL DEFAULT 0,
  per_user_limit INTEGER NOT NULL DEFAULT 1,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  applicable_job_types TEXT[],
  applicable_vehicle_modes TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- wallets
CREATE INDEX idx_wallets_user_id ON wallets(user_id);

-- wallet_transactions
CREATE INDEX idx_wallet_tx_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_tx_user_id ON wallet_transactions(user_id);
CREATE INDEX idx_wallet_tx_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX idx_wallet_tx_type ON wallet_transactions(type);
CREATE INDEX idx_wallet_tx_status ON wallet_transactions(status);

-- wallet_topups
CREATE INDEX idx_wallet_topups_user_id ON wallet_topups(user_id);
CREATE INDEX idx_wallet_topups_status ON wallet_topups(status);
CREATE INDEX idx_wallet_topups_paynow_ref ON wallet_topups(paynow_reference);

-- wallet_withdrawals
CREATE INDEX idx_wallet_withdrawals_user_id ON wallet_withdrawals(user_id);
CREATE INDEX idx_wallet_withdrawals_status ON wallet_withdrawals(status);

-- payments
CREATE INDEX idx_payments_job_id ON payments(job_id);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);
CREATE INDEX idx_payments_driver_id ON payments(driver_id);
CREATE INDEX idx_payments_status ON payments(payment_status);

-- promo_codes
CREATE INDEX idx_promo_codes_code ON promo_codes(code);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_topups ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- wallets: users see only their own wallet
CREATE POLICY "wallets_select_own" ON wallets
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "wallets_update_own" ON wallets
  FOR UPDATE USING (user_id = auth.uid());

-- Prevent users from directly modifying balance/status via PostgREST
-- Only SECURITY DEFINER functions (wallet_credit, wallet_debit) can update balance
REVOKE UPDATE (balance, status, daily_withdrawal_limit, monthly_withdrawal_limit) ON wallets FROM authenticated;

-- wallet_transactions: users see only their own transactions
CREATE POLICY "wallet_tx_select_own" ON wallet_transactions
  FOR SELECT USING (user_id = auth.uid());

-- wallet_topups: users see and create only their own
CREATE POLICY "wallet_topups_select_own" ON wallet_topups
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "wallet_topups_insert_own" ON wallet_topups
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- wallet_withdrawals: users see and create only their own
CREATE POLICY "wallet_withdrawals_select_own" ON wallet_withdrawals
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "wallet_withdrawals_insert_own" ON wallet_withdrawals
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- payments: users see payments where they are customer or driver
CREATE POLICY "payments_select_own" ON payments
  FOR SELECT USING (customer_id = auth.uid() OR driver_id = auth.uid());

-- ============================================================
-- TRIGGER: Auto-create wallet on new user
-- ============================================================

CREATE OR REPLACE FUNCTION fn_create_wallet_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_wallet_on_user_insert ON express_users;
CREATE TRIGGER trg_create_wallet_on_user_insert
  AFTER INSERT ON express_users
  FOR EACH ROW
  EXECUTE FUNCTION fn_create_wallet_for_new_user();

-- Backfill: create wallets for existing users who don't have one
INSERT INTO wallets (user_id)
SELECT id FROM express_users
WHERE id NOT IN (SELECT user_id FROM wallets)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- FUNCTION: wallet_credit
-- ============================================================

CREATE OR REPLACE FUNCTION wallet_credit(
  p_wallet_id UUID,
  p_user_id UUID,
  p_amount DECIMAL(12,2),
  p_type VARCHAR(20),
  p_reference_type VARCHAR(30) DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_payment_method VARCHAR(30) DEFAULT NULL,
  p_payment_provider_ref VARCHAR(100) DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS wallet_transactions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance DECIMAL(12,2);
  v_new_balance DECIMAL(12,2);
  v_transaction wallet_transactions;
BEGIN
  -- Lock the wallet row for update
  SELECT balance INTO v_current_balance
  FROM wallets
  WHERE id = p_wallet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found: %', p_wallet_id;
  END IF;

  v_new_balance := v_current_balance + p_amount;

  -- Update wallet balance
  UPDATE wallets
  SET balance = v_new_balance, updated_at = NOW()
  WHERE id = p_wallet_id;

  -- Insert transaction record
  INSERT INTO wallet_transactions (
    wallet_id, user_id, type, amount, direction,
    balance_before, balance_after,
    reference_type, reference_id,
    payment_method, payment_provider_ref,
    description, metadata, status, completed_at
  ) VALUES (
    p_wallet_id, p_user_id, p_type, p_amount, 'credit',
    v_current_balance, v_new_balance,
    p_reference_type, p_reference_id,
    p_payment_method, p_payment_provider_ref,
    p_description, p_metadata, 'completed', NOW()
  )
  RETURNING * INTO v_transaction;

  RETURN v_transaction;
END;
$$;

-- ============================================================
-- FUNCTION: wallet_debit
-- ============================================================

CREATE OR REPLACE FUNCTION wallet_debit(
  p_wallet_id UUID,
  p_user_id UUID,
  p_amount DECIMAL(12,2),
  p_type VARCHAR(20),
  p_reference_type VARCHAR(30) DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS wallet_transactions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance DECIMAL(12,2);
  v_new_balance DECIMAL(12,2);
  v_transaction wallet_transactions;
BEGIN
  -- Lock the wallet row for update
  SELECT balance INTO v_current_balance
  FROM wallets
  WHERE id = p_wallet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found: %', p_wallet_id;
  END IF;

  -- Check sufficient balance
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: %, Required: %', v_current_balance, p_amount;
  END IF;

  v_new_balance := v_current_balance - p_amount;

  -- Update wallet balance
  UPDATE wallets
  SET balance = v_new_balance, updated_at = NOW()
  WHERE id = p_wallet_id;

  -- Insert transaction record
  INSERT INTO wallet_transactions (
    wallet_id, user_id, type, amount, direction,
    balance_before, balance_after,
    reference_type, reference_id,
    description, metadata, status, completed_at
  ) VALUES (
    p_wallet_id, p_user_id, p_type, p_amount, 'debit',
    v_current_balance, v_new_balance,
    p_reference_type, p_reference_id,
    p_description, p_metadata, 'completed', NOW()
  )
  RETURNING * INTO v_transaction;

  RETURN v_transaction;
END;
$$;

-- ============================================================
-- FUNCTION: process_job_payment
-- ============================================================

CREATE OR REPLACE FUNCTION process_job_payment(
  p_job_id UUID,
  p_customer_id UUID,
  p_driver_id UUID,
  p_total_amount DECIMAL(10,2),
  p_commission_rate DECIMAL(4,2),
  p_payment_method VARCHAR(30)
)
RETURNS payments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_commission DECIMAL(10,2);
  v_driver_earning DECIMAL(10,2);
  v_customer_wallet_id UUID;
  v_driver_wallet_id UUID;
  v_customer_tx wallet_transactions;
  v_driver_tx wallet_transactions;
  v_payment payments;
BEGIN
  -- Calculate commission and driver earning
  v_commission := ROUND(p_total_amount * p_commission_rate, 2);
  v_driver_earning := p_total_amount - v_commission;

  -- Get wallet IDs
  SELECT id INTO v_customer_wallet_id FROM wallets WHERE user_id = p_customer_id;
  SELECT id INTO v_driver_wallet_id FROM wallets WHERE user_id = p_driver_id;

  IF v_customer_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Customer wallet not found for user: %', p_customer_id;
  END IF;

  IF v_driver_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Driver wallet not found for user: %', p_driver_id;
  END IF;

  -- Debit customer wallet
  v_customer_tx := wallet_debit(
    v_customer_wallet_id,
    p_customer_id,
    p_total_amount,
    'payment',
    'job',
    p_job_id,
    'Payment for job ' || p_job_id::TEXT,
    jsonb_build_object('job_id', p_job_id, 'payment_method', p_payment_method)
  );

  -- Credit driver wallet with earning
  v_driver_tx := wallet_credit(
    v_driver_wallet_id,
    p_driver_id,
    v_driver_earning,
    'earning',
    'job',
    p_job_id,
    NULL,
    NULL,
    'Earning for job ' || p_job_id::TEXT,
    jsonb_build_object('job_id', p_job_id, 'commission_rate', p_commission_rate, 'commission', v_commission)
  );

  -- Insert payment record
  INSERT INTO payments (
    job_id, customer_id, driver_id,
    total_amount, platform_commission, driver_earning, commission_rate,
    payment_method, payment_status,
    customer_wallet_tx_id, driver_wallet_tx_id,
    paid_at
  ) VALUES (
    p_job_id, p_customer_id, p_driver_id,
    p_total_amount, v_commission, v_driver_earning, p_commission_rate,
    p_payment_method, 'paid',
    v_customer_tx.id, v_driver_tx.id,
    NOW()
  )
  RETURNING * INTO v_payment;

  RETURN v_payment;
END;
$$;

-- ============================================================
-- Updated_at trigger for wallets
-- ============================================================

CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wallets_updated_at ON wallets;
CREATE TRIGGER trg_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_timestamp();

-- Enable realtime for wallet transactions
ALTER PUBLICATION supabase_realtime ADD TABLE wallet_transactions;
