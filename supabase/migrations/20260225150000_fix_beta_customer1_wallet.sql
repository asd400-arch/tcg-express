-- Fix beta-customer1 wallet balance
-- User: beta-customer1@techchainglobal.com (b0000000-0000-0000-0000-000000000001)
-- Issue: Legacy bid acceptance bypassed wallet debit, causing balance mismatch
-- Fix: Recalculate balance from wallet_transactions and apply correction

DO $$
DECLARE
  v_user_id UUID := 'b0000000-0000-0000-0000-000000000001';
  v_wallet_id UUID;
  v_current_balance DECIMAL(12,2);
  v_correct_balance DECIMAL(12,2);
  v_difference DECIMAL(12,2);
BEGIN
  -- Get wallet ID and current balance
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM wallets
  WHERE user_id = v_user_id;

  IF v_wallet_id IS NULL THEN
    RAISE NOTICE 'No wallet found for beta-customer1, skipping';
    RETURN;
  END IF;

  -- Calculate correct balance from transaction history
  -- balance = SUM(credits) - SUM(debits) for completed transactions
  SELECT COALESCE(
    SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) -
    SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END),
    0
  ) INTO v_correct_balance
  FROM wallet_transactions
  WHERE wallet_id = v_wallet_id
    AND status = 'completed';

  v_difference := v_correct_balance - v_current_balance;

  RAISE NOTICE 'beta-customer1 wallet fix: current=%, correct=%, difference=%',
    v_current_balance, v_correct_balance, v_difference;

  -- Only apply correction if there's a mismatch
  IF v_difference != 0 THEN
    -- Insert correction transaction
    INSERT INTO wallet_transactions (
      wallet_id, user_id, type, amount, direction,
      balance_before, balance_after,
      reference_type, description, status, completed_at
    ) VALUES (
      v_wallet_id,
      v_user_id,
      'adjustment',
      ABS(v_difference),
      CASE WHEN v_difference > 0 THEN 'credit' ELSE 'debit' END,
      v_current_balance,
      v_correct_balance,
      'correction',
      'Balance correction: reconcile wallet with transaction history (legacy bid acceptance bug)',
      'completed',
      NOW()
    );

    -- Update wallet balance to correct value
    UPDATE wallets
    SET balance = v_correct_balance, updated_at = NOW()
    WHERE id = v_wallet_id;

    RAISE NOTICE 'Wallet corrected: % -> %', v_current_balance, v_correct_balance;
  ELSE
    RAISE NOTICE 'No correction needed — balance already matches transactions';
  END IF;
END $$;
