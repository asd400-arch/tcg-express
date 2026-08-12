-- ============================================================
-- TCG Express Launch Day — Promo Code Activation
-- Run on launch day. Requires FIRSTFREE & WELCOME5 to be
-- pre-inserted (is_active = false).
-- ============================================================

-- 1) Deactivate legacy promo codes
UPDATE promo_codes SET is_active = false
WHERE code IN ('FIRSTCUSTOMER', 'TCGLAUNCH');

-- 2) Activate new promo codes with 60-day validity window
UPDATE promo_codes
SET is_active = true,
    valid_from = NOW(),
    valid_until = NOW() + INTERVAL '60 days'
WHERE code IN ('FIRSTFREE', 'WELCOME5');
