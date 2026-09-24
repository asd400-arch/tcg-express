-- Abuse screen results for completed jobs (written by app/api/jobs/[id]/status/route.js).
-- Run once in Supabase (new query tab).
create table if not exists job_review_flags (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references express_jobs(id) on delete cascade,
  driver_id uuid references express_users(id) on delete set null,
  client_id uuid references express_users(id) on delete set null,
  reasons jsonb not null default '[]'::jsonb,
  bonus_held boolean not null default true,
  coupon_discount numeric(12,2) not null default 0,
  reviewed_at timestamptz,
  reviewed_by uuid references express_users(id) on delete set null,
  decision text,               -- 'ok' | 'fraud' | null
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists job_review_flags_job_idx on job_review_flags(job_id);
create index if not exists job_review_flags_open_idx on job_review_flags(reviewed_at) where reviewed_at is null;

-- Launch promo caps (adjust in /admin/coupons or here):
-- update promo_codes set per_user_limit = 10, min_order_amount = 0, usage_limit = 1000 where code = 'FIRST10';

-- Optional overrides (JSON) read by the code:
-- insert into express_settings (key, value) values ('promo_require_uen_codes', 'FIRST10,HANSIK10');
-- insert into express_settings (key, value) values ('driver_launch_topup', '{"enabled":true,"per_customer_cap":3}');
