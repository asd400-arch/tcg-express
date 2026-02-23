-- ============================================================
-- Add ALL missing columns to express_jobs
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS
-- Run in Supabase SQL Editor
-- ============================================================
-- Source migrations that were never applied:
--   sql/phase2-savemode-queue-jobtypes.sql
--   sql/ev-green-points.sql
--   sql/ev-commission-columns.sql
--   sql/job-categories-columns.sql
--   sql/phase8-wallet-rewards-support.sql
--   sql/fix-storage-tracking.sql
--   sql/refund-columns.sql
-- ============================================================

BEGIN;

-- ── From phase2-savemode-queue-jobtypes.sql ─────────────────
ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS job_type VARCHAR(20) DEFAULT 'spot',
  ADD COLUMN IF NOT EXISTS delivery_mode VARCHAR(20) DEFAULT 'express',
  ADD COLUMN IF NOT EXISTS save_mode_window INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS save_mode_deadline TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS consolidation_group_id UUID DEFAULT NULL;

-- ── From ev-green-points.sql ────────────────────────────────
ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS is_ev_selected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS co2_saved_kg DECIMAL(6,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS green_points_earned INTEGER DEFAULT NULL;

-- ── From ev-commission-columns.sql ──────────────────────────
ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(4,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS driver_payout DECIMAL(10,2) DEFAULT NULL;

-- ── From job-categories-columns.sql ─────────────────────────
ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS equipment_needed TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS manpower_count INTEGER DEFAULT 1;

-- ── From phase8-wallet-rewards-support.sql ──────────────────
-- NOTE: coupon_id added as plain UUID (no FK — express_coupons
--       was replaced by promo_codes in wallet migration)
ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS coupon_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_discount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wallet_paid BOOLEAN DEFAULT false;

-- ── From fix-storage-tracking.sql ───────────────────────────
ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS pickup_photo TEXT,
  ADD COLUMN IF NOT EXISTS delivery_photo TEXT;

-- ── From refund-columns.sql ─────────────────────────────────
ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT;

-- ── Indexes for new columns ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON express_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_delivery_mode ON express_jobs(delivery_mode);
CREATE INDEX IF NOT EXISTS idx_jobs_consolidation_group ON express_jobs(consolidation_group_id);
CREATE INDEX IF NOT EXISTS idx_jobs_ev_selected ON express_jobs(is_ev_selected);

COMMIT;

-- ============================================================
-- 20 columns added from 7 migration files
-- All use IF NOT EXISTS — safe to re-run
-- ============================================================
