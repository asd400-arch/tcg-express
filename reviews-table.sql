-- Phase 6: Reviews table for driver ratings
CREATE TABLE IF NOT EXISTS express_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES express_jobs(id),
  client_id UUID NOT NULL REFERENCES express_users(id),
  driver_id UUID NOT NULL REFERENCES express_users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS reviews_job_unique ON express_reviews(job_id);

ALTER TABLE express_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select" ON express_reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert" ON express_reviews FOR INSERT WITH CHECK (true);
