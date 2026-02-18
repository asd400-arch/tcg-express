-- Phase 17: Add notification_preferences column to express_users
ALTER TABLE express_users
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "job_updates": { "email": true, "push": true },
  "bid_activity": { "email": true, "push": true },
  "delivery_status": { "email": true, "push": true },
  "account_alerts": { "email": true, "push": true }
}'::jsonb;
