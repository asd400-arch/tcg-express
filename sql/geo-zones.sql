-- Geo-fencing: Service area zones for delivery coverage
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS service_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT NULL,
  zone_type VARCHAR(20) NOT NULL DEFAULT 'coverage'
    CHECK (zone_type IN ('coverage', 'surcharge', 'restricted')),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  -- Bounding box (lat/lng)
  lat_min DECIMAL(10,7) NOT NULL,
  lat_max DECIMAL(10,7) NOT NULL,
  lng_min DECIMAL(10,7) NOT NULL,
  lng_max DECIMAL(10,7) NOT NULL,
  -- Optional surcharge for surcharge zones
  surcharge_rate DECIMAL(4,2) DEFAULT 0,
  surcharge_flat DECIMAL(10,2) DEFAULT 0,
  -- Metadata
  color VARCHAR(7) DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_zones_status ON service_zones(status);

-- Pre-seed Singapore zones
INSERT INTO service_zones (name, description, zone_type, lat_min, lat_max, lng_min, lng_max, color) VALUES
  ('Singapore Central', 'CBD, Marina Bay, Orchard, Novena, Toa Payoh', 'coverage', 1.2700, 1.3300, 103.8000, 103.8700, '#3b82f6'),
  ('Singapore East', 'Bedok, Tampines, Pasir Ris, Changi', 'coverage', 1.3100, 1.3700, 103.8700, 103.9900, '#10b981'),
  ('Singapore West', 'Jurong, Clementi, Bukit Batok, Choa Chu Kang', 'coverage', 1.3200, 1.3900, 103.6800, 103.7700, '#f59e0b'),
  ('Singapore North', 'Woodlands, Yishun, Sembawang, Ang Mo Kio', 'coverage', 1.3600, 1.4500, 103.7600, 103.8600, '#8b5cf6'),
  ('Singapore South', 'Harbourfront, Sentosa, Bukit Merah', 'coverage', 1.2400, 1.2900, 103.7800, 103.8400, '#ec4899')
ON CONFLICT DO NOTHING;
