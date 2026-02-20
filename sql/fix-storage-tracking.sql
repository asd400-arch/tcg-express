-- =====================================================
-- Fix #4: Storage bucket for photo uploads
-- Fix #3: Driver locations table for live tracking
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Create storage bucket for uploads (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'express-uploads',
  'express-uploads',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760;

-- 2. Storage policies - allow service role uploads (our API uses service role)
-- Also allow public reads since bucket is public
DO $$
BEGIN
  -- Drop existing policies if they exist to avoid conflicts
  DROP POLICY IF EXISTS "Allow public reads on express-uploads" ON storage.objects;
  DROP POLICY IF EXISTS "Allow service uploads on express-uploads" ON storage.objects;
  DROP POLICY IF EXISTS "Allow service updates on express-uploads" ON storage.objects;
  DROP POLICY IF EXISTS "Allow service deletes on express-uploads" ON storage.objects;
END $$;

CREATE POLICY "Allow public reads on express-uploads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'express-uploads');

CREATE POLICY "Allow service uploads on express-uploads"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'express-uploads');

CREATE POLICY "Allow service updates on express-uploads"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'express-uploads');

CREATE POLICY "Allow service deletes on express-uploads"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'express-uploads');

-- 3. Create unified driver locations table for live tracking
CREATE TABLE IF NOT EXISTS express_driver_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES express_jobs(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES express_users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION DEFAULT 0,
  speed DOUBLE PRECISION DEFAULT 0,
  accuracy DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_locations_job ON express_driver_locations(job_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver ON express_driver_locations(driver_id);

-- 4. Also create the old table name as a view for backwards compatibility
-- (in case express_job_locations was being used)
DROP TABLE IF EXISTS express_job_locations CASCADE;

-- 5. Enable realtime on driver locations
ALTER PUBLICATION supabase_realtime ADD TABLE express_driver_locations;

-- 6. Verify: check that express_jobs has photo columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'express_jobs' AND column_name = 'pickup_photo') THEN
    ALTER TABLE express_jobs ADD COLUMN pickup_photo TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'express_jobs' AND column_name = 'delivery_photo') THEN
    ALTER TABLE express_jobs ADD COLUMN delivery_photo TEXT;
  END IF;
END $$;
