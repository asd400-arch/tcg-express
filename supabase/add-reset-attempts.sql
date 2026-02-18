-- Add reset_attempts column for brute-force protection on password reset
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS reset_attempts integer DEFAULT 0;
