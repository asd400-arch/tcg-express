-- Add is_corp_premium flag to express_jobs
-- RFQ/corp premium jobs should only be visible in Admin panel, not driver Available Jobs
ALTER TABLE express_jobs ADD COLUMN IF NOT EXISTS is_corp_premium BOOLEAN DEFAULT FALSE;

-- Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_jobs_corp_premium ON express_jobs(is_corp_premium) WHERE is_corp_premium = true;
