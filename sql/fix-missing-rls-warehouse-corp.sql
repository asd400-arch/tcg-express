-- ============================================================
-- FIX: Enable RLS on 7 unprotected tables
-- Tables: corp_premium_requests, corp_premium_bids,
--         warehouse_inventory, warehouse_orders,
--         warehouse_stock_movements, warehouse_rates, warehouses
--
-- Run this in Supabase SQL Editor BEFORE launch.
-- Date: 2026-02-25
-- ============================================================

-- ============================================================
-- 1. CORP_PREMIUM_REQUESTS
-- Clients see their own RFQs; drivers see open/bidding RFQs
-- ============================================================

ALTER TABLE corp_premium_requests ENABLE ROW LEVEL SECURITY;

-- Clients see their own requests; drivers see bidding_open requests they could bid on
CREATE POLICY "corp_premium_requests_select_scoped"
  ON corp_premium_requests FOR SELECT
  USING (
    client_id = auth.uid()
    OR awarded_partner_id = auth.uid()
    OR status IN ('bidding_open')
  );

-- Only clients can create their own RFQs
CREATE POLICY "corp_premium_requests_insert_own"
  ON corp_premium_requests FOR INSERT
  WITH CHECK (client_id = auth.uid());

-- Clients can update their own RFQs (e.g. cancel, edit draft)
CREATE POLICY "corp_premium_requests_update_own"
  ON corp_premium_requests FOR UPDATE
  USING (client_id = auth.uid());

-- ============================================================
-- 2. CORP_PREMIUM_BIDS
-- Partners see their own bids; clients see bids on their RFQs
-- ============================================================

ALTER TABLE corp_premium_bids ENABLE ROW LEVEL SECURITY;

-- Partners see their own bids; clients see bids on their requests
CREATE POLICY "corp_premium_bids_select_scoped"
  ON corp_premium_bids FOR SELECT
  USING (
    partner_id = auth.uid()
    OR request_id IN (
      SELECT id FROM corp_premium_requests WHERE client_id = auth.uid()
    )
  );

-- Only partners can create bids (as themselves)
CREATE POLICY "corp_premium_bids_insert_own"
  ON corp_premium_bids FOR INSERT
  WITH CHECK (partner_id = auth.uid());

-- Partners can update their own bids (e.g. withdraw)
CREATE POLICY "corp_premium_bids_update_own"
  ON corp_premium_bids FOR UPDATE
  USING (partner_id = auth.uid());

-- ============================================================
-- 3. WAREHOUSE_INVENTORY
-- Clients see only their own inventory
-- ============================================================

ALTER TABLE warehouse_inventory ENABLE ROW LEVEL SECURITY;

-- Clients see only their own inventory
CREATE POLICY "warehouse_inventory_select_own"
  ON warehouse_inventory FOR SELECT
  USING (client_id = auth.uid());

-- Clients can insert their own inventory items
CREATE POLICY "warehouse_inventory_insert_own"
  ON warehouse_inventory FOR INSERT
  WITH CHECK (client_id = auth.uid());

-- Clients can update their own inventory
CREATE POLICY "warehouse_inventory_update_own"
  ON warehouse_inventory FOR UPDATE
  USING (client_id = auth.uid());

-- ============================================================
-- 4. WAREHOUSE_ORDERS
-- Clients see only their own orders
-- ============================================================

ALTER TABLE warehouse_orders ENABLE ROW LEVEL SECURITY;

-- Clients see only their own orders
CREATE POLICY "warehouse_orders_select_own"
  ON warehouse_orders FOR SELECT
  USING (client_id = auth.uid());

-- Clients can create their own orders
CREATE POLICY "warehouse_orders_insert_own"
  ON warehouse_orders FOR INSERT
  WITH CHECK (client_id = auth.uid());

-- Clients can update their own orders (e.g. cancel draft)
CREATE POLICY "warehouse_orders_update_own"
  ON warehouse_orders FOR UPDATE
  USING (client_id = auth.uid());

-- ============================================================
-- 5. WAREHOUSE_STOCK_MOVEMENTS
-- Users see movements for their own inventory items only
-- ============================================================

ALTER TABLE warehouse_stock_movements ENABLE ROW LEVEL SECURITY;

-- Users see movements for inventory they own
CREATE POLICY "warehouse_stock_movements_select_own"
  ON warehouse_stock_movements FOR SELECT
  USING (
    inventory_id IN (
      SELECT id FROM warehouse_inventory WHERE client_id = auth.uid()
    )
  );

-- No INSERT/UPDATE for authenticated role (service role only)
-- Stock movements are created by warehouse operations via API

-- ============================================================
-- 6. WAREHOUSE_RATES
-- Public read (pricing info); write is admin-only (service role)
-- ============================================================

ALTER TABLE warehouse_rates ENABLE ROW LEVEL SECURITY;

-- Anyone can read active rates (public pricing)
CREATE POLICY "warehouse_rates_select_active"
  ON warehouse_rates FOR SELECT
  USING (status = 'active');

-- No INSERT/UPDATE/DELETE for authenticated role
-- Rate management is admin-only via service role

-- ============================================================
-- 7. WAREHOUSES (if table exists)
-- Public read for warehouse locations; admin-only write
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'warehouses') THEN
    EXECUTE 'ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY';

    -- Public read for warehouse location info
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'warehouses' AND policyname = 'warehouses_select_all') THEN
      EXECUTE 'CREATE POLICY "warehouses_select_all" ON warehouses FOR SELECT USING (true)';
    END IF;
  END IF;
END $$;

-- ============================================================
-- VERIFICATION QUERY
-- Run this after applying the migration to confirm all tables
-- have RLS enabled. Every row should show relforcerowsecurity = true.
-- ============================================================

-- SELECT
--   c.relname AS table_name,
--   c.relrowsecurity AS rls_enabled,
--   c.relforcerowsecurity AS rls_forced
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND c.relkind = 'r'
--   AND c.relname IN (
--     'express_users', 'express_jobs', 'express_bids', 'express_messages',
--     'express_notifications', 'express_transactions', 'express_settings',
--     'express_disputes', 'express_reviews', 'express_push_subscriptions',
--     'wallets', 'wallet_transactions', 'wallet_topups', 'wallet_withdrawals',
--     'payments', 'promo_codes', 'faq_categories', 'faq_articles',
--     'support_tickets', 'support_messages', 'chatbot_sessions',
--     'green_points_ledger', 'green_points_redemption', 'express_schedules',
--     'express_driver_locations', 'express_support_tickets', 'express_support_messages',
--     'express_promo_banners', 'consolidation_groups', 'contracts',
--     'driver_job_queue', 'regular_schedules', 'service_zones',
--     'processed_webhook_events',
--     'corp_premium_requests', 'corp_premium_bids',
--     'warehouse_inventory', 'warehouse_orders', 'warehouse_stock_movements',
--     'warehouse_rates', 'warehouses'
--   )
-- ORDER BY c.relname;

-- ============================================================
-- POLICY LISTING QUERY
-- Run this to see all active policies per table:
-- ============================================================

-- SELECT
--   schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
