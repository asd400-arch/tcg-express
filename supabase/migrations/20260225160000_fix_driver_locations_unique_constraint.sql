-- ============================================================
-- Fix: Add missing UNIQUE constraint on job_id for express_driver_locations
-- ============================================================
-- The POST /api/jobs/[id]/location route uses a Supabase upsert with
-- { onConflict: 'job_id' }, which requires a UNIQUE constraint on job_id.
--
-- The original fix-storage-tracking.sql had UNIQUE(job_id) in the CREATE TABLE,
-- but the single_source_of_truth migration (20260224120000) redefined the table
-- without it. On any database where the SSOT migration created the table fresh,
-- the unique constraint is missing, causing all upserts to fail with a 500 error.
-- ============================================================

-- Step 1: Remove duplicate job_id rows (keep the most recently updated per job_id)
DELETE FROM express_driver_locations a
USING express_driver_locations b
WHERE a.job_id = b.job_id
  AND a.ctid < b.ctid;

-- Step 2: Add unique constraint on job_id (idempotent: skip if already exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'express_driver_locations'::regclass
      AND contype = 'u'
      AND conname LIKE '%job_id%'
  ) THEN
    ALTER TABLE express_driver_locations
      ADD CONSTRAINT express_driver_locations_job_id_unique UNIQUE (job_id);
  END IF;
END $$;
