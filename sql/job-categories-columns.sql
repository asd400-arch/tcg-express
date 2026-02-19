-- Add equipment_needed and manpower_count to express_jobs
ALTER TABLE express_jobs
  ADD COLUMN IF NOT EXISTS equipment_needed TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS manpower_count INTEGER DEFAULT 1;

-- Add equipment_needed and manpower_count to express_schedules
ALTER TABLE express_schedules
  ADD COLUMN IF NOT EXISTS equipment_needed TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS manpower_count INTEGER DEFAULT 1;
