-- ============================================================
-- TCG Express — Combined Safe Migration
-- Generated: 2026-02-23
-- Safe to re-run: uses IF NOT EXISTS throughout
-- Run in Supabase SQL Editor
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- SECTION 1: Core tables (express_*)
-- ════════════════════════════════════════════════════════════

-- 1a. express_settings
CREATE TABLE IF NOT EXISTS express_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO express_settings (key, value) VALUES ('commission_rate', '0.15')
  ON CONFLICT (key) DO NOTHING;

-- 1b. express_reviews
CREATE TABLE IF NOT EXISTS express_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES express_jobs(id),
  client_id UUID REFERENCES express_users(id),
  driver_id UUID REFERENCES express_users(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  reviewer_role VARCHAR(10) DEFAULT 'client' CHECK (reviewer_role IN ('client', 'driver')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_job_role ON express_reviews(job_id, reviewer_role);

-- 1c. express_disputes
CREATE TABLE IF NOT EXISTS express_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES express_jobs(id),
  opened_by UUID REFERENCES express_users(id),
  opened_by_role VARCHAR(10) CHECK (opened_by_role IN ('client', 'driver')),
  reason VARCHAR(50) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'closed', 'cancelled')),
  resolution TEXT,
  admin_notes TEXT,
  resolved_by UUID REFERENCES express_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_disputes_job ON express_disputes(job_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON express_disputes(status);

-- 1d. express_schedules
CREATE TABLE IF NOT EXISTS express_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES express_users(id),
  schedule_type VARCHAR(20) DEFAULT 'one_time' CHECK (schedule_type IN ('one_time', 'daily', 'weekly', 'biweekly', 'monthly')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  next_run_at TIMESTAMPTZ,
  day_of_week INTEGER,
  day_of_month INTEGER,
  run_time TIME,
  ends_at TIMESTAMPTZ,
  pickup_address TEXT,
  pickup_contact VARCHAR(100),
  pickup_phone VARCHAR(20),
  pickup_instructions TEXT,
  delivery_address TEXT,
  delivery_contact VARCHAR(100),
  delivery_phone VARCHAR(20),
  delivery_instructions TEXT,
  item_description TEXT,
  item_category VARCHAR(50),
  item_weight DECIMAL(8,2),
  item_dimensions TEXT,
  urgency VARCHAR(20) DEFAULT 'standard',
  budget_min DECIMAL(10,2),
  budget_max DECIMAL(10,2),
  vehicle_required VARCHAR(30) DEFAULT 'any',
  special_requirements TEXT,
  equipment_needed TEXT[] DEFAULT '{}',
  manpower_count INTEGER DEFAULT 1,
  jobs_created INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  last_job_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_schedules_client ON express_schedules(client_id);
CREATE INDEX IF NOT EXISTS idx_schedules_next ON express_schedules(next_run_at);

-- 1e. express_driver_locations
CREATE TABLE IF NOT EXISTS express_driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES express_jobs(id) UNIQUE,
  driver_id UUID REFERENCES express_users(id),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_driver_loc_job ON express_driver_locations(job_id);
CREATE INDEX IF NOT EXISTS idx_driver_loc_driver ON express_driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_loc_time ON express_driver_locations(created_at DESC);

-- 1f. express_promo_banners
CREATE TABLE IF NOT EXISTS express_promo_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200),
  subtitle TEXT,
  image_url TEXT,
  link TEXT,
  bg_color VARCHAR(20),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- SECTION 2: express_users — missing columns
-- ════════════════════════════════════════════════════════════

ALTER TABLE express_users ADD COLUMN IF NOT EXISTS reset_code VARCHAR(10);
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS reset_code_expires TIMESTAMPTZ;
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS reset_attempts INTEGER DEFAULT 0;
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS is_ev_vehicle BOOLEAN DEFAULT false;
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS ev_vehicle_type VARCHAR(50);
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS ev_certification_url TEXT;
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS driver_type VARCHAR(20) DEFAULT 'individual';
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS nric_number VARCHAR(20);
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS business_reg_number VARCHAR(30);
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS nric_front_url TEXT;
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS nric_back_url TEXT;
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS license_photo_url TEXT;
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS business_reg_cert_url TEXT;
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS vehicle_insurance_url TEXT;
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS preferred_nav_app VARCHAR(20) DEFAULT 'google_maps';
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS auto_navigate BOOLEAN DEFAULT true;
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS nearby_job_alerts BOOLEAN DEFAULT true;
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS green_tier VARCHAR(20) DEFAULT 'bronze';
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS green_points_balance INTEGER DEFAULT 0;
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS green_streak_count INTEGER DEFAULT 0;
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS green_streak_last_month VARCHAR(7);
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS tc_accepted_at TIMESTAMPTZ;
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS tc_version VARCHAR(10);
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS driver_liability_accepted BOOLEAN DEFAULT false;
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}';
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS client_rating NUMERIC DEFAULT 5.0;

-- ════════════════════════════════════════════════════════════
-- SECTION 3: express_jobs — missing columns
-- ════════════════════════════════════════════════════════════

ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS job_type VARCHAR(20) DEFAULT 'spot';
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS delivery_mode VARCHAR(20) DEFAULT 'express';
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS save_mode_window INTEGER;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS save_mode_deadline TIMESTAMPTZ;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS consolidation_group_id UUID;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS is_ev_selected BOOLEAN DEFAULT false;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS co2_saved_kg DECIMAL(8,2);
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS green_points_earned INTEGER;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(4,2);
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2);
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS driver_payout DECIMAL(10,2);
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS equipment_needed TEXT[] DEFAULT '{}';
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS manpower_count INTEGER DEFAULT 1;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS coupon_id UUID;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS coupon_discount DECIMAL(10,2);
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS points_used INTEGER DEFAULT 0;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS points_discount DECIMAL(10,2);
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS wallet_paid BOOLEAN DEFAULT false;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS pickup_photo TEXT;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS delivery_photo TEXT;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS cancelled_by UUID;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS pickup_by TIMESTAMPTZ;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS deliver_by TIMESTAMPTZ;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS invoice_file TEXT;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS assigned_bid_id UUID;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS final_amount DECIMAL(10,2);
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS item_dimensions TEXT;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS distance_km DECIMAL(8,2);
CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON express_jobs(job_type);

-- ════════════════════════════════════════════════════════════
-- SECTION 4: express_transactions — missing columns
-- ════════════════════════════════════════════════════════════

ALTER TABLE express_transactions ADD COLUMN IF NOT EXISTS held_at TIMESTAMPTZ;
ALTER TABLE express_transactions ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
ALTER TABLE express_transactions ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE express_transactions ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;
ALTER TABLE express_transactions ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE express_transactions ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT;
ALTER TABLE express_transactions ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2);
ALTER TABLE express_transactions ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2);
ALTER TABLE express_transactions ADD COLUMN IF NOT EXISTS driver_payout DECIMAL(10,2);

-- ════════════════════════════════════════════════════════════
-- SECTION 5: express_messages — missing columns
-- ════════════════════════════════════════════════════════════

ALTER TABLE express_messages ADD COLUMN IF NOT EXISTS receiver_id UUID;

-- ════════════════════════════════════════════════════════════
-- SECTION 6: express_bids — missing columns
-- ════════════════════════════════════════════════════════════

ALTER TABLE express_bids ADD COLUMN IF NOT EXISTS message TEXT;

-- ════════════════════════════════════════════════════════════
-- SECTION 7: express_notifications — missing columns
-- ════════════════════════════════════════════════════════════

ALTER TABLE express_notifications ADD COLUMN IF NOT EXISTS reference_id UUID;

-- ════════════════════════════════════════════════════════════
-- SECTION 8: Green Points tables
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS green_points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES express_users(id),
  user_type VARCHAR(10) DEFAULT 'driver',
  job_id UUID REFERENCES express_jobs(id),
  points_earned INTEGER NOT NULL DEFAULT 0,
  points_type VARCHAR(30) DEFAULT 'delivery',
  co2_saved_kg DECIMAL(8,2),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gpl_user ON green_points_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_gpl_job ON green_points_ledger(job_id);

CREATE TABLE IF NOT EXISTS green_points_redemption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES express_users(id),
  points_redeemed INTEGER NOT NULL,
  cashback_amount DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'pending',
  payment_method VARCHAR(30),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- SECTION 9: Phase 2 — SaveMode, Queue, Job Types
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS consolidation_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES express_users(id),
  vehicle_mode VARCHAR(30),
  status VARCHAR(20) DEFAULT 'forming',
  route_optimized BOOLEAN DEFAULT false,
  total_jobs INTEGER DEFAULT 0,
  max_jobs INTEGER DEFAULT 5,
  cluster_center_lat DOUBLE PRECISION,
  cluster_center_lng DOUBLE PRECISION,
  cluster_radius_km DECIMAL(6,2),
  discount_percent DECIMAL(4,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS driver_job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES express_users(id),
  job_id UUID REFERENCES express_jobs(id),
  queue_position INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'queued',
  assigned_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_djq_driver ON driver_job_queue(driver_id);
CREATE INDEX IF NOT EXISTS idx_djq_job ON driver_job_queue(job_id);

CREATE TABLE IF NOT EXISTS regular_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES express_users(id),
  title VARCHAR(200),
  description TEXT,
  frequency VARCHAR(20) DEFAULT 'weekly',
  day_of_week INTEGER,
  time_slot VARCHAR(20),
  locations JSONB DEFAULT '[]',
  vehicle_mode VARCHAR(30),
  package_category VARCHAR(50),
  weight_range VARCHAR(20),
  special_requirements TEXT,
  start_date DATE,
  end_date DATE,
  monthly_estimated_jobs INTEGER,
  agreed_rate DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- SECTION 10: Corp Premium
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS corp_premium_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES express_users(id),
  request_number VARCHAR(20) UNIQUE,
  title VARCHAR(200) NOT NULL,
  description TEXT DEFAULT NULL,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  estimated_budget DECIMAL(12,2) DEFAULT NULL,
  locations JSONB NOT NULL DEFAULT '[]',
  vehicle_modes TEXT[] DEFAULT '{}',
  special_requirements TEXT DEFAULT NULL,
  certifications_required TEXT[] DEFAULT '{}',
  min_fleet_size INTEGER DEFAULT 1,
  min_rating DECIMAL(2,1) DEFAULT 4.5,
  nda_accepted BOOLEAN DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  awarded_partner_id UUID REFERENCES express_users(id) DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_corp_premium_client ON corp_premium_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_corp_premium_status ON corp_premium_requests(status);

-- Add RFQ columns missing from original schema
ALTER TABLE corp_premium_requests ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';
ALTER TABLE corp_premium_requests ADD COLUMN IF NOT EXISTS contract_duration INTEGER DEFAULT 3;
ALTER TABLE corp_premium_requests ADD COLUMN IF NOT EXISTS estimated_volume TEXT;
ALTER TABLE corp_premium_requests ADD COLUMN IF NOT EXISTS pickup_regions TEXT;
ALTER TABLE corp_premium_requests ADD COLUMN IF NOT EXISTS delivery_regions TEXT;
ALTER TABLE corp_premium_requests ADD COLUMN IF NOT EXISTS vehicle_types TEXT;

-- Expand status CHECK to include RFQ statuses
-- (DROP + re-ADD is idempotent since ADD will just succeed if constraint matches)
ALTER TABLE corp_premium_requests DROP CONSTRAINT IF EXISTS corp_premium_requests_status_check;
ALTER TABLE corp_premium_requests ADD CONSTRAINT corp_premium_requests_status_check
  CHECK (status IN ('draft', 'nda_pending', 'bidding_open', 'bidding_closed', 'awarded',
    'active', 'completed', 'cancelled', 'submitted', 'under_review', 'quote_sent', 'accepted', 'rejected'));

-- Auto-generate request number
CREATE SEQUENCE IF NOT EXISTS corp_premium_seq START 1;

CREATE OR REPLACE FUNCTION generate_corp_premium_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.request_number := 'CPR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('corp_premium_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_corp_premium_number') THEN
    CREATE TRIGGER trg_corp_premium_number
    BEFORE INSERT ON corp_premium_requests
    FOR EACH ROW
    WHEN (NEW.request_number IS NULL)
    EXECUTE FUNCTION generate_corp_premium_number();
  END IF;
END $$;

-- Corp Premium Bids
CREATE TABLE IF NOT EXISTS corp_premium_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES corp_premium_requests(id),
  partner_id UUID NOT NULL REFERENCES express_users(id),
  bid_amount DECIMAL(12,2) NOT NULL,
  fleet_size INTEGER NOT NULL DEFAULT 1,
  proposed_vehicles TEXT[] DEFAULT '{}',
  proposal_text TEXT DEFAULT NULL,
  certifications TEXT[] DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'shortlisted', 'accepted', 'rejected', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(request_id, partner_id)
);
CREATE INDEX IF NOT EXISTS idx_corp_bids_request ON corp_premium_bids(request_id);
CREATE INDEX IF NOT EXISTS idx_corp_bids_partner ON corp_premium_bids(partner_id);

-- Contracts
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number VARCHAR(20) UNIQUE,
  contract_type VARCHAR(20) DEFAULT 'premium',
  party_a_name VARCHAR(200),
  party_b_id UUID REFERENCES express_users(id),
  corp_premium_request_id UUID REFERENCES corp_premium_requests(id) DEFAULT NULL,
  effective_date DATE,
  expiry_date DATE,
  contract_value DECIMAL(12,2),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'expired', 'terminated', 'completed')),
  document_url TEXT,
  signed_document_url TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- SECTION 11: Geo Zones
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS service_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  zone_type VARCHAR(20) DEFAULT 'standard',
  status VARCHAR(20) DEFAULT 'active',
  lat_min DOUBLE PRECISION,
  lat_max DOUBLE PRECISION,
  lng_min DOUBLE PRECISION,
  lng_max DOUBLE PRECISION,
  surcharge_rate DECIMAL(4,2) DEFAULT 0,
  surcharge_flat DECIMAL(8,2) DEFAULT 0,
  color VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- SECTION 12: Warehouse Management
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS warehouse_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES express_users(id),
  sku VARCHAR(50) NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  min_stock_level INTEGER DEFAULT 0,
  max_stock_level INTEGER,
  weight_kg DECIMAL(8,2),
  length_cm DECIMAL(8,2),
  width_cm DECIMAL(8,2),
  height_cm DECIMAL(8,2),
  warehouse_zone VARCHAR(20),
  rack_number VARCHAR(20),
  shelf_level VARCHAR(10),
  bin_code VARCHAR(20),
  barcode VARCHAR(100),
  barcode_type VARCHAR(20),
  unit_cost DECIMAL(10,2),
  unit_price DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'SGD',
  status VARCHAR(20) DEFAULT 'active',
  last_counted_at TIMESTAMPTZ,
  last_received_at TIMESTAMPTZ,
  last_shipped_at TIMESTAMPTZ,
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, sku)
);
CREATE INDEX IF NOT EXISTS idx_wh_inv_client ON warehouse_inventory(client_id);
CREATE INDEX IF NOT EXISTS idx_wh_inv_sku ON warehouse_inventory(sku);

CREATE TABLE IF NOT EXISTS warehouse_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(20) UNIQUE,
  client_id UUID NOT NULL REFERENCES express_users(id),
  order_type VARCHAR(20) NOT NULL DEFAULT 'outbound',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  origin_address TEXT,
  destination_address TEXT,
  contact_name VARCHAR(100),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(200),
  items JSONB NOT NULL DEFAULT '[]',
  total_items INTEGER DEFAULT 0,
  total_quantity INTEGER DEFAULT 0,
  subtotal DECIMAL(10,2) DEFAULT 0,
  handling_fee DECIMAL(10,2) DEFAULT 0,
  shipping_fee DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'SGD',
  express_job_id UUID,
  notes TEXT,
  special_instructions TEXT,
  expected_date DATE,
  confirmed_at TIMESTAMPTZ,
  processing_at TIMESTAMPTZ,
  packed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES express_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wh_orders_client ON warehouse_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_wh_orders_status ON warehouse_orders(status);

CREATE TABLE IF NOT EXISTS warehouse_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES warehouse_inventory(id),
  order_id UUID REFERENCES warehouse_orders(id),
  movement_type VARCHAR(20) NOT NULL,
  quantity_change INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reference TEXT,
  performed_by UUID REFERENCES express_users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wh_moves_inv ON warehouse_stock_movements(inventory_id);

CREATE TABLE IF NOT EXISTS warehouse_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_name VARCHAR(100) NOT NULL,
  rate_category VARCHAR(30) NOT NULL,
  description TEXT,
  unit_price DECIMAL(10,2) NOT NULL,
  unit_type VARCHAR(20) NOT NULL DEFAULT 'per_item',
  currency VARCHAR(3) DEFAULT 'SGD',
  tier_pricing JSONB,
  min_order_value DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- SECTION 13: Realtime publication (safe to re-run)
-- ════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Add tables to realtime publication if not already added
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'express_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE express_messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'express_notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE express_notifications;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'express_jobs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE express_jobs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'express_bids') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE express_bids;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'express_driver_locations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE express_driver_locations;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- SECTION 14: Corp Premium flag on jobs
-- ════════════════════════════════════════════════════════════

ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS is_corp_premium BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_jobs_corp_premium ON express_jobs(is_corp_premium) WHERE is_corp_premium = true;

-- ════════════════════════════════════════════════════════════
-- DONE. All tables and columns should now exist.
-- ════════════════════════════════════════════════════════════
