-- ============================================================
-- TCG Express — Beta Test Seed Data
-- Run in Supabase SQL Editor (single transaction)
-- ============================================================
-- Password for ALL accounts: Beta2026!
-- bcrypt hash generated with cost factor 10
-- ============================================================
-- CONFIRMED COLUMNS from base express_users table:
--   id, email, password_hash, role, contact_name, phone,
--   company_name, vehicle_type, vehicle_plate, license_number,
--   driver_status, driver_rating, total_deliveries,
--   is_active, is_verified, created_at, updated_at
-- ============================================================
-- NOTE: Wallets are auto-created by trg_create_wallet_on_user_insert
--       trigger, so we UPDATE balance after user inserts.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. BETA USER ACCOUNTS
-- ============================================================

-- Admin account
INSERT INTO express_users (
  id, email, password_hash, role, contact_name, phone,
  company_name, is_active, is_verified, created_at, updated_at
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'beta-admin@techchainglobal.com',
  '$2b$10$IX3D5GzSlCJtz4cXptkNbO1GJLUH.SPTyj4yhqbGrdUk9rTRjCuz6',
  'admin',
  'Beta Admin',
  '+65 9000 0001',
  'TCG Express Pte Ltd',
  true, true, now(), now()
);

-- Customer 1
INSERT INTO express_users (
  id, email, password_hash, role, contact_name, phone,
  company_name, is_active, is_verified, created_at, updated_at
) VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'beta-customer1@techchainglobal.com',
  '$2b$10$IX3D5GzSlCJtz4cXptkNbO1GJLUH.SPTyj4yhqbGrdUk9rTRjCuz6',
  'client',
  'Beta Customer One',
  '+65 9100 0001',
  'Beta Corp Alpha',
  true, true, now(), now()
);

-- Customer 2
INSERT INTO express_users (
  id, email, password_hash, role, contact_name, phone,
  company_name, is_active, is_verified, created_at, updated_at
) VALUES (
  'b0000000-0000-0000-0000-000000000002',
  'beta-customer2@techchainglobal.com',
  '$2b$10$IX3D5GzSlCJtz4cXptkNbO1GJLUH.SPTyj4yhqbGrdUk9rTRjCuz6',
  'client',
  'Beta Customer Two',
  '+65 9100 0002',
  'Beta Corp Bravo',
  true, true, now(), now()
);

-- Customer 3
INSERT INTO express_users (
  id, email, password_hash, role, contact_name, phone,
  company_name, is_active, is_verified, created_at, updated_at
) VALUES (
  'b0000000-0000-0000-0000-000000000003',
  'beta-customer3@techchainglobal.com',
  '$2b$10$IX3D5GzSlCJtz4cXptkNbO1GJLUH.SPTyj4yhqbGrdUk9rTRjCuz6',
  'client',
  'Beta Customer Three',
  '+65 9100 0003',
  'Beta Corp Charlie',
  true, true, now(), now()
);

-- Driver 1 — Motorcycle
INSERT INTO express_users (
  id, email, password_hash, role, contact_name, phone,
  vehicle_type, vehicle_plate, license_number,
  driver_status, driver_rating, total_deliveries,
  is_active, is_verified, created_at, updated_at
) VALUES (
  'c0000000-0000-0000-0000-000000000001',
  'beta-driver1@techchainglobal.com',
  '$2b$10$IX3D5GzSlCJtz4cXptkNbO1GJLUH.SPTyj4yhqbGrdUk9rTRjCuz6',
  'driver',
  'Beta Driver Moto',
  '+65 9200 0001',
  'motorcycle',
  'FBK1234A',
  'S1234567A',
  'approved', 4.80, 0,
  true, true, now(), now()
);

-- Driver 2 — Van (EV — will be tagged once ev-green-points.sql migration is applied)
INSERT INTO express_users (
  id, email, password_hash, role, contact_name, phone,
  vehicle_type, vehicle_plate, license_number,
  driver_status, driver_rating, total_deliveries,
  is_active, is_verified, created_at, updated_at
) VALUES (
  'c0000000-0000-0000-0000-000000000002',
  'beta-driver2@techchainglobal.com',
  '$2b$10$IX3D5GzSlCJtz4cXptkNbO1GJLUH.SPTyj4yhqbGrdUk9rTRjCuz6',
  'driver',
  'Beta Driver EV Van',
  '+65 9200 0002',
  'van',
  'SBG5678B',
  'S2345678B',
  'approved', 4.90, 0,
  true, true, now(), now()
);

-- Driver 3 — 14ft Lorry
INSERT INTO express_users (
  id, email, password_hash, role, contact_name, phone,
  vehicle_type, vehicle_plate, license_number,
  driver_status, driver_rating, total_deliveries,
  is_active, is_verified, created_at, updated_at
) VALUES (
  'c0000000-0000-0000-0000-000000000003',
  'beta-driver3@techchainglobal.com',
  '$2b$10$IX3D5GzSlCJtz4cXptkNbO1GJLUH.SPTyj4yhqbGrdUk9rTRjCuz6',
  'driver',
  'Beta Driver 14ft Lorry',
  '+65 9200 0003',
  'lorry',
  'GBC9012C',
  'S3456789C',
  'approved', 4.70, 0,
  true, true, now(), now()
);


-- ============================================================
-- 2. WALLETS — fund via UPDATE (trigger auto-created them above)
-- ============================================================

-- Customer wallets → $500 each
UPDATE wallets SET balance = 500.00, updated_at = now()
WHERE user_id IN (
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003'
);

-- Driver wallets → $100 each
UPDATE wallets SET balance = 100.00, updated_at = now()
WHERE user_id IN (
  'c0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  'c0000000-0000-0000-0000-000000000003'
);


-- ============================================================
-- 3. WALLET TRANSACTIONS — seed top-up audit trail
-- ============================================================

-- Customer top-ups ($500 each)
INSERT INTO wallet_transactions (
  id, wallet_id, user_id, type, amount, direction,
  balance_before, balance_after, description, status, created_at, completed_at
)
SELECT
  gen_random_uuid(),
  w.id,
  w.user_id,
  'top_up', 500.00, 'credit',
  0.00, 500.00,
  'Beta seed funding', 'completed', now(), now()
FROM wallets w
WHERE w.user_id IN (
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003'
);

-- Driver top-ups ($100 each)
INSERT INTO wallet_transactions (
  id, wallet_id, user_id, type, amount, direction,
  balance_before, balance_after, description, status, created_at, completed_at
)
SELECT
  gen_random_uuid(),
  w.id,
  w.user_id,
  'top_up', 100.00, 'credit',
  0.00, 100.00,
  'Beta seed funding', 'completed', now(), now()
FROM wallets w
WHERE w.user_id IN (
  'c0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  'c0000000-0000-0000-0000-000000000003'
);


-- ============================================================
-- 4. PROMO CODE — BETA2026 (20% off, max $50, 90 days)
-- ============================================================

INSERT INTO promo_codes (
  id, code, description, discount_type, discount_value,
  max_discount, min_order_amount, usage_limit, usage_count,
  per_user_limit, valid_from, valid_until,
  applicable_job_types, applicable_vehicle_modes,
  is_active, created_at
) VALUES (
  'd0000000-0000-0000-0000-000000000001',
  'BETA2026',
  '20% off for beta testers (max $50 discount)',
  'percentage', 20.00,
  50.00, 0.00, 500, 0,
  3, now(), now() + interval '90 days',
  ARRAY['spot', 'regular'],
  ARRAY['motorcycle', 'car', 'mpv', 'van', 'lorry', 'refrigerated'],
  true, now()
);


-- ============================================================
-- 5. NOTIFICATIONS — welcome messages
-- ============================================================

INSERT INTO express_notifications (id, user_id, type, title, body, is_read, created_at)
VALUES
  -- Customers
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'system',
   'Welcome to Beta!', 'Your account is funded with $500. Use code BETA2026 for 20% off your first 3 deliveries!', false, now()),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000002', 'system',
   'Welcome to Beta!', 'Your account is funded with $500. Use code BETA2026 for 20% off your first 3 deliveries!', false, now()),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000003', 'system',
   'Welcome to Beta!', 'Your account is funded with $500. Use code BETA2026 for 20% off your first 3 deliveries!', false, now()),
  -- Drivers
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001', 'system',
   'Welcome to Beta!', 'Your driver account is approved and funded with $100. Start accepting jobs now!', false, now()),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002', 'system',
   'Welcome to Beta!', 'Your EV driver account is approved and funded with $100. Enjoy reduced 10% commission!', false, now()),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000003', 'system',
   'Welcome to Beta!', 'Your driver account is approved and funded with $100. Start accepting jobs now!', false, now());


-- ============================================================
-- 6. (OPTIONAL) Tag Driver 2 as EV — only if migrations applied
-- ============================================================
-- Run AFTER applying sql/ev-green-points.sql:
--   UPDATE express_users
--   SET is_ev_vehicle = true, ev_vehicle_type = 'BYD eVan'
--   WHERE id = 'c0000000-0000-0000-0000-000000000002';


COMMIT;


-- ============================================================
-- QUICK REFERENCE
-- ============================================================
--
-- +-----------------------------------------+----------+---------+-----------+
-- | Email                                   | Role     | Wallet  | Pass      |
-- +-----------------------------------------+----------+---------+-----------+
-- | beta-admin@techchainglobal.com          | admin    |   $0    | Beta2026! |
-- | beta-customer1@techchainglobal.com      | client   | $500    | Beta2026! |
-- | beta-customer2@techchainglobal.com      | client   | $500    | Beta2026! |
-- | beta-customer3@techchainglobal.com      | client   | $500    | Beta2026! |
-- | beta-driver1@techchainglobal.com        | driver   | $100    | Beta2026! |
-- | beta-driver2@techchainglobal.com        | driver   | $100    | Beta2026! |
-- | beta-driver3@techchainglobal.com        | driver   | $100    | Beta2026! |
-- +-----------------------------------------+----------+---------+-----------+
--
-- Driver vehicles:
--   Driver 1: Motorcycle (FBK1234A)
--   Driver 2: Van (SBG5678B) — tag as EV after running ev-green-points.sql
--   Driver 3: 14ft Lorry (GBC9012C)
--
-- Promo: BETA2026 — 20% off, max $50, 3 uses/user, 90 days
--
-- TO UNDO: Run the rollback script below
-- ============================================================


-- ============================================================
-- ROLLBACK (run separately if needed)
-- ============================================================
-- BEGIN;
-- DELETE FROM express_notifications WHERE user_id IN (
--   'b0000000-0000-0000-0000-000000000001',
--   'b0000000-0000-0000-0000-000000000002',
--   'b0000000-0000-0000-0000-000000000003',
--   'c0000000-0000-0000-0000-000000000001',
--   'c0000000-0000-0000-0000-000000000002',
--   'c0000000-0000-0000-0000-000000000003'
-- );
-- DELETE FROM promo_codes WHERE code = 'BETA2026';
-- DELETE FROM wallet_transactions WHERE user_id IN (
--   'b0000000-0000-0000-0000-000000000001',
--   'b0000000-0000-0000-0000-000000000002',
--   'b0000000-0000-0000-0000-000000000003',
--   'c0000000-0000-0000-0000-000000000001',
--   'c0000000-0000-0000-0000-000000000002',
--   'c0000000-0000-0000-0000-000000000003'
-- );
-- DELETE FROM wallets WHERE user_id IN (
--   'a0000000-0000-0000-0000-000000000001',
--   'b0000000-0000-0000-0000-000000000001',
--   'b0000000-0000-0000-0000-000000000002',
--   'b0000000-0000-0000-0000-000000000003',
--   'c0000000-0000-0000-0000-000000000001',
--   'c0000000-0000-0000-0000-000000000002',
--   'c0000000-0000-0000-0000-000000000003'
-- );
-- DELETE FROM express_users WHERE email LIKE 'beta-%@techchainglobal.com';
-- COMMIT;
