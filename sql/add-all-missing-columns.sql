-- ============================================================
-- Add ALL missing columns across all tables
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS throughout
-- Run in Supabase SQL Editor
-- ============================================================

BEGIN;

-- ============================================================
-- 1. express_users — missing migration columns
-- ============================================================

-- From ev-green-points.sql
ALTER TABLE express_users
  ADD COLUMN IF NOT EXISTS is_ev_vehicle BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ev_vehicle_type VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ev_certification_url TEXT DEFAULT NULL;

-- From driver-kyc-columns.sql
ALTER TABLE express_users
  ADD COLUMN IF NOT EXISTS driver_type TEXT,
  ADD COLUMN IF NOT EXISTS nric_number TEXT,
  ADD COLUMN IF NOT EXISTS business_reg_number TEXT,
  ADD COLUMN IF NOT EXISTS nric_front_url TEXT,
  ADD COLUMN IF NOT EXISTS nric_back_url TEXT,
  ADD COLUMN IF NOT EXISTS license_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS business_reg_cert_url TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_insurance_url TEXT;

-- From phase3-4-corp-geo-green-contracts.sql
ALTER TABLE express_users
  ADD COLUMN IF NOT EXISTS preferred_nav_app VARCHAR(20) DEFAULT 'google_maps',
  ADD COLUMN IF NOT EXISTS auto_navigate BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS nearby_job_alerts BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS green_tier VARCHAR(20) DEFAULT 'bronze',
  ADD COLUMN IF NOT EXISTS green_points_balance INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS green_streak_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS green_streak_last_month VARCHAR(7) DEFAULT NULL;

-- From tc-and-vehicle-modes.sql
ALTER TABLE express_users
  ADD COLUMN IF NOT EXISTS tc_accepted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tc_version VARCHAR(10) DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS driver_liability_accepted BOOLEAN DEFAULT false;

-- From phase-17-notification-preferences.sql
ALTER TABLE express_users
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
    "job_updates": { "email": true, "push": true },
    "bid_activity": { "email": true, "push": true },
    "delivery_status": { "email": true, "push": true },
    "account_alerts": { "email": true, "push": true }
  }'::jsonb;

-- From bidirectional-reviews.sql
ALTER TABLE express_users
  ADD COLUMN IF NOT EXISTS client_rating NUMERIC(3,2) DEFAULT NULL;


-- ============================================================
-- 2. express_jobs — missing migration columns
-- ============================================================

-- From phase2-savemode-queue-jobtypes.sql
ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS job_type VARCHAR(20) DEFAULT 'spot',
  ADD COLUMN IF NOT EXISTS delivery_mode VARCHAR(20) DEFAULT 'express',
  ADD COLUMN IF NOT EXISTS save_mode_window INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS save_mode_deadline TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS consolidation_group_id UUID DEFAULT NULL;

-- From ev-green-points.sql
ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS is_ev_selected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS co2_saved_kg DECIMAL(6,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS green_points_earned INTEGER DEFAULT NULL;

-- From ev-commission-columns.sql
ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(4,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS driver_payout DECIMAL(10,2) DEFAULT NULL;

-- From job-categories-columns.sql
ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS equipment_needed TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS manpower_count INTEGER DEFAULT 1;

-- From phase8-wallet-rewards-support.sql (coupon_id without FK — express_coupons was dropped)
ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS coupon_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_discount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wallet_paid BOOLEAN DEFAULT false;

-- From fix-storage-tracking.sql
ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS pickup_photo TEXT,
  ADD COLUMN IF NOT EXISTS delivery_photo TEXT;

-- From refund-columns.sql
ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT;

-- ** NEVER HAD A MIGRATION but used across 15+ files **
ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS assigned_bid_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS final_amount NUMERIC(10,2) DEFAULT NULL;


-- ============================================================
-- 3. express_transactions — missing migration columns
-- ============================================================

-- From escrow-columns.sql
ALTER TABLE express_transactions
  ADD COLUMN IF NOT EXISTS held_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

-- From refund-columns.sql
ALTER TABLE express_transactions
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- From stripe-columns.sql
ALTER TABLE express_transactions
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT;

-- From ev-commission-columns.sql
ALTER TABLE express_transactions
  ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS driver_payout DECIMAL(10,2) DEFAULT NULL;

-- ** NEVER HAD A MIGRATION but used by bid accept, wallet pay, stripe webhook, release, refund **
ALTER TABLE express_transactions
  ADD COLUMN IF NOT EXISTS job_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS client_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS driver_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;


-- ============================================================
-- 4. Indexes for new columns
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON express_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_delivery_mode ON express_jobs(delivery_mode);
CREATE INDEX IF NOT EXISTS idx_jobs_consolidation_group ON express_jobs(consolidation_group_id);
CREATE INDEX IF NOT EXISTS idx_jobs_ev_selected ON express_jobs(is_ev_selected);
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_bid ON express_jobs(assigned_bid_id);
CREATE INDEX IF NOT EXISTS idx_txn_job_id ON express_transactions(job_id);
CREATE INDEX IF NOT EXISTS idx_txn_client_id ON express_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_txn_driver_id ON express_transactions(driver_id);
CREATE INDEX IF NOT EXISTS idx_txn_payment_status ON express_transactions(payment_status);

-- ============================================================
-- 5. express_disputes table (required for dispute system)
-- ============================================================

CREATE TABLE IF NOT EXISTS express_disputes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES express_jobs(id) NOT NULL,
  opened_by UUID REFERENCES express_users(id) NOT NULL,
  opened_by_role TEXT NOT NULL,
  reason TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resolution TEXT,
  admin_notes TEXT,
  resolved_by UUID REFERENCES express_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_disputes_job_id ON express_disputes(job_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON express_disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_opened_by ON express_disputes(opened_by);

-- RLS for express_disputes
ALTER TABLE express_disputes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'disputes_select' AND tablename = 'express_disputes') THEN
    CREATE POLICY "disputes_select" ON express_disputes FOR SELECT USING (
      opened_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM express_jobs
        WHERE express_jobs.id = express_disputes.job_id
        AND (express_jobs.client_id = auth.uid() OR express_jobs.assigned_driver_id = auth.uid())
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'disputes_insert' AND tablename = 'express_disputes') THEN
    CREATE POLICY "disputes_insert" ON express_disputes FOR INSERT WITH CHECK (opened_by = auth.uid());
  END IF;
END $$;

GRANT ALL ON express_disputes TO service_role;
GRANT SELECT, INSERT ON express_disputes TO authenticated;

COMMIT;

-- ============================================================
-- Summary: 47 columns + 1 table added
--   express_users:        16 columns
--   express_jobs:         22 columns (incl. assigned_bid_id, final_amount)
--   express_transactions:  9 columns (incl. job_id, client_id, driver_id, payment_status, paid_at)
--   express_disputes:      table created if not exists
-- All use IF NOT EXISTS — safe to re-run
-- ============================================================
