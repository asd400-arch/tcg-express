-- Run in Supabase SQL Editor to create settings table
CREATE TABLE IF NOT EXISTS express_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default commission rate
INSERT INTO express_settings (key, value)
VALUES ('commission_rate', '15')
ON CONFLICT (key) DO NOTHING;
