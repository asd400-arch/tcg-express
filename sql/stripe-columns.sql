ALTER TABLE express_transactions ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;
ALTER TABLE express_transactions ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE express_transactions ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT;
