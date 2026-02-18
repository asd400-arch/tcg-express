-- Phase 19: Scheduled & Recurring Jobs
-- Creates express_schedules table for one-time future and recurring delivery schedules

CREATE TABLE IF NOT EXISTS express_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES express_users(id) NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('once', 'weekly', 'biweekly', 'monthly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'completed')),
  next_run_at TIMESTAMPTZ NOT NULL,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 28),
  run_time TEXT,
  ends_at TIMESTAMPTZ,

  -- Job template fields (mirrors express_jobs columns)
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

  -- Tracking
  jobs_created INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  last_job_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cron queries: find active schedules that are due
CREATE INDEX idx_schedules_next_run ON express_schedules (status, next_run_at) WHERE status = 'active';

-- Index for client lookups
CREATE INDEX idx_schedules_client ON express_schedules (client_id, status);

-- Enable RLS
ALTER TABLE express_schedules ENABLE ROW LEVEL SECURITY;

-- Clients can read their own schedules
CREATE POLICY "Clients can view own schedules"
  ON express_schedules FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

-- Clients can insert their own schedules
CREATE POLICY "Clients can create own schedules"
  ON express_schedules FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

-- Clients can update their own schedules
CREATE POLICY "Clients can update own schedules"
  ON express_schedules FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid());

-- Service role (used by API routes via supabaseAdmin) bypasses RLS automatically

-- Grant column-level permissions
GRANT SELECT, INSERT, UPDATE ON express_schedules TO authenticated;
GRANT ALL ON express_schedules TO service_role;
