-- ============================================================
-- DEFENSIVE CODING MIGRATION
-- Transaction atomicity, idempotency, race condition guards
-- ============================================================

-- ============================================================
-- 1. IDEMPOTENCY KEY on wallet_transactions
-- ============================================================

ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Unique constraint: one transaction per (reference_id, reference_type, direction)
-- Prevents double payments for the same job
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_txn_idempotent
  ON wallet_transactions (reference_id, reference_type, direction)
  WHERE reference_id IS NOT NULL AND status = 'completed';

-- Unique constraint on explicit idempotency key
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_txn_idempotency_key
  ON wallet_transactions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ============================================================
-- 2. RACE CONDITION GUARD: only one accepted bid per job
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_accepted_bid_per_job
  ON express_bids (job_id)
  WHERE status = 'accepted';

-- ============================================================
-- 3. WEBHOOK IDEMPOTENCY TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS processed_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- ============================================================
-- 4. ATOMIC RPC: process_bid_acceptance
--    Wallet debit + bid accept + job assign + escrow create
--    in a single transaction — ROLLBACK on ANY failure
-- ============================================================

CREATE OR REPLACE FUNCTION process_bid_acceptance(
  p_job_id UUID,
  p_bid_id UUID,
  p_payer_id UUID,
  p_commission_rate DECIMAL(5,2) DEFAULT 15.00,
  p_coupon_discount DECIMAL(12,2) DEFAULT 0,
  p_coupon_id UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job RECORD;
  v_bid RECORD;
  v_wallet RECORD;
  v_bid_amount DECIMAL(12,2);
  v_final_amount DECIMAL(12,2);
  v_commission DECIMAL(12,2);
  v_payout DECIMAL(12,2);
  v_debit_tx wallet_transactions;
  v_escrow_id UUID;
  v_job_number TEXT;
BEGIN
  -- Idempotency: if this key already processed, return cached result
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM wallet_transactions WHERE idempotency_key = p_idempotency_key) THEN
      RETURN jsonb_build_object('already_processed', true);
    END IF;
  END IF;

  -- Lock job row and verify status (optimistic locking)
  SELECT id, client_id, status, job_number
  INTO v_job
  FROM express_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id;
  END IF;

  IF v_job.status NOT IN ('open', 'bidding') THEN
    RAISE EXCEPTION 'Job % is no longer accepting bids (status: %)', p_job_id, v_job.status;
  END IF;

  IF v_job.client_id != p_payer_id THEN
    RAISE EXCEPTION 'Payer does not own this job';
  END IF;

  v_job_number := v_job.job_number;

  -- Lock bid row and verify status
  SELECT id, job_id, driver_id, amount, status
  INTO v_bid
  FROM express_bids
  WHERE id = p_bid_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bid not found: %', p_bid_id;
  END IF;

  IF v_bid.status != 'pending' THEN
    RAISE EXCEPTION 'Bid is no longer pending (status: %)', v_bid.status;
  END IF;

  IF v_bid.job_id != p_job_id THEN
    RAISE EXCEPTION 'Bid does not belong to this job';
  END IF;

  v_bid_amount := v_bid.amount;
  v_final_amount := GREATEST(v_bid_amount - p_coupon_discount, 0);
  v_commission := ROUND(v_bid_amount * (p_commission_rate / 100), 2);
  v_payout := v_bid_amount - v_commission;

  -- Lock payer wallet and check balance
  SELECT id, balance
  INTO v_wallet
  FROM wallets
  WHERE user_id = p_payer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user: %', p_payer_id;
  END IF;

  IF v_wallet.balance < v_final_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: %, Required: %', v_wallet.balance, v_final_amount;
  END IF;

  -- Step 1: Debit wallet (if amount > 0)
  IF v_final_amount > 0 THEN
    -- Debit inline (not calling wallet_debit to avoid nested FOR UPDATE)
    UPDATE wallets
    SET balance = balance - v_final_amount, updated_at = NOW()
    WHERE id = v_wallet.id;

    INSERT INTO wallet_transactions (
      wallet_id, user_id, type, amount, direction,
      balance_before, balance_after,
      reference_type, reference_id,
      description, metadata, status, completed_at, idempotency_key
    ) VALUES (
      v_wallet.id, p_payer_id, 'payment', v_final_amount, 'debit',
      v_wallet.balance, v_wallet.balance - v_final_amount,
      'job', p_job_id,
      'Payment for job ' || COALESCE(v_job_number, p_job_id::TEXT),
      jsonb_build_object('bid_id', p_bid_id, 'coupon_discount', p_coupon_discount),
      'completed', NOW(), p_idempotency_key
    )
    RETURNING * INTO v_debit_tx;
  END IF;

  -- Step 2: Accept bid, outbid others
  UPDATE express_bids SET status = 'accepted' WHERE id = p_bid_id;
  UPDATE express_bids SET status = 'outbid'
    WHERE job_id = p_job_id AND id != p_bid_id AND status = 'pending';

  -- Step 3: Assign job (optimistic lock on status)
  UPDATE express_jobs SET
    status = 'assigned',
    assigned_driver_id = v_bid.driver_id,
    assigned_bid_id = p_bid_id,
    final_amount = v_bid_amount,
    commission_rate = p_commission_rate,
    commission_amount = v_commission,
    driver_payout = v_payout,
    coupon_id = p_coupon_id,
    coupon_discount = p_coupon_discount,
    wallet_paid = true
  WHERE id = p_job_id AND status IN ('open', 'bidding');

  -- Step 4: Create escrow record
  INSERT INTO express_transactions (
    job_id, client_id, driver_id,
    total_amount, commission_amount, driver_payout,
    payment_status, held_at
  ) VALUES (
    p_job_id, p_payer_id, v_bid.driver_id,
    v_bid_amount, v_commission, v_payout,
    'held', NOW()
  )
  RETURNING id INTO v_escrow_id;

  -- Return success with all relevant data
  RETURN jsonb_build_object(
    'success', true,
    'escrow_id', v_escrow_id,
    'bid_amount', v_bid_amount,
    'final_paid', v_final_amount,
    'commission', v_commission,
    'payout', v_payout,
    'driver_id', v_bid.driver_id,
    'wallet_balance', v_wallet.balance - v_final_amount,
    'job_number', v_job_number
  );
END;
$$;

-- ============================================================
-- 5. ATOMIC RPC: release_payment
--    Verify escrow + credit driver wallet + mark paid
--    in a single transaction — ROLLBACK on ANY failure
-- ============================================================

CREATE OR REPLACE FUNCTION release_payment(
  p_job_id UUID,
  p_released_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_txn RECORD;
  v_driver_wallet RECORD;
  v_driver_payout DECIMAL(12,2);
  v_credit_tx wallet_transactions;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Lock escrow transaction row
  SELECT id, job_id, client_id, driver_id, total_amount, driver_payout, commission_amount, payment_status
  INTO v_txn
  FROM express_transactions
  WHERE job_id = p_job_id AND payment_status = 'held'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No held escrow found for job: %', p_job_id;
  END IF;

  v_driver_payout := v_txn.driver_payout;

  IF v_driver_payout IS NULL OR v_driver_payout <= 0 THEN
    RAISE EXCEPTION 'Invalid driver payout amount: %', v_driver_payout;
  END IF;

  -- Lock driver wallet
  SELECT id, balance
  INTO v_driver_wallet
  FROM wallets
  WHERE user_id = v_txn.driver_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Auto-create driver wallet
    INSERT INTO wallets (user_id)
    VALUES (v_txn.driver_id)
    RETURNING id, balance INTO v_driver_wallet;
  END IF;

  -- Credit driver wallet
  UPDATE wallets
  SET balance = balance + v_driver_payout, updated_at = v_now
  WHERE id = v_driver_wallet.id;

  INSERT INTO wallet_transactions (
    wallet_id, user_id, type, amount, direction,
    balance_before, balance_after,
    reference_type, reference_id,
    description, metadata, status, completed_at
  ) VALUES (
    v_driver_wallet.id, v_txn.driver_id, 'earning', v_driver_payout, 'credit',
    v_driver_wallet.balance, v_driver_wallet.balance + v_driver_payout,
    'job_payment', p_job_id,
    'Delivery earning for job ' || p_job_id::TEXT,
    jsonb_build_object('escrow_id', v_txn.id, 'total_amount', v_txn.total_amount, 'commission', v_txn.commission_amount),
    'completed', v_now
  )
  RETURNING * INTO v_credit_tx;

  -- Mark escrow as paid
  UPDATE express_transactions
  SET payment_status = 'paid', released_at = v_now, paid_at = v_now
  WHERE id = v_txn.id;

  -- Update payments table if record exists
  UPDATE payments
  SET driver_wallet_tx_id = v_credit_tx.id, settled_at = v_now
  WHERE job_id = p_job_id AND payment_status IN ('pending', 'paid');

  RETURN jsonb_build_object(
    'success', true,
    'driver_id', v_txn.driver_id,
    'driver_payout', v_driver_payout,
    'driver_balance', v_driver_wallet.balance + v_driver_payout,
    'escrow_id', v_txn.id,
    'job_number', p_job_id
  );
END;
$$;

-- ============================================================
-- 6. STATUS TRANSITION GUARD FUNCTION
--    Only allow valid status transitions
-- ============================================================

CREATE OR REPLACE FUNCTION check_job_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  v_allowed TEXT[];
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  v_allowed := CASE OLD.status
    WHEN 'open'              THEN ARRAY['bidding', 'assigned', 'cancelled']
    WHEN 'bidding'           THEN ARRAY['assigned', 'cancelled']
    WHEN 'assigned'          THEN ARRAY['pickup_confirmed', 'cancelled', 'disputed']
    WHEN 'pickup_confirmed'  THEN ARRAY['in_transit', 'cancelled', 'disputed']
    WHEN 'in_transit'        THEN ARRAY['delivered', 'disputed']
    WHEN 'delivered'         THEN ARRAY['confirmed', 'disputed']
    WHEN 'confirmed'         THEN ARRAY['completed']
    WHEN 'disputed'          THEN ARRAY['assigned', 'cancelled', 'confirmed', 'completed']
    ELSE ARRAY[]::TEXT[]
  END;

  IF NEW.status = ANY(v_allowed) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid status transition: % -> %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_status_transition ON express_jobs;
CREATE TRIGGER trg_job_status_transition
  BEFORE UPDATE OF status ON express_jobs
  FOR EACH ROW
  EXECUTE FUNCTION check_job_status_transition();

-- ============================================================
-- PRINT SUMMARY
-- ============================================================
-- New RPC: process_bid_acceptance(p_job_id, p_bid_id, p_payer_id, ...)
-- New RPC: release_payment(p_job_id, p_released_by)
-- New table: processed_webhook_events
-- New column: wallet_transactions.idempotency_key
-- New index: idx_wallet_txn_idempotent (prevents duplicate payments)
-- New index: idx_one_accepted_bid_per_job (one accepted bid per job)
-- New trigger: trg_job_status_transition (valid status transitions only)
