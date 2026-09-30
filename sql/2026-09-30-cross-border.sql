-- Cross-border SG -> Malaysia (JB / KL), Phase 1 — 30 Sep 2026
-- Run in a NEW Supabase SQL tab. Safe to re-run (IF NOT EXISTS everywhere).
--
-- Jobs: a cross-border job is always a QUOTE job (drivers send a price for the run),
-- only drivers with cross_border_ready = true see it, are pushed it, and may quote.
-- Customs paperwork (SG export permit + Malaysian K1) is handled by TCG's declaring
-- agents, not by the driver; the customer pays those fees separately.

alter table public.express_jobs
  add column if not exists cross_border boolean not null default false,
  add column if not exists destination_country text not null default 'SG',
  add column if not exists cross_border_details jsonb,
  add column if not exists cross_border_events jsonb not null default '[]'::jsonb;

comment on column public.express_jobs.cross_border is 'true = delivery address is outside Singapore (Phase 1: Malaysia). Always quote mode; only cross_border_ready drivers see it.';
comment on column public.express_jobs.destination_country is 'ISO-2 country of the delivery address: SG (default) or MY.';
comment on column public.express_jobs.cross_border_details is 'JSON: {city, city_other, state, postcode, consignee_company, goods_description, declared_value_sgd, packages, hs_code, customs_agent (tcg|own), customs_agent_name}';
comment on column public.express_jobs.cross_border_events is 'JSON array of {event, at, by}: at_sg_checkpoint | cleared_sg | at_my_checkpoint | cleared_my';

create index if not exists express_jobs_cross_border_open_idx
  on public.express_jobs (status)
  where cross_border = true;

alter table public.express_users
  add column if not exists cross_border_requested boolean not null default false,
  add column if not exists cross_border_requested_at timestamptz,
  add column if not exists cross_border_ready boolean not null default false,
  add column if not exists cross_border_verified_at timestamptz,
  add column if not exists cross_border_notes text;

comment on column public.express_users.cross_border_requested is 'Driver self-declared: VEP RFID + Malaysia insurance cover + passport. Admin verifies and sets cross_border_ready.';
comment on column public.express_users.cross_border_ready is 'Admin-verified: driver may see and quote cross-border (Malaysia) jobs.';
comment on column public.express_users.cross_border_notes is 'Driver note for verification: VEP validity, insurer, vehicle. Free text.';

-- Sanity check
select
  (select count(*) from information_schema.columns where table_name = 'express_jobs'  and column_name in ('cross_border','destination_country','cross_border_details','cross_border_events')) as job_cols_4,
  (select count(*) from information_schema.columns where table_name = 'express_users' and column_name in ('cross_border_requested','cross_border_requested_at','cross_border_ready','cross_border_verified_at','cross_border_notes')) as user_cols_5;
