-- Voucher system enhancements: add new_customers_only targeting
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS new_customers_only BOOLEAN NOT NULL DEFAULT false;

-- Insert sample vouchers for new customer acquisition
INSERT INTO promo_codes (code, discount_type, discount_value, max_discount, min_order_amount, usage_limit, per_user_limit, valid_from, valid_until, is_active, new_customers_only, description)
VALUES
  ('WELCOME20', 'percentage', 20, 10.00, 20.00, 100, 1, NOW(), NOW() + interval '90 days', true, true, 'Welcome 20% off for new customers (max $10)'),
  ('FIRST5OFF', 'fixed', 5, 5.00, 15.00, 50, 1, NOW(), NOW() + interval '60 days', true, true, '$5 off first delivery'),
  ('TCG10', 'percentage', 10, 8.00, 20.00, 200, 3, NOW(), NOW() + interval '180 days', true, false, '10% off (max $8, up to 3 uses)')
ON CONFLICT (code) DO NOTHING;
