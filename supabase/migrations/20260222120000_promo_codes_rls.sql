-- ============================================================
-- Enable RLS on promo_codes table (security fix)
-- Previously missing — anyone with anon key could read/write
-- ============================================================

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read active, non-expired promo codes
CREATE POLICY "promo_codes_read" ON promo_codes
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND (valid_until IS NULL OR valid_until > NOW())
  );

-- No INSERT/UPDATE/DELETE policies for regular users.
-- Admin manages promo codes via supabaseAdmin (service_role), which bypasses RLS.
