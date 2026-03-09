-- Driver onboarding promotions & referral system

-- Add promo/referral columns to express_users
ALTER TABLE express_users
  ADD COLUMN IF NOT EXISTS welcome_bonus_claimed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by TEXT;

-- Referral rewards tracking table
CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES express_users(id),
  referred_id UUID REFERENCES express_users(id),
  referral_code TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  referrer_amount NUMERIC DEFAULT 30,
  referred_amount NUMERIC DEFAULT 10,
  status TEXT DEFAULT 'pending',
  trigger_event TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referred ON referral_rewards(referred_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_code ON referral_rewards(referral_code);

-- Backfill referral_code for existing users
UPDATE express_users SET referral_code = 'TCG-' || UPPER(SUBSTR(MD5(id::text), 1, 4))
WHERE referral_code IS NULL;
