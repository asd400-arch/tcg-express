-- Phase 14: Email Verification columns
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS verification_code text;
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS verification_code_expires timestamptz;
