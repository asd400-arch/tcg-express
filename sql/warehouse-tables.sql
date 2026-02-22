-- Stage 2: Warehouse Module Tables
-- Run this in Supabase SQL Editor

-- ═══════════════════════════════════════════════
-- Warehouse Inventory
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS warehouse_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES express_users(id),
  sku VARCHAR(50) NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  description TEXT DEFAULT NULL,
  category VARCHAR(50) DEFAULT 'general',
  -- Stock levels
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  min_stock_level INTEGER DEFAULT 10,
  max_stock_level INTEGER DEFAULT NULL,
  -- Physical attributes
  weight_kg DECIMAL(8,2) DEFAULT NULL,
  length_cm DECIMAL(6,1) DEFAULT NULL,
  width_cm DECIMAL(6,1) DEFAULT NULL,
  height_cm DECIMAL(6,1) DEFAULT NULL,
  -- Location
  warehouse_zone VARCHAR(20) DEFAULT 'A',
  rack_number VARCHAR(20) DEFAULT NULL,
  shelf_level VARCHAR(10) DEFAULT NULL,
  bin_code VARCHAR(20) DEFAULT NULL,
  -- Barcode
  barcode VARCHAR(50) DEFAULT NULL,
  barcode_type VARCHAR(20) DEFAULT 'code128',
  -- Tracking
  unit_cost DECIMAL(10,2) DEFAULT NULL,
  unit_price DECIMAL(10,2) DEFAULT NULL,
  currency VARCHAR(3) DEFAULT 'SGD',
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'discontinued', 'quarantine')),
  last_counted_at TIMESTAMPTZ DEFAULT NULL,
  last_received_at TIMESTAMPTZ DEFAULT NULL,
  last_shipped_at TIMESTAMPTZ DEFAULT NULL,
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wh_inventory_client ON warehouse_inventory(client_id);
CREATE INDEX IF NOT EXISTS idx_wh_inventory_sku ON warehouse_inventory(sku);
CREATE INDEX IF NOT EXISTS idx_wh_inventory_barcode ON warehouse_inventory(barcode);
CREATE INDEX IF NOT EXISTS idx_wh_inventory_status ON warehouse_inventory(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wh_inventory_client_sku ON warehouse_inventory(client_id, sku);

-- ═══════════════════════════════════════════════
-- Warehouse Orders (Inbound & Outbound)
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS warehouse_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(20) UNIQUE,
  client_id UUID NOT NULL REFERENCES express_users(id),
  order_type VARCHAR(20) NOT NULL DEFAULT 'inbound'
    CHECK (order_type IN ('inbound', 'outbound', 'transfer', 'return')),
  -- Status flow: draft → confirmed → processing → packed → shipped/received → completed
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'confirmed', 'processing', 'packed', 'shipped', 'received', 'completed', 'cancelled')),
  -- Addresses
  origin_address TEXT DEFAULT NULL,
  destination_address TEXT DEFAULT NULL,
  contact_name VARCHAR(100) DEFAULT NULL,
  contact_phone VARCHAR(20) DEFAULT NULL,
  -- Items (JSONB array of line items)
  items JSONB NOT NULL DEFAULT '[]',
  -- items format: [{ inventory_id, sku, product_name, quantity, unit_price, notes }]
  total_items INTEGER NOT NULL DEFAULT 0,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  -- Pricing
  subtotal DECIMAL(10,2) DEFAULT 0,
  handling_fee DECIMAL(10,2) DEFAULT 0,
  shipping_fee DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'SGD',
  -- Linked express job (for outbound orders that trigger delivery)
  express_job_id UUID REFERENCES express_jobs(id) DEFAULT NULL,
  -- Notes
  notes TEXT DEFAULT NULL,
  special_instructions TEXT DEFAULT NULL,
  -- Tracking
  expected_date DATE DEFAULT NULL,
  confirmed_at TIMESTAMPTZ DEFAULT NULL,
  processing_at TIMESTAMPTZ DEFAULT NULL,
  packed_at TIMESTAMPTZ DEFAULT NULL,
  shipped_at TIMESTAMPTZ DEFAULT NULL,
  received_at TIMESTAMPTZ DEFAULT NULL,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  -- Metadata
  created_by UUID REFERENCES express_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wh_orders_client ON warehouse_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_wh_orders_type ON warehouse_orders(order_type);
CREATE INDEX IF NOT EXISTS idx_wh_orders_status ON warehouse_orders(status);

-- Auto-generate order number
CREATE SEQUENCE IF NOT EXISTS warehouse_order_seq START 1;

CREATE OR REPLACE FUNCTION generate_warehouse_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_type = 'inbound' THEN
    NEW.order_number := 'WH-IN-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('warehouse_order_seq')::TEXT, 4, '0');
  ELSIF NEW.order_type = 'outbound' THEN
    NEW.order_number := 'WH-OUT-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('warehouse_order_seq')::TEXT, 4, '0');
  ELSIF NEW.order_type = 'transfer' THEN
    NEW.order_number := 'WH-TR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('warehouse_order_seq')::TEXT, 4, '0');
  ELSE
    NEW.order_number := 'WH-RT-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('warehouse_order_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_wh_order_number'
  ) THEN
    CREATE TRIGGER trg_wh_order_number
    BEFORE INSERT ON warehouse_orders
    FOR EACH ROW
    WHEN (NEW.order_number IS NULL)
    EXECUTE FUNCTION generate_warehouse_order_number();
  END IF;
END $$;

-- ═══════════════════════════════════════════════
-- Warehouse Stock Movements (audit trail)
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS warehouse_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES warehouse_inventory(id),
  order_id UUID REFERENCES warehouse_orders(id) DEFAULT NULL,
  movement_type VARCHAR(20) NOT NULL
    CHECK (movement_type IN ('receive', 'ship', 'adjust', 'reserve', 'unreserve', 'return', 'count')),
  quantity_change INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reference TEXT DEFAULT NULL,
  performed_by UUID REFERENCES express_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wh_movements_inventory ON warehouse_stock_movements(inventory_id);
CREATE INDEX IF NOT EXISTS idx_wh_movements_order ON warehouse_stock_movements(order_id);

-- ═══════════════════════════════════════════════
-- Warehouse Rates (admin-configurable pricing)
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS warehouse_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_name VARCHAR(100) NOT NULL,
  rate_category VARCHAR(30) NOT NULL
    CHECK (rate_category IN ('storage', 'handling', 'pick_pack', 'value_added', 'special')),
  description TEXT DEFAULT NULL,
  -- Pricing
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit_type VARCHAR(20) NOT NULL DEFAULT 'per_unit'
    CHECK (unit_type IN ('per_unit', 'per_kg', 'per_cbm', 'per_pallet', 'per_hour', 'per_order', 'flat')),
  currency VARCHAR(3) DEFAULT 'SGD',
  -- Tier pricing (optional volume discounts)
  tier_pricing JSONB DEFAULT NULL,
  -- tier_pricing format: [{ min_qty, max_qty, unit_price }]
  -- Validity
  min_order_value DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  -- Metadata
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wh_rates_category ON warehouse_rates(rate_category);
CREATE INDEX IF NOT EXISTS idx_wh_rates_status ON warehouse_rates(status);

-- Pre-seed default warehouse rates
INSERT INTO warehouse_rates (rate_name, rate_category, description, unit_price, unit_type, sort_order) VALUES
  ('Standard Storage', 'storage', 'Per pallet per month', 35.00, 'per_pallet', 1),
  ('Racked Storage', 'storage', 'Per shelf slot per month', 15.00, 'per_unit', 2),
  ('Cold Storage', 'storage', 'Per pallet per month (temperature controlled)', 65.00, 'per_pallet', 3),
  ('Inbound Handling', 'handling', 'Per carton received and put away', 1.50, 'per_unit', 10),
  ('Outbound Handling', 'handling', 'Per carton picked and staged', 1.50, 'per_unit', 11),
  ('Pallet Handling', 'handling', 'Per pallet load/unload', 8.00, 'per_pallet', 12),
  ('Standard Pick & Pack', 'pick_pack', 'Per order picked and packed', 3.00, 'per_order', 20),
  ('Per Item Pick', 'pick_pack', 'Additional items beyond first', 0.50, 'per_unit', 21),
  ('Gift Wrapping', 'pick_pack', 'Per item gift wrap service', 2.00, 'per_unit', 22),
  ('Labelling', 'value_added', 'Per item labelling/stickering', 0.30, 'per_unit', 30),
  ('Kitting/Assembly', 'value_added', 'Per kit assembled', 5.00, 'per_unit', 31),
  ('Photos / Quality Check', 'value_added', 'Per item photographed and inspected', 1.00, 'per_unit', 32),
  ('Forklift Usage', 'special', 'Per hour forklift operation', 25.00, 'per_hour', 40),
  ('After-hours Access', 'special', 'Surcharge for access outside business hours', 50.00, 'flat', 41)
ON CONFLICT DO NOTHING;
