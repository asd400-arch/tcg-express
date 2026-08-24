-- ============================================================
-- PayNow auto-credit support (2026-08-24)
-- Run once in Supabase SQL editor. Idempotent.
-- ============================================================

-- 1. Webhook idempotency table (referenced by both Stripe webhooks;
--    may not exist yet in older environments)
CREATE TABLE IF NOT EXISTS processed_webhook_events (
  event_id   TEXT PRIMARY KEY,
  event_type TEXT,
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Fast lookup of top-ups by Stripe PaymentIntent id (webhook hot path)
CREATE INDEX IF NOT EXISTS idx_wallet_topups_stripe_pi
  ON wallet_topups (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- 3. Fast duplicate-bonus guard used by applyTopupBonus()
CREATE INDEX IF NOT EXISTS idx_wallet_tx_topup_bonus_ref
  ON wallet_transactions (reference_id)
  WHERE reference_type = 'topup_bonus';
