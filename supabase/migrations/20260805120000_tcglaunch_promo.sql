-- TCGLAUNCH promo code for launch event: $10 off, min $15, new customers, 100 uses, 21 days
INSERT INTO promo_codes (code, discount_type, discount_value, max_discount, min_order_amount, usage_limit, per_user_limit, valid_from, valid_until, is_active, new_customers_only, description)
VALUES
  ('TCGLAUNCH', 'fixed', 10, 10.00, 15.00, 100, 1, NOW(), NOW() + interval '21 days', true, true, 'Launch event: $10 off first delivery (min $15)')
ON CONFLICT (code) DO NOTHING;
