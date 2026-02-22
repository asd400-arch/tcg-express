-- T&C acceptance tracking + driver liability columns
ALTER TABLE express_users
  ADD COLUMN IF NOT EXISTS tc_accepted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tc_version VARCHAR(10) DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS driver_liability_accepted BOOLEAN DEFAULT false;
