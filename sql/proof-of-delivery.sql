-- =====================================================================
-- PROOF OF DELIVERY — E-Signature + PDF Invoice Auto-Generation
-- 2026-02-24
-- =====================================================================
-- Adds 4 new columns to express_jobs for:
--   customer_signature_url — uploaded PNG of customer's e-signature
--   invoice_url            — auto-generated PDF receipt (separate from manual invoice_file)
--   signer_name            — full name entered by signer
--   signed_at              — timestamp of signature capture

ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS customer_signature_url TEXT;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS invoice_url TEXT;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS signer_name TEXT;
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
