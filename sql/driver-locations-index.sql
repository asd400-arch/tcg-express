-- Index for faster location history queries (driver + job, ordered by time)
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_job
ON express_driver_locations (driver_id, job_id, created_at ASC);

-- Index for real-time subscription filter on job_id
CREATE INDEX IF NOT EXISTS idx_driver_locations_job_id
ON express_driver_locations (job_id);
