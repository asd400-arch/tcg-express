-- Phase 20: Bidirectional reviews — drivers can rate clients too

-- 1. Add reviewer_role column (existing rows default to 'client')
ALTER TABLE express_reviews
  ADD COLUMN IF NOT EXISTS reviewer_role TEXT NOT NULL DEFAULT 'client'
  CHECK (reviewer_role IN ('client', 'driver'));

-- 2. Replace old unique index (one review per job) with composite (one review per role per job)
DROP INDEX IF EXISTS reviews_job_unique;
CREATE UNIQUE INDEX reviews_job_role_unique ON express_reviews(job_id, reviewer_role);

-- 3. Add client_rating column to users
ALTER TABLE express_users
  ADD COLUMN IF NOT EXISTS client_rating NUMERIC DEFAULT 5.0;

-- 4. Grant anon read access to new column
GRANT SELECT (client_rating) ON express_users TO anon;
