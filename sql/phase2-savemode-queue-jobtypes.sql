-- Phase 2: SaveMode, Multi-Job Queue, Job Types, Regular Schedules
-- Run this in Supabase SQL Editor

-- ═══════════════════════════════════════════════
-- 2-3: Job Type separation
-- ═══════════════════════════════════════════════
ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS job_type VARCHAR(20) DEFAULT 'spot';

-- ═══════════════════════════════════════════════
-- 2-1: SaveMode consolidated delivery
-- ═══════════════════════════════════════════════
ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS delivery_mode VARCHAR(20) DEFAULT 'express',
  ADD COLUMN IF NOT EXISTS save_mode_window INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS save_mode_deadline TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS consolidation_group_id UUID DEFAULT NULL;

CREATE TABLE IF NOT EXISTS consolidation_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES express_users(id) DEFAULT NULL,
  vehicle_mode VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'forming'
    CHECK (status IN ('forming', 'ready', 'assigned', 'in_progress', 'completed', 'cancelled')),
  route_optimized JSONB DEFAULT NULL,
  total_jobs INTEGER DEFAULT 0,
  max_jobs INTEGER DEFAULT 8,
  cluster_center_lat DECIMAL(10,8) DEFAULT NULL,
  cluster_center_lng DECIMAL(11,8) DEFAULT NULL,
  cluster_radius_km DECIMAL(5,2) DEFAULT 5.0,
  discount_percent DECIMAL(4,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consolidation_groups_status ON consolidation_groups(status);
CREATE INDEX IF NOT EXISTS idx_consolidation_groups_vehicle ON consolidation_groups(vehicle_mode);
CREATE INDEX IF NOT EXISTS idx_jobs_consolidation_group ON express_jobs(consolidation_group_id);

-- ═══════════════════════════════════════════════
-- 2-2: Driver multi-job queue
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS driver_job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES express_users(id),
  job_id UUID NOT NULL REFERENCES express_jobs(id),
  queue_position INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'active', 'picked_up', 'completed', 'skipped')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ DEFAULT NULL,
  picked_up_at TIMESTAMPTZ DEFAULT NULL,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE(driver_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_queue_driver ON driver_job_queue(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_queue_status ON driver_job_queue(status);

-- ═══════════════════════════════════════════════
-- 2-4: Regular Schedules
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS regular_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES express_users(id),
  title VARCHAR(200) NOT NULL,
  description TEXT DEFAULT NULL,
  frequency VARCHAR(20) NOT NULL DEFAULT 'weekly'
    CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
  day_of_week INTEGER[] DEFAULT NULL,
  time_slot VARCHAR(10) DEFAULT '09:00',
  locations JSONB NOT NULL DEFAULT '[]',
  vehicle_mode VARCHAR(20) DEFAULT NULL,
  package_category VARCHAR(50) DEFAULT 'general',
  weight_range VARCHAR(20) DEFAULT NULL,
  special_requirements TEXT DEFAULT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE DEFAULT NULL,
  monthly_estimated_jobs INTEGER DEFAULT NULL,
  agreed_rate DECIMAL(10,2) DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regular_schedules_customer ON regular_schedules(customer_id);
CREATE INDEX IF NOT EXISTS idx_regular_schedules_active ON regular_schedules(is_active);

-- ═══════════════════════════════════════════════
-- SaveMode discount settings
-- ═══════════════════════════════════════════════
INSERT INTO express_settings (key, value)
VALUES
  ('save_mode_4hr_discount', '20'),
  ('save_mode_8hr_discount', '25'),
  ('save_mode_12hr_discount', '28'),
  ('save_mode_24hr_discount', '30')
ON CONFLICT (key) DO NOTHING;
