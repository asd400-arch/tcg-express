-- Migrate existing plain-text passwords to bcrypt using pgcrypto
-- Run in Supabase SQL Editor (pgcrypto is pre-installed on Supabase)

-- Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Update all plain-text passwords (those NOT starting with '$2')
-- This hashes them with bcrypt (bf algorithm), 12 rounds
UPDATE express_users
SET password_hash = crypt(password_hash, gen_salt('bf', 12))
WHERE password_hash NOT LIKE '$2%';

-- Verify: all passwords should now start with $2
-- SELECT id, email, LEFT(password_hash, 4) as hash_prefix FROM express_users;
