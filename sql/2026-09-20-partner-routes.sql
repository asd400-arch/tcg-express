-- Partner routes: TCG Fresh (and other B2B partners) push a morning delivery route
-- (one pickup, N restaurant stops) that is assigned straight to a zone's dedicated driver.
-- No bidding, fixed fare. Run in Supabase SQL Editor.

-- 1. Dedicated / backup driver per service zone
ALTER TABLE express_users
  ADD COLUMN IF NOT EXISTS dedicated_zone_id UUID REFERENCES service_zones(id),
  ADD COLUMN IF NOT EXISTS zone_role        TEXT CHECK (zone_role IN ('dedicated','backup')),
  ADD COLUMN IF NOT EXISTS cold_capable     BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_express_users_zone ON express_users(dedicated_zone_id, zone_role);

-- 2. Route header
CREATE TABLE IF NOT EXISTS partner_routes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner            TEXT NOT NULL,                 -- external_api_keys.source, e.g. 'tcg_fresh'
  external_ref       TEXT NOT NULL,                 -- partner's batch number
  api_key_id         UUID REFERENCES external_api_keys(id),
  client_id          UUID NOT NULL REFERENCES express_users(id),
  zone_id            UUID REFERENCES service_zones(id),
  route_date         DATE NOT NULL,
  pickup_slot        TEXT,                          -- '07:30-08:30'
  temperature        TEXT DEFAULT 'ambient',        -- ambient|chilled|frozen|mixed
  pickup_address     TEXT NOT NULL,
  pickup_contact     TEXT,
  pickup_phone       TEXT,
  pickup_instructions TEXT,
  stop_count         INTEGER NOT NULL DEFAULT 0,
  base_fare          NUMERIC NOT NULL DEFAULT 0,
  stop_fare          NUMERIC NOT NULL DEFAULT 0,
  total_fare         NUMERIC NOT NULL DEFAULT 0,
  assigned_driver_id UUID REFERENCES express_users(id),
  status             TEXT NOT NULL DEFAULT 'unassigned', -- unassigned|assigned|in_progress|completed|cancelled
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (partner, external_ref)
);

-- 3. Stops live in express_jobs (one job per stop) so the driver app, POD and status machine are reused as-is
ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS partner_route_id UUID REFERENCES partner_routes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS stop_seq         INTEGER,
  ADD COLUMN IF NOT EXISTS fare_mode        TEXT NOT NULL DEFAULT 'bid',   -- bid|fixed
  ADD COLUMN IF NOT EXISTS fixed_fare       NUMERIC,
  ADD COLUMN IF NOT EXISTS temperature      TEXT,
  ADD COLUMN IF NOT EXISTS delivery_window  TEXT;                          -- '09:00-10:30'
CREATE INDEX IF NOT EXISTS idx_express_jobs_route ON express_jobs(partner_route_id, stop_seq);

-- 4. Outbound webhook secret per partner key (webhook_url already exists)
ALTER TABLE external_api_keys ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

-- 5. Fare settings (admin can change in express_settings)
INSERT INTO express_settings (key, value) VALUES ('partner_base_fare', '25'), ('partner_stop_fare', '6')
ON CONFLICT (key) DO NOTHING;

-- 6. RLS: partner_routes is server-only (service role)
ALTER TABLE partner_routes ENABLE ROW LEVEL SECURITY;
