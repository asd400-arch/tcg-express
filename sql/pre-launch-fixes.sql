-- ============================================================
-- Pre-Launch Fixes — run in Supabase SQL Editor
-- Safe to re-run (UPDATE is idempotent, INSERT uses ON CONFLICT)
-- ============================================================

-- [1] Banner deep_link — fix tap navigation
--     Seed data only had web-style `link` paths; the app needs
--     Expo Router paths in `deep_link`.

UPDATE express_promo_banners
SET    deep_link = '/(client)/new-job'
WHERE  link = '/client/jobs/new';

UPDATE express_promo_banners
SET    deep_link = '/(client)/wallet'
WHERE  link = '/client/wallet';

UPDATE express_promo_banners
SET    deep_link = '/(client)/profile'
WHERE  link = '/client/settings';

-- [2] Promo codes — pre-insert for launch-day.sql activation
--     Both start as is_active = false.
--     launch-day.sql will SET is_active = true + valid_from/valid_until.

INSERT INTO promo_codes
  (code, discount_type, discount_value, max_discount, min_order_amount,
   usage_limit, per_user_limit, is_active, new_customers_only, description)
VALUES
  ('FIRSTFREE', 'percentage', 100, 10.00, 0,
   200, 1, false, true,
   'First delivery free (100% off, max $10, new customers only)'),
  ('WELCOME5', 'fixed', 5, 5.00, 15.00,
   1000, 5, false, false,
   '$5 off delivery (min $15, all customers, up to 5 uses)')
ON CONFLICT (code) DO NOTHING;
