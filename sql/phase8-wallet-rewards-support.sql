-- ============================================================
-- Phase 8: Wallet, Rewards, Promotions, Help Center, Chat
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Wallets table
CREATE TABLE IF NOT EXISTS express_wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES express_users(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
  bonus_balance NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
  points INTEGER DEFAULT 0 NOT NULL,
  currency TEXT DEFAULT 'SGD' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 2. Wallet transactions
CREATE TABLE IF NOT EXISTS express_wallet_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES express_users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('topup', 'bonus', 'payment', 'refund', 'points_earn', 'points_redeem', 'points_payment')),
  amount NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2),
  points_amount INTEGER DEFAULT 0,
  points_after INTEGER DEFAULT 0,
  description TEXT,
  reference_id TEXT,
  stripe_payment_intent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Coupons
CREATE TABLE IF NOT EXISTS express_coupons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
  value NUMERIC(10,2) NOT NULL,
  min_order NUMERIC(10,2) DEFAULT 0,
  max_discount NUMERIC(10,2),
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Coupon usages
CREATE TABLE IF NOT EXISTS express_coupon_usages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES express_coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES express_users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES express_jobs(id),
  discount_amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Promo banners
CREATE TABLE IF NOT EXISTS express_promo_banners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  link TEXT,
  bg_color TEXT DEFAULT '#3b82f6',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Support tickets
CREATE TABLE IF NOT EXISTS express_support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES express_users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('delivery', 'payment', 'account', 'driver', 'other')),
  subject TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'ai_handled', 'waiting_agent', 'in_progress', 'resolved', 'closed')),
  ai_resolved BOOLEAN DEFAULT false,
  assigned_admin UUID REFERENCES express_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Support messages
CREATE TABLE IF NOT EXISTS express_support_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES express_support_tickets(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES express_users(id),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'ai', 'admin')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wallets_user ON express_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_user ON express_wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_created ON express_wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON express_coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_user ON express_coupon_usages(user_id);
CREATE INDEX IF NOT EXISTS idx_banners_active ON express_promo_banners(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON express_support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON express_support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON express_support_messages(ticket_id);

-- Enable realtime for support messages (live chat)
ALTER PUBLICATION supabase_realtime ADD TABLE express_support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE express_support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE express_wallet_transactions;

-- Seed some promo banners
INSERT INTO express_promo_banners (title, subtitle, bg_color, link, sort_order, is_active) VALUES
  ('First Delivery 20% Off!', 'Use code: FIRST20', '#3b82f6', '/client/jobs/new', 1, true),
  ('Top Up & Get Bonus!', '$100 top-up = $5 bonus, $500 = $50 bonus', '#059669', '/client/wallet', 2, true),
  ('Refer a Friend, Get $10', 'Share your referral code today', '#7c3aed', '/client/settings', 3, true);

-- Seed some coupons
INSERT INTO express_coupons (code, type, value, min_order, max_uses, expires_at, description) VALUES
  ('FIRST20', 'percent', 20, 20, NULL, NOW() + INTERVAL '90 days', 'First delivery 20% off'),
  ('SAVE5', 'fixed', 5, 30, 100, NOW() + INTERVAL '30 days', '$5 off orders over $30'),
  ('WELCOME10', 'percent', 10, 0, NULL, NOW() + INTERVAL '60 days', '10% welcome discount');

-- Add wallet_id to express_jobs for payment tracking
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES express_coupons(id);
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS points_used INTEGER DEFAULT 0;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS points_discount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS wallet_paid BOOLEAN DEFAULT false;
