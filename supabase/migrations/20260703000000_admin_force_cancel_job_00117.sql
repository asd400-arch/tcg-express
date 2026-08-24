-- Admin bypass: force cancel job TCG-2026-00117
DO $$
BEGIN
  -- Temporarily disable the status transition guard
  ALTER TABLE express_jobs DISABLE TRIGGER trg_job_status_transition;
  
  -- Force update the status
  UPDATE express_jobs 
  SET status = 'cancelled',
      cancelled_at = '2026-07-03T00:00:00+00:00'
  WHERE job_number = 'TCG-2026-00117';
  
  -- Re-enable the trigger
  ALTER TABLE express_jobs ENABLE TRIGGER trg_job_status_transition;
END;
$$;

-- Verify the change
SELECT job_number, status, cancelled_at FROM express_jobs WHERE job_number = 'TCG-2026-00117';
