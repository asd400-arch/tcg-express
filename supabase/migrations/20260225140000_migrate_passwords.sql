-- Migrate existing plain-text passwords to bcrypt using pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Update all plain-text passwords (those NOT starting with '$2')
-- This hashes them with bcrypt (bf algorithm), 12 rounds
UPDATE express_users
SET password_hash = extensions.crypt(password_hash, extensions.gen_salt('bf', 12))
WHERE password_hash NOT LIKE '$2%';
