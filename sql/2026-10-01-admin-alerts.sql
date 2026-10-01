-- Admin dispatch safety net (1 Oct 2026)
-- Marks the once-only "no driver after 5 minutes" admin alert per job (lib/dispatch.js step 0).
-- Until this column exists the sweep skips that step and logs a warning; everything else works.
-- Run in a NEW Supabase SQL tab.

alter table public.express_jobs
  add column if not exists admin_alerted_at timestamptz;

-- sanity: expect 1
select count(*) as admin_alerted_at_columns
from information_schema.columns
where table_schema = 'public' and table_name = 'express_jobs' and column_name = 'admin_alerted_at';
