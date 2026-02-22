-- EV Commission columns for express_jobs and express_transactions
-- Run this in Supabase SQL Editor

-- Commission tracking on jobs
ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(4,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS driver_payout DECIMAL(10,2) DEFAULT NULL;

-- Commission tracking on transactions
ALTER TABLE express_transactions
  ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS driver_payout DECIMAL(10,2) DEFAULT NULL;

-- EV commission rate setting (10% for EV drivers)
INSERT INTO express_settings (key, value)
VALUES ('ev_commission_rate', '10')
ON CONFLICT (key) DO NOTHING;
