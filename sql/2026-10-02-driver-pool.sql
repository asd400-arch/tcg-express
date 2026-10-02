-- Driver pool choice + driver codes + contract rate cards with monthly invoicing (2 Oct 2026)
-- Customer chooses per job: any on-call driver ('open'), TCG Express fleet ('tcg'), or one driver by code ('direct').
-- Run in a NEW Supabase SQL tab. Safe to run twice.

-- 1) Jobs: which pool may take it, and the one driver for direct bookings
alter table public.express_jobs
  add column if not exists driver_pool text not null default 'open',
  add column if not exists target_driver_id uuid references public.express_users(id);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'express_jobs_driver_pool_chk') then
    alter table public.express_jobs
      add constraint express_jobs_driver_pool_chk check (driver_pool in ('open', 'tcg', 'direct'));
  end if;
end $$;

create index if not exists express_jobs_target_driver_idx
  on public.express_jobs (target_driver_id) where target_driver_id is not null;

-- 2) Drivers: TCG fleet flag (admin sets it) and a short code customers can type
alter table public.express_users
  add column if not exists tcg_fleet boolean not null default false,
  add column if not exists tcg_fleet_since timestamptz,
  add column if not exists driver_code text;

create unique index if not exists express_users_driver_code_key
  on public.express_users (driver_code) where driver_code is not null;

-- 5 characters, no 0/O/1/I/L so it reads well over the phone
create or replace function public.gen_driver_code() returns text
language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..5 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.express_users where driver_code = c);
  end loop;
  return c;
end $$;

-- Every driver gets a code: existing ones now, new ones on sign-up
update public.express_users set driver_code = public.gen_driver_code()
where role = 'driver' and driver_code is null;

create or replace function public.set_driver_code() returns trigger
language plpgsql as $$
begin
  if new.role = 'driver' and new.driver_code is null then
    new.driver_code := public.gen_driver_code();
  end if;
  return new;
end $$;

drop trigger if exists express_users_driver_code_trg on public.express_users;
create trigger express_users_driver_code_trg
  before insert or update of role on public.express_users
  for each row execute function public.set_driver_code();

-- 3) Payroll: jobs done by salaried TCG fleet drivers are settled to TCG (no per-job payout)
alter table public.express_jobs
  add column if not exists payout_mode text not null default 'per_job';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'express_jobs_payout_mode_chk') then
    alter table public.express_jobs
      add constraint express_jobs_payout_mode_chk check (payout_mode in ('per_job', 'salary'));
  end if;
end $$;

-- Monthly count per fleet driver for payroll (Singapore time)
create or replace view public.fleet_monthly_jobs as
select
  to_char(date_trunc('month', j.completed_at at time zone 'Asia/Singapore'), 'YYYY-MM') as month,
  u.id as driver_id,
  u.contact_name as driver_name,
  u.driver_code,
  count(*) as jobs,
  sum(coalesce(j.commission_amount, 0)) as revenue_sgd
from public.express_jobs j
join public.express_users u on u.id = j.assigned_driver_id
where j.payout_mode = 'salary' and j.completed_at is not null
group by 1, 2, 3, 4;

revoke all on public.fleet_monthly_jobs from anon, authenticated;

-- 4) Contract customers: fixed rate card (first drop / each additional drop), billed by monthly invoice
create table if not exists public.customer_rate_cards (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.express_users(id),
  label text not null default 'Contract rate',
  vehicle text not null default 'motorcycle',
  first_drop_sgd numeric(10,2) not null check (first_drop_sgd > 0),
  next_drop_sgd numeric(10,2) not null check (next_drop_sgd > 0),
  driver_pool text not null default 'tcg' check (driver_pool in ('open', 'tcg')),
  billing text not null default 'monthly_invoice' check (billing in ('monthly_invoice')),
  payment_terms_days int not null default 14,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists customer_rate_cards_one_active
  on public.customer_rate_cards (client_id) where active;
alter table public.customer_rate_cards enable row level security;  -- no policies: server (service role) only

alter table public.express_jobs
  add column if not exists billing_mode text not null default 'wallet',
  add column if not exists rate_card_id uuid references public.customer_rate_cards(id),
  add column if not exists trip_seq int;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'express_jobs_billing_mode_chk') then
    alter table public.express_jobs
      add constraint express_jobs_billing_mode_chk check (billing_mode in ('wallet', 'invoice'));
  end if;
end $$;

create index if not exists express_jobs_trip_idx
  on public.express_jobs (consolidation_group_id) where consolidation_group_id is not null;

-- Monthly invoice lines per contract customer (completed jobs, Singapore time)
create or replace view public.customer_monthly_invoice as
select
  to_char(date_trunc('month', j.completed_at at time zone 'Asia/Singapore'), 'YYYY-MM') as month,
  j.client_id,
  u.company_name,
  count(*) as drops,
  sum(coalesce(j.final_amount, j.budget_min, 0)) as amount_sgd
from public.express_jobs j
join public.express_users u on u.id = j.client_id
where j.billing_mode = 'invoice' and j.completed_at is not null
group by 1, 2, 3;

revoke all on public.customer_monthly_invoice from anon, authenticated;

-- sanity: expect 8 | 0 | 1 (new columns, drivers without a code, rate card table)
select
  (select count(*) from information_schema.columns
     where table_schema = 'public'
       and ((table_name = 'express_jobs' and column_name in ('driver_pool', 'target_driver_id', 'payout_mode', 'billing_mode', 'rate_card_id', 'trip_seq'))
         or (table_name = 'express_users' and column_name in ('tcg_fleet', 'driver_code')))) as new_columns,
  (select count(*) from public.express_users where role = 'driver' and driver_code is null) as drivers_without_code,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'customer_rate_cards') as rate_card_table;
