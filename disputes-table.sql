-- Phase 11: Dispute Resolution System
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS express_disputes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES express_jobs(id) NOT NULL,
  opened_by UUID REFERENCES express_users(id) NOT NULL,
  opened_by_role TEXT NOT NULL,            -- 'client' or 'driver'
  reason TEXT NOT NULL,                     -- 'damaged_item', 'wrong_delivery', 'late_delivery', 'wrong_address', 'item_not_as_described', 'driver_no_show', 'other'
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',      -- 'open', 'under_review', 'resolved'
  resolution TEXT,                          -- 'refund_client' or 'release_driver'
  admin_notes TEXT,
  resolved_by UUID REFERENCES express_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE express_disputes ENABLE ROW LEVEL SECURITY;

-- Policy: users can read disputes on their own jobs
CREATE POLICY "Users can view own disputes" ON express_disputes
  FOR SELECT USING (
    opened_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM express_jobs
      WHERE express_jobs.id = express_disputes.job_id
      AND (express_jobs.client_id = auth.uid() OR express_jobs.assigned_driver_id = auth.uid())
    )
  );

-- Policy: users can insert disputes
CREATE POLICY "Users can create disputes" ON express_disputes
  FOR INSERT WITH CHECK (opened_by = auth.uid());

-- Grant access for service role (admin operations handled via supabaseAdmin)
GRANT ALL ON express_disputes TO service_role;
GRANT SELECT, INSERT ON express_disputes TO anon;
GRANT SELECT, INSERT ON express_disputes TO authenticated;
