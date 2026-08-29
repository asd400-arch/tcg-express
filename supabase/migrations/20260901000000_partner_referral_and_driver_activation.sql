-- ============================================================================
-- TCG Express — Referral Partner track + Driver activation bonuses
-- Rewritten 2026-08-29 after inspecting the live schema and the API routes.
--
-- REVIEW BEFORE RUNNING. Creates and alters tables, views and policies.
-- It awards nothing and pays nobody. All awarding stays in API routes.
--
-- WHAT CHANGED FROM THE FIRST DRAFT, AND WHY
--   The first draft invented referral_partners and partner_commissions. That
--   was wrong: a promoter system ALREADY EXISTS in the live database —
--   promoters, promoter_bonuses, the promoter_summary view, and admin routes
--   at /api/admin/promoters and /api/admin/promoters/bonuses, including a
--   pending / hold / approved / rejected review workflow. A commission-only
--   referral partner is simply a promoter with hourly_rate = 0. So this file
--   EXTENDS the existing tables instead of duplicating them, and the admin
--   screens keep working.
--
-- ⚠ SCHEMA DEBT — FIX THIS SEPARATELY
--   The DDL for promoters, promoter_bonuses and promoter_summary is NOT in
--   the repository. Column definitions have been recovered from
--   information_schema into supabase/schema-promoters.sql, but keys,
--   constraints, indexes, triggers and RLS policies are still unknown, and
--   the promoter_summary view definition was never captured. Get a real dump:
--     npx supabase login
--     npx supabase link --project-ref aeaisolmobsvreujofwa
--     npx supabase db dump --schema public -f supabase/schema.sql
-- ============================================================================


-- ============================================================================
-- SECTION 0 — DIAGNOSTICS. Read-only. Run these first, one at a time.
--
-- ⚠ DO NOT USE express_users.total_deliveries. It is a dead column: no API
--   route in the codebase ever writes to it, so it is 0 for every user and
--   tells you nothing. The existing $50 welcome bonus is correct — it counts
--   express_jobs rows with status in ('confirmed','completed'). Count jobs,
--   never the column.
-- ============================================================================

-- 0.1  The real driver funnel, counted from jobs.
--
-- WITH d AS (
--   SELECT u.id, u.driver_status, u.email,
--          COUNT(j.id) FILTER (WHERE j.status IN ('confirmed','completed')) AS done
--   FROM express_users u
--   LEFT JOIN express_jobs j ON j.assigned_driver_id = u.id
--   WHERE u.role = 'driver'
--   GROUP BY u.id, u.driver_status, u.email
-- )
-- SELECT driver_status,
--        COUNT(*)                                    AS drivers,
--        COUNT(*) FILTER (WHERE done = 0)            AS zero_done,
--        COUNT(*) FILTER (WHERE done BETWEEN 1 AND 4) AS one_to_four,
--        COUNT(*) FILTER (WHERE done >= 5)           AS five_plus,
--        COUNT(*) FILTER (WHERE email ILIKE '%beta%'
--                            OR email ILIKE '%test%') AS test_accounts
-- FROM d GROUP BY driver_status ORDER BY drivers DESC;
--
--   driver_status='approved', zero_done  -> 'thank_you_waiting' S$20
--   driver_status='pending'              -> 'verified'          S$20 once approved
--   approved AND zero_done               -> first-delivery S$30 target list

-- 0.2  How much of express_jobs is real. Scott confirms the cancelled jobs
--      are dummy test jobs, so treat the whole table as suspect until this
--      separates seeded rows from genuine ones.
--
-- SELECT j.status,
--        COUNT(*) AS jobs,
--        COUNT(*) FILTER (WHERE cu.email ILIKE '%beta%'
--                            OR cu.email ILIKE '%test%'
--                            OR cu.email ILIKE '%example.com') AS by_test_client
-- FROM express_jobs j
-- LEFT JOIN express_users cu ON cu.id = j.client_id
-- GROUP BY j.status ORDER BY jobs DESC;

-- 0.3  Test and probe rows still in production, 3 days before launch.
--
-- SELECT id, contact_name, company_name, email, role, is_active, created_at
-- FROM express_users
-- WHERE contact_name ILIKE '%test%' OR contact_name ILIKE '%probe%'
--    OR company_name ILIKE '%test%' OR company_name ILIKE '%probe%'
--    OR company_name ILIKE 'ZZ %'   OR email ILIKE '%example.com'
--    OR email ILIKE '%beta%'
-- ORDER BY created_at;

-- 0.4  Documents missing, for drivers stuck at pending.
--
-- SELECT id, contact_name, phone, driver_status,
--        (nric_front_url        IS NULL) AS missing_nric_front,
--        (nric_back_url         IS NULL) AS missing_nric_back,
--        (license_photo_url     IS NULL) AS missing_licence,
--        (vehicle_insurance_url IS NULL) AS missing_insurance,
--        (vehicle_plate         IS NULL) AS missing_plate
-- FROM express_users
-- WHERE role = 'driver' AND driver_status <> 'approved'
-- ORDER BY created_at;

-- 0.5  Sanity check before paying anyone: a driver flagged as having claimed
--      the welcome bonus without five qualifying jobs.
--
-- SELECT u.id, u.contact_name, u.welcome_bonus_claimed,
--        COUNT(j.id) FILTER (WHERE j.status IN ('confirmed','completed')) AS done
-- FROM express_users u
-- LEFT JOIN express_jobs j ON j.assigned_driver_id = u.id
-- WHERE u.role = 'driver' AND u.welcome_bonus_claimed
-- GROUP BY u.id, u.contact_name, u.welcome_bonus_claimed
-- HAVING COUNT(j.id) FILTER (WHERE j.status IN ('confirmed','completed')) < 5;


-- ============================================================================
-- SECTION 1 — EXTEND `promoters` TO CARRY REFERRAL PARTNERS
-- A referral partner is a promoter with partner_type='referral' and
-- hourly_rate = 0. Existing street promoters are unaffected.
-- ============================================================================

ALTER TABLE promoters
  ADD COLUMN IF NOT EXISTS partner_type TEXT NOT NULL DEFAULT 'street',
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS paynow_ref TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES express_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS agreement_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bonus_first_delivery NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT;   -- already exists; this is a no-op

DO $$ BEGIN
  ALTER TABLE promoters ADD CONSTRAINT promoters_partner_type_chk
    CHECK (partner_type IN ('street','referral'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE promoters ADD CONSTRAINT promoters_source_chk
    CHECK (source IN ('driver','promoter','linkedin','telegram','carousell','referral','other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_promoters_partner_type ON promoters(partner_type);
CREATE INDEX IF NOT EXISTS idx_promoters_user         ON promoters(user_id);

COMMENT ON COLUMN promoters.partner_type IS
  'street = hourly + per sign-up. referral = commission only, hourly_rate must be 0.';
COMMENT ON COLUMN promoters.agreement_signed_at IS
  'Referral partners only. Null means no signed agreement — do not pay.';
COMMENT ON COLUMN promoters.user_id IS
  'Set when the partner is also one of our drivers. Used for self-dealing checks.';

-- Approved rates (Option C): sign-up S$20, first delivery S$50.
-- Applied only to referral partners; street promoters keep their own rates.
-- UPDATE promoters
--   SET hourly_rate = 0, bonus_per_signup = 20, bonus_first_delivery = 50
--   WHERE partner_type = 'referral';


-- ============================================================================
-- SECTION 2 — EXTEND `promoter_bonuses` FOR TWO-STAGE PAYOUT
-- Verified live columns (information_schema, 29 Aug 2026):
--   id, promoter_id, redemption_id (NOT NULL), user_id, amount,
--   status (default 'pending'), hold_reason, approved_at, approved_by,
--   paid_at, payout_ref, created_at
-- The approval workflow already does what we need. It lacks only a stage
-- and a clawback window — and redemption_id blocks referral bonuses.
-- ============================================================================

-- paid_at and payout_ref ALREADY EXIST on this table — do not add them again
-- and do not invent a second payment reference column.
ALTER TABLE promoter_bonuses
  ADD COLUMN IF NOT EXISTS stage      TEXT NOT NULL DEFAULT 'signup',
  ADD COLUMN IF NOT EXISTS job_id     UUID,
  ADD COLUMN IF NOT EXISTS uen        TEXT,
  ADD COLUMN IF NOT EXISTS payable_at TIMESTAMPTZ;

-- ⚠ BLOCKER — redemption_id is NOT NULL on promoter_bonuses.
--   It points at a zone campaign redemption, which exists for a street
--   promoter's QR sign-up but NOT for a referral partner's first-delivery
--   bonus. Without this change, inserting a first_delivery bonus fails.
--   Confirm nothing relies on the NOT NULL before running.
ALTER TABLE promoter_bonuses ALTER COLUMN redemption_id DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE promoter_bonuses ADD CONSTRAINT promoter_bonuses_redemption_required_chk
    CHECK (stage = 'first_delivery' OR redemption_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE promoter_bonuses ADD CONSTRAINT promoter_bonuses_stage_chk
    CHECK (stage IN ('signup','first_delivery'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- One payment per stage per referred account.
CREATE UNIQUE INDEX IF NOT EXISTS uq_promoter_bonus_stage
  ON promoter_bonuses(promoter_id, user_id, stage);

CREATE INDEX IF NOT EXISTS idx_promoter_bonus_due
  ON promoter_bonuses(payable_at) WHERE paid_at IS NULL;

COMMENT ON COLUMN promoter_bonuses.payable_at IS
  'Clawback window. Sign-up bonuses become payable 14 days after the account is verified.';


-- ============================================================================
-- SECTION 3 — COMPANY CLAIMS (territory lock)
-- Genuinely new. A partner registers a company BEFORE approaching it, so two
-- partners never chase the same shop and never both bill us.
-- ============================================================================

CREATE TABLE IF NOT EXISTS partner_company_claims (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promoter_id     UUID NOT NULL REFERENCES promoters(id) ON DELETE CASCADE,
  company_name    TEXT NOT NULL,
  uen             TEXT NOT NULL,
  contact_name    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,          -- company line only, never a personal mobile
  claimed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','converted','expired','rejected')),
  rejected_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_claim_active_uen
  ON partner_company_claims(uen) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_partner_claims_promoter ON partner_company_claims(promoter_id);
CREATE INDEX IF NOT EXISTS idx_partner_claims_expires  ON partner_company_claims(expires_at)
  WHERE status = 'active';


-- ============================================================================
-- SECTION 4 — DRIVER ACTIVATION BONUSES
--   'verified'           S$20  new verification, deadline 7 Sep
--   'thank_you_waiting'  S$20  already approved before launch — same money,
--                              different name, paid as a loyalty payment
--   'first_delivery'     S$30  one qualifying job, deadline 14 Sep
-- The existing S$50 welcome bonus at 5 deliveries is untouched and continues
-- to run from processWelcomeBonus() in app/api/jobs/[id]/status/route.js.
-- ============================================================================

CREATE TABLE IF NOT EXISTS driver_activation_bonuses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id    UUID NOT NULL REFERENCES express_users(id) ON DELETE RESTRICT,
  stage        TEXT NOT NULL
                 CHECK (stage IN ('verified','thank_you_waiting','first_delivery')),
  amount       NUMERIC(10,2) NOT NULL,
  job_id       UUID,
  qualified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payable_at   TIMESTAMPTZ NOT NULL,
  paid_at      TIMESTAMPTZ,
  payment_ref  TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','payable','paid','void')),
  void_reason  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 'verified' and 'thank_you_waiting' are mutually exclusive in practice —
-- a driver gets one or the other, never both.
CREATE UNIQUE INDEX IF NOT EXISTS uq_driver_bonus_stage
  ON driver_activation_bonuses(driver_id, stage);

CREATE INDEX IF NOT EXISTS idx_driver_bonus_due
  ON driver_activation_bonuses(payable_at) WHERE status IN ('pending','payable');


-- ============================================================================
-- SECTION 5 — SELF-DEALING WATCHLIST
-- A driver who refers a company through their own partner code and then
-- delivers that company's job sits on both sides. Not automatically fraud,
-- but never pay both bonuses without a human looking.
-- ============================================================================

CREATE OR REPLACE VIEW v_self_dealing_watch AS
SELECT pb.id            AS bonus_id,
       p.code           AS promoter_code,
       p.full_name      AS promoter_name,
       p.user_id        AS promoter_user_id,
       pb.user_id       AS customer_user_id,
       pb.job_id,
       j.assigned_driver_id,
       pb.amount,
       pb.status,
       'partner delivered the job they referred' AS flag
FROM promoter_bonuses pb
JOIN promoters    p ON p.id = pb.promoter_id
JOIN express_jobs j ON j.id = pb.job_id
WHERE pb.stage = 'first_delivery'
  AND p.user_id IS NOT NULL
  AND p.user_id = j.assigned_driver_id
  AND pb.status <> 'rejected';


-- ============================================================================
-- SECTION 6 — PAYOUT AND SPEND VIEWS (read-only)
-- ============================================================================

CREATE OR REPLACE VIEW v_payouts_due AS
SELECT 'partner' AS track, p.code AS ref, p.full_name, p.paynow_ref,
       pb.stage, pb.amount, pb.payable_at, pb.id AS row_id
FROM promoter_bonuses pb
JOIN promoters p ON p.id = pb.promoter_id
WHERE pb.status = 'approved'
  AND pb.paid_at IS NULL
  AND (pb.payable_at IS NULL OR pb.payable_at <= NOW())
  AND p.is_active
  AND (p.partner_type <> 'referral' OR p.agreement_signed_at IS NOT NULL)
UNION ALL
SELECT 'driver', u.referral_code, u.contact_name, u.phone,
       db.stage, db.amount, db.payable_at, db.id
FROM driver_activation_bonuses db
JOIN express_users u ON u.id = db.driver_id
WHERE db.status IN ('pending','payable')
  AND db.payable_at <= NOW();

CREATE OR REPLACE VIEW v_incentive_spend AS
SELECT 'partner_' || stage AS line, COUNT(*) AS rows,
       SUM(amount) FILTER (WHERE paid_at IS NOT NULL)              AS paid,
       SUM(amount) FILTER (WHERE paid_at IS NULL
                             AND status IN ('pending','hold','approved')) AS committed
FROM promoter_bonuses GROUP BY stage
UNION ALL
SELECT 'driver_' || stage, COUNT(*),
       SUM(amount) FILTER (WHERE status = 'paid'),
       SUM(amount) FILTER (WHERE status IN ('pending','payable'))
FROM driver_activation_bonuses GROUP BY stage;


-- ============================================================================
-- SECTION 7 — ROW LEVEL SECURITY on the new tables
-- Money tables. Service role only.
-- ============================================================================

ALTER TABLE partner_company_claims    ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_activation_bonuses ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['partner_company_claims','driver_activation_bonuses']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', t || '_service_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO service_role USING (true) WITH CHECK (true);',
      t || '_service_all', t);
  END LOOP;
END $$;


-- ============================================================================
-- SECTION 8 — ENROLLING DRIVERS AS REFERRAL PARTNERS
-- Commented out on purpose. Run only after the agreement is finalised —
-- agreement_signed_at stays null here, and v_payouts_due pays nothing while
-- it is null. zone_id is required by the existing promoters table, so pick
-- the zone you want these codes attributed to before running.
-- ============================================================================

-- INSERT INTO promoters (code, full_name, phone, email, user_id, zone_id,
--                        partner_type, source, hourly_rate,
--                        bonus_per_signup, bonus_first_delivery, is_active)
-- SELECT 'REF-' || UPPER(SUBSTR(MD5(u.id::text), 1, 4)),
--        u.contact_name, u.phone, u.email, u.id,
--        (SELECT id FROM zone_campaign_zones WHERE zone_key = 'SIMLIM' LIMIT 1),
--        'referral', 'driver', 0, 20, 50, true
-- FROM express_users u
-- WHERE u.role = 'driver' AND u.driver_status = 'approved'
--   AND NOT EXISTS (SELECT 1 FROM promoters p WHERE p.user_id = u.id);


-- ============================================================================
-- END. Nothing above awards or pays anything.
-- ============================================================================
