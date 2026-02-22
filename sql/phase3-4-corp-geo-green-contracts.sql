-- Phase 3-4: Corp Premium, Geo-fencing, Green Points Expansion, Contracts
-- Run this in Supabase SQL Editor

-- ═══════════════════════════════════════════════
-- 3-3: Geo-fencing - driver preferences
-- ═══════════════════════════════════════════════
ALTER TABLE express_users
  ADD COLUMN IF NOT EXISTS preferred_nav_app VARCHAR(20) DEFAULT 'google_maps',
  ADD COLUMN IF NOT EXISTS auto_navigate BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS nearby_job_alerts BOOLEAN DEFAULT true;

-- ═══════════════════════════════════════════════
-- 3-4: Corp Premium
-- ═══════════════════════════════════════════════
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
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'nda_pending', 'bidding_open', 'bidding_closed', 'awarded', 'active', 'completed', 'cancelled')),
  awarded_partner_id UUID REFERENCES express_users(id) DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_corp_premium_client ON corp_premium_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_corp_premium_status ON corp_premium_requests(status);

-- Auto-generate request number
CREATE OR REPLACE FUNCTION generate_corp_premium_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.request_number := 'CPR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('corp_premium_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS corp_premium_seq START 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_corp_premium_number'
  ) THEN
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

-- ═══════════════════════════════════════════════
-- 4-1: Green Points expansion
-- ═══════════════════════════════════════════════
-- Add tier and streak tracking columns
ALTER TABLE express_users
  ADD COLUMN IF NOT EXISTS green_tier VARCHAR(20) DEFAULT 'bronze',
  ADD COLUMN IF NOT EXISTS green_points_balance INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS green_streak_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS green_streak_last_month VARCHAR(7) DEFAULT NULL;

-- Add points_type for new earning methods
-- (green_points_ledger already exists from ev-green-points.sql)
-- Just need to ensure it can handle new points_type values

-- ═══════════════════════════════════════════════
-- 4-2: Contracts
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number VARCHAR(20) UNIQUE,
  contract_type VARCHAR(30) NOT NULL DEFAULT 'customer_msa'
    CHECK (contract_type IN ('customer_msa', 'partner_agreement', 'nda')),
  party_a_name VARCHAR(200) DEFAULT 'TCG Express Pte Ltd',
  party_b_id UUID REFERENCES express_users(id),
  corp_premium_request_id UUID REFERENCES corp_premium_requests(id) DEFAULT NULL,
  effective_date DATE DEFAULT NULL,
  expiry_date DATE DEFAULT NULL,
  contract_value DECIMAL(12,2) DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'signed', 'active', 'expired', 'terminated')),
  document_url TEXT DEFAULT NULL,
  signed_document_url TEXT DEFAULT NULL,
  signed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_party ON contracts(party_b_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

-- Auto-generate contract number
CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.contract_number := 'MSA-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('contract_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS contract_seq START 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_contract_number'
  ) THEN
    CREATE TRIGGER trg_contract_number
    BEFORE INSERT ON contracts
    FOR EACH ROW
    WHEN (NEW.contract_number IS NULL)
    EXECUTE FUNCTION generate_contract_number();
  END IF;
END $$;
