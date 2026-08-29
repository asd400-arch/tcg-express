-- ============================================================================
-- RECOVERED SCHEMA — promoters / promoter_bonuses
--
-- These tables exist in the live database but their DDL was never committed.
-- Reconstructed 2026-08-29 from information_schema.columns on the production
-- project (aeaisolmobsvreujofwa).
--
-- ⚠ THIS IS NOT A FULL DUMP. Column names, types, nullability and defaults
--   are accurate. Primary keys, foreign keys, unique constraints, indexes,
--   check constraints, triggers and RLS policies are INFERRED from the API
--   code, not read from the database. Replace this file with a real dump as
--   soon as the Supabase CLI is available:
--
--     npx supabase login
--     npx supabase link --project-ref aeaisolmobsvreujofwa
--     npx supabase db dump --schema public -f supabase/schema.sql
--
--   Until then this file is a safety net, not a source of truth.
-- ============================================================================

-- ── promoters ───────────────────────────────────────────────────────────────
-- Street promoters. hourly_rate defaults to 12.00 and bonus_per_signup to
-- 2.00, which matches the S$12/hour + S$2/sign-up street offer.
CREATE TABLE IF NOT EXISTS promoters (
  id               UUID          NOT NULL DEFAULT gen_random_uuid(),  -- PK (inferred)
  code             TEXT          NOT NULL,                            -- UNIQUE (inferred: API retries on 23505). Format '<zone_key>-P01'
  full_name        TEXT          NOT NULL,
  phone            TEXT          NOT NULL,
  phone_normalized TEXT,
  zone_id          UUID          NOT NULL,                            -- FK -> zone_campaign_zones(id) (inferred)
  hourly_rate      NUMERIC(10,2) NOT NULL DEFAULT 12.00,
  bonus_per_signup NUMERIC(10,2) NOT NULL DEFAULT 2.00,
  daily_bonus_cap  INTEGER       NOT NULL DEFAULT 20,
  is_active        BOOLEAN       NOT NULL DEFAULT true,
  started_at       DATE,
  ended_at         DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── promoter_bonuses ────────────────────────────────────────────────────────
-- Per-sign-up bonus ledger with an approval workflow. status values seen in
-- the admin API: 'pending', 'hold', 'approved', 'rejected'.
CREATE TABLE IF NOT EXISTS promoter_bonuses (
  id            UUID          NOT NULL DEFAULT gen_random_uuid(),     -- PK (inferred)
  promoter_id   UUID          NOT NULL,                               -- FK -> promoters(id) (inferred)
  redemption_id UUID          NOT NULL,                               -- FK -> zone_campaign_redemptions(id) (inferred)
  user_id       UUID          NOT NULL,                               -- FK -> express_users(id), constraint name promoter_bonuses_user_id_fkey
  amount        NUMERIC(10,2) NOT NULL,
  status        TEXT          NOT NULL DEFAULT 'pending',
  hold_reason   TEXT,
  approved_at   TIMESTAMPTZ,
  approved_by   UUID,                                                 -- FK -> express_users(id) (inferred)
  paid_at       TIMESTAMPTZ,
  payout_ref    TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── promoter_summary (view) ─────────────────────────────────────────────────
-- Definition NOT recovered. Columns consumed by app/admin/promoters/page.js:
--   id, code, full_name, phone, zone_id, zone_key, hourly_rate,
--   bonus_per_signup, daily_bonus_cap, is_active,
--   signups_total, bonus_pending, bonus_hold, amount_owed, amount_paid
-- Run this on the live database to capture it, then paste the result here:
--   SELECT pg_get_viewdef('promoter_summary'::regclass, true);
