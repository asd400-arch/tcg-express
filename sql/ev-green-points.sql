-- EV (Electric Vehicle) columns on users and jobs
ALTER TABLE express_users
  ADD COLUMN IF NOT EXISTS is_ev_vehicle BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ev_vehicle_type VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ev_certification_url TEXT DEFAULT NULL;

ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS is_ev_selected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS co2_saved_kg DECIMAL(6,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS green_points_earned INTEGER DEFAULT NULL;

-- Green Points Ledger
CREATE TABLE IF NOT EXISTS green_points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES express_users(id),
  user_type VARCHAR(10) NOT NULL CHECK (user_type IN ('client', 'driver')),
  job_id UUID REFERENCES express_jobs(id),
  points_earned INTEGER NOT NULL DEFAULT 0,
  points_type VARCHAR(20) NOT NULL DEFAULT 'ev_delivery',
  co2_saved_kg DECIMAL(6,2) DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_green_points_user ON green_points_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_green_points_job ON green_points_ledger(job_id);

-- Green Points Redemption
CREATE TABLE IF NOT EXISTS green_points_redemption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES express_users(id),
  points_redeemed INTEGER NOT NULL,
  cashback_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  payment_method VARCHAR(50) DEFAULT NULL,
  processed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_green_redemption_user ON green_points_redemption(user_id);
