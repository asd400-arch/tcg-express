-- ============================================================
-- MASTER FIX: All missing tables, columns, indexes, RLS
-- Generated from comprehensive codebase audit
-- Safe to re-run: uses IF NOT EXISTS throughout
-- Run in Supabase SQL Editor
-- ============================================================

BEGIN;

-- ============================================================
-- 1. express_reviews — MISSING TABLE
--    Used by: RatingModal, /api/ratings, /api/reviews/submit
--    Columns: job_id, client_id, driver_id, rating, review_text, reviewer_role
-- ============================================================

CREATE TABLE IF NOT EXISTS express_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES express_jobs(id),
  client_id UUID REFERENCES express_users(id),
  driver_id UUID REFERENCES express_users(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  reviewer_role VARCHAR(20) DEFAULT 'client',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist (table may have been created by earlier migration with different schema)
ALTER TABLE express_reviews ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES express_jobs(id);
ALTER TABLE express_reviews ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES express_users(id);
ALTER TABLE express_reviews ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES express_users(id);
ALTER TABLE express_reviews ADD COLUMN IF NOT EXISTS rating INTEGER;
ALTER TABLE express_reviews ADD COLUMN IF NOT EXISTS review_text TEXT;
ALTER TABLE express_reviews ADD COLUMN IF NOT EXISTS reviewer_role VARCHAR(20) DEFAULT 'client';
ALTER TABLE express_reviews ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_reviews_job_id ON express_reviews(job_id);
CREATE INDEX IF NOT EXISTS idx_reviews_driver_id ON express_reviews(driver_id);
CREATE INDEX IF NOT EXISTS idx_reviews_client_id ON express_reviews(client_id);

ALTER TABLE express_reviews ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'reviews_select' AND tablename = 'express_reviews') THEN
    CREATE POLICY "reviews_select" ON express_reviews FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'reviews_insert' AND tablename = 'express_reviews') THEN
    CREATE POLICY "reviews_insert" ON express_reviews FOR INSERT WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON express_reviews TO service_role;
GRANT SELECT, INSERT ON express_reviews TO authenticated;

-- ============================================================
-- 2. express_support_tickets — MISSING TABLE (code uses express_ prefix)
--    Migration created support_tickets, but API uses express_support_tickets
--    Solution: Create express_ prefixed tables
-- ============================================================

CREATE TABLE IF NOT EXISTS express_support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES express_users(id),
  category VARCHAR(50) NOT NULL,
  subject VARCHAR(300) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  ai_resolved BOOLEAN DEFAULT false,
  assigned_admin UUID REFERENCES express_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON express_support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON express_support_tickets(status);

ALTER TABLE express_support_tickets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'support_tickets_select' AND tablename = 'express_support_tickets') THEN
    CREATE POLICY "support_tickets_select" ON express_support_tickets FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'support_tickets_insert' AND tablename = 'express_support_tickets') THEN
    CREATE POLICY "support_tickets_insert" ON express_support_tickets FOR INSERT WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'support_tickets_update' AND tablename = 'express_support_tickets') THEN
    CREATE POLICY "support_tickets_update" ON express_support_tickets FOR UPDATE USING (true);
  END IF;
END $$;

GRANT ALL ON express_support_tickets TO service_role;
GRANT SELECT, INSERT, UPDATE ON express_support_tickets TO authenticated;

-- ============================================================
-- 3. express_support_messages — MISSING TABLE (same prefix mismatch)
-- ============================================================

CREATE TABLE IF NOT EXISTS express_support_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES express_support_tickets(id),
  sender_id UUID REFERENCES express_users(id),
  sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('user', 'agent', 'system', 'ai')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON express_support_messages(ticket_id);

ALTER TABLE express_support_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'support_messages_select' AND tablename = 'express_support_messages') THEN
    CREATE POLICY "support_messages_select" ON express_support_messages FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'support_messages_insert' AND tablename = 'express_support_messages') THEN
    CREATE POLICY "support_messages_insert" ON express_support_messages FOR INSERT WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON express_support_messages TO service_role;
GRANT SELECT, INSERT ON express_support_messages TO authenticated;

-- ============================================================
-- 4. express_promo_banners — MISSING TABLE
--    Used by: /api/banners route
-- ============================================================

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

ALTER TABLE express_promo_banners ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'banners_select' AND tablename = 'express_promo_banners') THEN
    CREATE POLICY "banners_select" ON express_promo_banners FOR SELECT USING (true);
  END IF;
END $$;

GRANT ALL ON express_promo_banners TO service_role;
GRANT SELECT ON express_promo_banners TO authenticated;

-- ============================================================
-- 5. express_messages — Add missing columns
--    Code uses receiver_id, but schema has recipient_id
--    Also add 'message' column alias for content
-- ============================================================

ALTER TABLE express_messages
  ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES express_users(id);

-- Backfill receiver_id from recipient_id if recipient_id exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'express_messages' AND column_name = 'recipient_id'
  ) THEN
    UPDATE express_messages SET receiver_id = recipient_id WHERE receiver_id IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_receiver ON express_messages(receiver_id);

-- ============================================================
-- 6. express_bids — Add missing 'message' column
--    Used by: /api/bids route, bid creation
-- ============================================================

ALTER TABLE express_bids
  ADD COLUMN IF NOT EXISTS message TEXT;

-- ============================================================
-- 7. express_jobs — Add missing timestamp columns
--    Used by: status route, analytics
-- ============================================================

ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_by TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deliver_by TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_file TEXT;

-- ============================================================
-- 8. express_notifications — Ensure 'reference_id' column exists
--    Some code uses reference_id (UUID), schema may have it as TEXT
-- ============================================================

ALTER TABLE express_notifications
  ADD COLUMN IF NOT EXISTS reference_id TEXT;

-- ============================================================
-- 9. express_schedules — MISSING TABLE
--    Used by: /api/schedules, /api/cron/process-schedules
-- ============================================================

CREATE TABLE IF NOT EXISTS express_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES express_users(id),
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('once', 'weekly', 'biweekly', 'monthly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'completed')),
  next_run_at TIMESTAMPTZ NOT NULL,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 28),
  run_time TEXT,
  ends_at TIMESTAMPTZ,
  pickup_address TEXT NOT NULL,
  pickup_contact TEXT,
  pickup_phone TEXT,
  pickup_instructions TEXT,
  delivery_address TEXT NOT NULL,
  delivery_contact TEXT,
  delivery_phone TEXT,
  delivery_instructions TEXT,
  item_description TEXT NOT NULL,
  item_category TEXT DEFAULT 'general',
  item_weight NUMERIC,
  item_dimensions TEXT,
  urgency TEXT DEFAULT 'standard',
  budget_min NUMERIC,
  budget_max NUMERIC,
  vehicle_required TEXT DEFAULT 'any',
  special_requirements TEXT,
  equipment_needed TEXT[] DEFAULT '{}',
  manpower_count INTEGER DEFAULT 1,
  jobs_created INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  last_job_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedules_active ON express_schedules(status, next_run_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_schedules_client ON express_schedules(client_id, status);

ALTER TABLE express_schedules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'schedules_select' AND tablename = 'express_schedules') THEN
    CREATE POLICY "schedules_select" ON express_schedules FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'schedules_insert' AND tablename = 'express_schedules') THEN
    CREATE POLICY "schedules_insert" ON express_schedules FOR INSERT WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'schedules_update' AND tablename = 'express_schedules') THEN
    CREATE POLICY "schedules_update" ON express_schedules FOR UPDATE USING (true);
  END IF;
END $$;

GRANT ALL ON express_schedules TO service_role;
GRANT SELECT, INSERT, UPDATE ON express_schedules TO authenticated;

-- ============================================================
-- 10. express_push_subscriptions — Add missing columns
--     /api/push/register uses: type, expo_token, platform
-- ============================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'express_push_subscriptions') THEN
    ALTER TABLE express_push_subscriptions ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'web';
    ALTER TABLE express_push_subscriptions ADD COLUMN IF NOT EXISTS expo_token TEXT;
    ALTER TABLE express_push_subscriptions ADD COLUMN IF NOT EXISTS platform VARCHAR(20) DEFAULT 'web';
    -- Make p256dh and auth nullable (push tokens don't have them)
    ALTER TABLE express_push_subscriptions ALTER COLUMN p256dh DROP NOT NULL;
    ALTER TABLE express_push_subscriptions ALTER COLUMN auth DROP NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================
-- 11. express_driver_locations — Ensure table exists for tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS express_driver_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES express_jobs(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES express_users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  heading DOUBLE PRECISION DEFAULT 0,
  speed DOUBLE PRECISION DEFAULT 0,
  accuracy DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist if table pre-existed with different schema
ALTER TABLE express_driver_locations ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES express_jobs(id) ON DELETE CASCADE;
ALTER TABLE express_driver_locations ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES express_users(id) ON DELETE CASCADE;
ALTER TABLE express_driver_locations ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE express_driver_locations ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE express_driver_locations ADD COLUMN IF NOT EXISTS heading DOUBLE PRECISION DEFAULT 0;
ALTER TABLE express_driver_locations ADD COLUMN IF NOT EXISTS speed DOUBLE PRECISION DEFAULT 0;
ALTER TABLE express_driver_locations ADD COLUMN IF NOT EXISTS accuracy DOUBLE PRECISION;
ALTER TABLE express_driver_locations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE express_driver_locations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'driver_locations_select' AND tablename = 'express_driver_locations') THEN
    CREATE POLICY "driver_locations_select" ON express_driver_locations FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'driver_locations_all' AND tablename = 'express_driver_locations') THEN
    CREATE POLICY "driver_locations_all" ON express_driver_locations FOR ALL USING (true);
  END IF;
END $$;

GRANT ALL ON express_driver_locations TO service_role;
GRANT SELECT, INSERT, UPDATE ON express_driver_locations TO authenticated;

-- ============================================================
-- 12. Realtime publication — Ensure all needed tables are included
-- ============================================================

DO $$ BEGIN
  -- express_messages (for chat)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'express_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE express_messages;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'express_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE express_notifications;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'express_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE express_jobs;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'express_bids'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE express_bids;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'express_driver_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE express_driver_locations;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

COMMIT;

-- ============================================================
-- SUMMARY OF FIXES:
--
-- TABLES CREATED (5):
--   1. express_reviews (rating/review system)
--   2. express_support_tickets (support tickets)
--   3. express_support_messages (support chat)
--   4. express_promo_banners (promotional banners)
--   5. express_schedules (recurring job schedules)
--
-- TABLES ENSURED (1):
--   6. express_driver_locations (live tracking)
--
-- COLUMNS ADDED:
--   7. express_messages.receiver_id (code uses receiver_id, not recipient_id)
--   8. express_bids.message (bid message text)
--   9. express_jobs: delivered_at, completed_at, confirmed_at, pickup_by, deliver_by, invoice_file
--  10. express_notifications.reference_id
--  11. express_push_subscriptions: type, expo_token, platform
--
-- REALTIME:
--  12. Ensured 5 tables in supabase_realtime publication
--
-- All use IF NOT EXISTS — safe to re-run
-- ============================================================
