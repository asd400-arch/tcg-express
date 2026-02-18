-- Phase 10: Job Cancellation with Escrow Refund
-- Adds refund tracking to transactions and cancellation metadata to jobs

ALTER TABLE express_transactions ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT;  -- 'client' or 'admin'
