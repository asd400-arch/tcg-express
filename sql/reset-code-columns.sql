-- Phase 7: Add password reset columns to express_users
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS reset_code TEXT;
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS reset_code_expires TIMESTAMPTZ;
