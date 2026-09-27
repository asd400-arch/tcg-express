-- TCG Express — dispatch changes (27 Sep 2026)
-- Fixed-price jobs (first driver to accept gets it), customer boosts, driver "On my way"
-- check-in, and automatic release of drivers who don't confirm by the pickup time.
-- Run once in Supabase SQL editor (NEW query tab). Safe to run again.

-- ── Part A: columns + scheduler token (required) ─────────────────────────────
alter table public.express_jobs add column if not exists boost_total numeric(12,2) not null default 0;
alter table public.express_jobs add column if not exists boost_nudged_at timestamptz;
alter table public.express_jobs add column if not exists driver_checkin_at timestamptz;
alter table public.express_jobs add column if not exists checkin_reminded_at timestamptz;

-- Jobs already waiting count as nudged, so nobody gets a "boost?" push right after the switch
update public.express_jobs
   set boost_nudged_at = now()
 where status in ('open', 'bidding') and boost_nudged_at is null;

-- Token the scheduler sends to /api/cron/dispatch (random, 64 hex chars)
insert into public.express_settings (key, value)
values ('dispatch_cron_token', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- ── Part B: run the dispatch sweep every 5 minutes (pg_cron + pg_net) ────────
-- If "create extension" is refused, enable pg_cron and pg_net in the Dashboard
-- (Database → Extensions, or Integrations → Cron) and run Part B again.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

select cron.unschedule(jobid) from cron.job where jobname = 'tcg-dispatch-sweep';

select cron.schedule(
  'tcg-dispatch-sweep',
  '*/5 * * * *',
  $job$
  select net.http_get(
    url := 'https://app.techchainglobal.com/api/cron/dispatch',
    headers := jsonb_build_object(
      'x-dispatch-token',
      (select value from public.express_settings where key = 'dispatch_cron_token')
    ),
    timeout_milliseconds := 20000
  );
  $job$
);

-- Check: select jobid, jobname, schedule, active from cron.job;
-- Recent runs: select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
-- HTTP results: select status_code, content from net._http_response order by created desc limit 5;
