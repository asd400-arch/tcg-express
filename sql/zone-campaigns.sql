-- ============================================================
-- Zone Campaigns — offline flyer campaign (SIMLIM / TAISENG / JURONG / CBP / UBI)
-- Verified against live schema on 2026-08-14:
--   wallets.bonus_balance          EXISTS
--   promo_codes.new_customers_only EXISTS
--   promo_codes.owner_user_id      MISSING -> added here
--   express_users.zone_campaign_code MISSING -> added here
--   function wallet_credit          EXISTS
--   express_jobs.coupon_id          EXISTS
-- Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Column additions
-- ------------------------------------------------------------
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES express_users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_promo_codes_owner ON promo_codes(owner_user_id);

ALTER TABLE express_users
  ADD COLUMN IF NOT EXISTS zone_campaign_code TEXT;

-- ------------------------------------------------------------
-- 1. Campaign tables
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zone_campaigns (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  signup_bonus        NUMERIC(10,2) NOT NULL DEFAULT 15.00,
  voucher_value       NUMERIC(10,2) NOT NULL DEFAULT 5.00,
  voucher_count       INTEGER       NOT NULL DEFAULT 10,
  voucher_min_order   NUMERIC(10,2) NOT NULL DEFAULT 15.00,
  voucher_valid_days  INTEGER       NOT NULL DEFAULT 90,
  global_cap          INTEGER       NOT NULL DEFAULT 400,
  claimed_count       INTEGER       NOT NULL DEFAULT 0,
  is_active           BOOLEAN       NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS zone_campaign_zones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES zone_campaigns(id) ON DELETE CASCADE,
  zone_key      TEXT NOT NULL,                 -- SIMLIM
  zone_name     TEXT NOT NULL,                 -- Sim Lim Square
  promo_code    TEXT NOT NULL,                 -- SIMLIM15 (typed by hand)
  ref_code      TEXT NOT NULL,                 -- SIMLIM   (?ref= in QR)
  zone_cap      INTEGER NOT NULL DEFAULT 200,
  claimed_count INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, zone_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_zcz_promo_code ON zone_campaign_zones(upper(promo_code));
CREATE UNIQUE INDEX IF NOT EXISTS idx_zcz_ref_code   ON zone_campaign_zones(upper(ref_code));

CREATE TABLE IF NOT EXISTS zone_campaign_redemptions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id               UUID NOT NULL REFERENCES zone_campaigns(id) ON DELETE CASCADE,
  zone_id                   UUID NOT NULL REFERENCES zone_campaign_zones(id) ON DELETE CASCADE,
  user_id                   UUID NOT NULL REFERENCES express_users(id) ON DELETE CASCADE,
  phone_normalized          TEXT NOT NULL,
  signup_bonus_amount       NUMERIC(10,2) NOT NULL,
  signup_bonus_credited_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_delivery_job_id     UUID,
  vouchers_issued_at        TIMESTAMPTZ,
  voucher_promo_code_id     UUID REFERENCES promo_codes(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id),
  UNIQUE (campaign_id, phone_normalized)
);

CREATE INDEX IF NOT EXISTS idx_zcr_user ON zone_campaign_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_zcr_pending_vouchers
  ON zone_campaign_redemptions(user_id) WHERE vouchers_issued_at IS NULL;

-- ------------------------------------------------------------
-- 2. Phone normalization (digits only, last 8 = SG local number)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION normalize_sg_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_phone IS NULL THEN NULL
    WHEN length(regexp_replace(p_phone, '\D', '', 'g')) >= 8
      THEN right(regexp_replace(p_phone, '\D', '', 'g'), 8)
    ELSE regexp_replace(p_phone, '\D', '', 'g')
  END;
$$;

-- ------------------------------------------------------------
-- 3. Atomic bonus credit (balance AND bonus_balance in one statement)
--    NOTE: wallet_credit() only moves `balance`. Bonus credits must NOT be
--    withdrawable, so bonus_balance is raised by the same amount here,
--    atomically — never read-modify-write from JS.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION wallet_credit_bonus(
  p_user_id     UUID,
  p_amount      NUMERIC,
  p_description TEXT,
  p_metadata    JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wallet_id UUID;
  v_before    NUMERIC;
  v_after     NUMERIC;
  v_txn_id    UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'wallet_credit_bonus: amount must be positive';
  END IF;

  -- Create wallet on demand, then lock it
  INSERT INTO wallets (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT id, balance INTO v_wallet_id, v_before
  FROM wallets WHERE user_id = p_user_id FOR UPDATE;

  UPDATE wallets
     SET balance       = balance + p_amount,
         bonus_balance = COALESCE(bonus_balance, 0) + p_amount,
         updated_at    = now()
   WHERE id = v_wallet_id
   RETURNING balance INTO v_after;

  INSERT INTO wallet_transactions (
    wallet_id, user_id, type, amount, direction,
    balance_before, balance_after, description, metadata
  ) VALUES (
    v_wallet_id, p_user_id, 'bonus', p_amount, 'credit',
    v_before, v_after, p_description,
    p_metadata || jsonb_build_object('non_withdrawable', true)
  ) RETURNING id INTO v_txn_id;

  RETURN v_txn_id;
END;
$$;

-- ------------------------------------------------------------
-- 4. Atomic claim — caps enforced under row locks
--    Returns: jsonb { ok, reason, zone_key, amount }
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_zone_campaign(
  p_user_id UUID,
  p_code    TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_zone     zone_campaign_zones%ROWTYPE;
  v_camp     zone_campaigns%ROWTYPE;
  v_user     express_users%ROWTYPE;
  v_phone    TEXT;
  v_jobs     INTEGER;
  v_amount   NUMERIC;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_code');
  END IF;

  SELECT * INTO v_zone FROM zone_campaign_zones
   WHERE upper(promo_code) = upper(btrim(p_code))
      OR upper(ref_code)   = upper(btrim(p_code))
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  -- Lock campaign then zone (consistent order avoids deadlock)
  SELECT * INTO v_camp FROM zone_campaigns WHERE id = v_zone.campaign_id FOR UPDATE;
  SELECT * INTO v_zone FROM zone_campaign_zones WHERE id = v_zone.id FOR UPDATE;

  IF NOT v_camp.is_active THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'campaign_ended');
  END IF;
  IF NOT v_zone.is_active THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'zone_ended');
  END IF;
  IF v_camp.claimed_count >= v_camp.global_cap THEN
    UPDATE zone_campaigns SET is_active = false WHERE id = v_camp.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'global_cap_reached');
  END IF;
  IF v_zone.claimed_count >= v_zone.zone_cap THEN
    UPDATE zone_campaign_zones SET is_active = false WHERE id = v_zone.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'zone_cap_reached');
  END IF;

  SELECT * INTO v_user FROM express_users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_user');
  END IF;

  -- login/route.js does NOT check is_verified, so enforce it here.
  -- Leave zone_campaign_code in place so it retries after verification.
  IF COALESCE(v_user.is_verified, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_verified');
  END IF;

  IF v_user.role <> 'client' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_client');
  END IF;

  -- New customers only
  SELECT count(*) INTO v_jobs FROM express_jobs
   WHERE client_id = p_user_id AND status <> 'cancelled';
  IF v_jobs > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_new_customer');
  END IF;

  v_phone := normalize_sg_phone(v_user.phone);
  IF v_phone IS NULL OR length(v_phone) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_phone');
  END IF;

  IF EXISTS (SELECT 1 FROM zone_campaign_redemptions
              WHERE campaign_id = v_camp.id
                AND (user_id = p_user_id OR phone_normalized = v_phone)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
  END IF;

  v_amount := v_camp.signup_bonus;

  INSERT INTO zone_campaign_redemptions (
    campaign_id, zone_id, user_id, phone_normalized, signup_bonus_amount
  ) VALUES (v_camp.id, v_zone.id, p_user_id, v_phone, v_amount);

  PERFORM wallet_credit_bonus(
    p_user_id, v_amount,
    format('Zone campaign signup bonus (%s)', v_zone.zone_key),
    jsonb_build_object('campaign', v_camp.name, 'zone', v_zone.zone_key)
  );

  UPDATE zone_campaigns
     SET claimed_count = claimed_count + 1,
         is_active     = (claimed_count + 1) < global_cap
   WHERE id = v_camp.id;

  UPDATE zone_campaign_zones
     SET claimed_count = claimed_count + 1,
         is_active     = (claimed_count + 1) < zone_cap
   WHERE id = v_zone.id;

  RETURN jsonb_build_object('ok', true, 'zone_key', v_zone.zone_key, 'amount', v_amount);
END;
$$;

-- ------------------------------------------------------------
-- 5. Issue vouchers after first completed delivery
--    Creates ONE owner-scoped promo_code with per_user_limit = voucher_count.
--    Reuses the existing promo pipeline (validate / available / coupon_id).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION issue_zone_campaign_vouchers(
  p_user_id UUID,
  p_job_id  UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_red    zone_campaign_redemptions%ROWTYPE;
  v_camp   zone_campaigns%ROWTYPE;
  v_zone   zone_campaign_zones%ROWTYPE;
  v_code   TEXT;
  v_id     UUID;
BEGIN
  SELECT * INTO v_red FROM zone_campaign_redemptions
   WHERE user_id = p_user_id AND vouchers_issued_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_pending_redemption');
  END IF;

  SELECT * INTO v_camp FROM zone_campaigns WHERE id = v_red.campaign_id;
  SELECT * INTO v_zone FROM zone_campaign_zones WHERE id = v_red.zone_id;

  LOOP
    v_code := 'ZC5-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM promo_codes WHERE code = v_code);
  END LOOP;

  INSERT INTO promo_codes (
    code, description, discount_type, discount_value,
    min_order_amount, usage_limit, per_user_limit,
    valid_from, valid_until, is_active, new_customers_only, owner_user_id
  ) VALUES (
    v_code,
    format('%s reward: %s x $%s off', v_zone.zone_key, v_camp.voucher_count, v_camp.voucher_value),
    'fixed', v_camp.voucher_value,
    v_camp.voucher_min_order, v_camp.voucher_count, v_camp.voucher_count,
    now(), now() + (v_camp.voucher_valid_days || ' days')::interval,
    true, false, p_user_id
  ) RETURNING id INTO v_id;

  UPDATE zone_campaign_redemptions
     SET vouchers_issued_at   = now(),
         first_delivery_job_id = p_job_id,
         voucher_promo_code_id = v_id
   WHERE id = v_red.id;

  RETURN jsonb_build_object('ok', true, 'code', v_code,
                            'count', v_camp.voucher_count,
                            'value', v_camp.voucher_value);
END;
$$;

-- ------------------------------------------------------------
-- 6. Seed — campaign + 5 zones. is_active = FALSE until flyers go out.
-- ------------------------------------------------------------
INSERT INTO zone_campaigns (name, signup_bonus, voucher_value, voucher_count,
                            voucher_min_order, voucher_valid_days, global_cap, is_active)
SELECT 'Offline Zone Launch 2026', 15.00, 5.00, 10, 15.00, 90, 400, false
WHERE NOT EXISTS (SELECT 1 FROM zone_campaigns WHERE name = 'Offline Zone Launch 2026');

INSERT INTO zone_campaign_zones (campaign_id, zone_key, zone_name, promo_code, ref_code, zone_cap, is_active)
SELECT c.id, z.zone_key, z.zone_name, z.promo_code, z.ref_code, 200, true
FROM zone_campaigns c
CROSS JOIN (VALUES
  ('SIMLIM',  'Sim Lim Square',       'SIMLIM15',  'SIMLIM'),
  ('TAISENG', 'Tai Seng',             'TAISENG15', 'TAISENG'),
  ('JURONG',  'Jurong',               'JURONG15',  'JURONG'),
  ('CBP',     'Changi Business Park', 'CBP15',     'CBP'),
  ('UBI',     'Ubi',                  'UBI15',     'UBI')
) AS z(zone_key, zone_name, promo_code, ref_code)
WHERE c.name = 'Offline Zone Launch 2026'
  AND NOT EXISTS (
    SELECT 1 FROM zone_campaign_zones x
     WHERE x.campaign_id = c.id AND x.zone_key = z.zone_key
  );

-- ------------------------------------------------------------
-- 7. RLS — service role only (all access goes through server API)
-- ------------------------------------------------------------
ALTER TABLE zone_campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_campaign_zones       ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_campaign_redemptions ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 8. Verification
-- ------------------------------------------------------------
SELECT z.zone_key, z.promo_code, z.ref_code, z.zone_cap, z.claimed_count, z.is_active,
       c.global_cap, c.claimed_count AS campaign_claimed, c.is_active AS campaign_active
FROM zone_campaign_zones z
JOIN zone_campaigns c ON c.id = z.campaign_id
ORDER BY z.zone_key;
