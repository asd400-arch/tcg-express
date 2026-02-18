-- Phase 17: Web Push Subscriptions table
CREATE TABLE express_push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES express_users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Index for efficient lookup by user_id
CREATE INDEX idx_push_subscriptions_user_id ON express_push_subscriptions(user_id);

-- RLS policies
ALTER TABLE express_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (used by API routes via supabaseAdmin)
CREATE POLICY "Service role full access on push subscriptions"
  ON express_push_subscriptions
  FOR ALL
  USING (true)
  WITH CHECK (true);
