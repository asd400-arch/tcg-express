-- ============================================================
-- Banner Carousel — add scheduling and deep link columns
-- Run BEFORE deploying the updated GET /api/banners route.
-- ============================================================

ALTER TABLE express_promo_banners
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_date   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deep_link  TEXT;
