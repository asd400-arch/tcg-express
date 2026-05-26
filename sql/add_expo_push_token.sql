-- Run in Supabase SQL editor before enabling mobile push notifications
ALTER TABLE express_users ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
