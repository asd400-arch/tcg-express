-- ============================================================
-- RLS Policies for TCG Express
-- Run in Supabase SQL Editor AFTER enabling RLS on each table
-- ============================================================

-- 1. Enable RLS on all tables
ALTER TABLE express_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE express_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE express_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE express_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE express_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE express_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE express_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE express_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- express_users: SELECT only, no password_hash exposure via anon
-- All writes go through API routes with service role key
-- ============================================================
CREATE POLICY "users_select" ON express_users
  FOR SELECT USING (true);

-- Revoke password_hash from anon role (column-level security)
REVOKE ALL ON express_users FROM anon;
GRANT SELECT (id, email, role, contact_name, phone, company_name, vehicle_type, vehicle_plate, license_number, driver_status, driver_rating, total_deliveries, is_active, is_verified, created_at) ON express_users TO anon;

-- ============================================================
-- express_jobs: SELECT and INSERT for anon, UPDATE for status changes
-- DELETE blocked
-- ============================================================
CREATE POLICY "jobs_select" ON express_jobs
  FOR SELECT USING (true);

CREATE POLICY "jobs_insert" ON express_jobs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "jobs_update" ON express_jobs
  FOR UPDATE USING (true);

-- ============================================================
-- express_bids: SELECT and INSERT allowed, UPDATE for status
-- ============================================================
CREATE POLICY "bids_select" ON express_bids
  FOR SELECT USING (true);

CREATE POLICY "bids_insert" ON express_bids
  FOR INSERT WITH CHECK (true);

CREATE POLICY "bids_update" ON express_bids
  FOR UPDATE USING (true);

-- ============================================================
-- express_messages: SELECT and INSERT allowed
-- ============================================================
CREATE POLICY "messages_select" ON express_messages
  FOR SELECT USING (true);

CREATE POLICY "messages_insert" ON express_messages
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- express_locations: SELECT and INSERT/UPDATE for tracking
-- ============================================================
CREATE POLICY "locations_select" ON express_locations
  FOR SELECT USING (true);

CREATE POLICY "locations_insert" ON express_locations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "locations_update" ON express_locations
  FOR UPDATE USING (true);

-- ============================================================
-- express_notifications: SELECT and INSERT
-- ============================================================
CREATE POLICY "notifications_select" ON express_notifications
  FOR SELECT USING (true);

CREATE POLICY "notifications_insert" ON express_notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "notifications_update" ON express_notifications
  FOR UPDATE USING (true);

-- ============================================================
-- express_transactions: SELECT and INSERT only (no UPDATE/DELETE)
-- ============================================================
CREATE POLICY "transactions_select" ON express_transactions
  FOR SELECT USING (true);

CREATE POLICY "transactions_insert" ON express_transactions
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- express_settings: SELECT only for anon
-- Writes go through API route with service role key
-- ============================================================
CREATE POLICY "settings_select" ON express_settings
  FOR SELECT USING (true);
