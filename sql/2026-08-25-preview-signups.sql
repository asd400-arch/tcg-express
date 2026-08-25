-- Pre-launch preview signups (run once in Supabase SQL editor)
-- Collects emails from the /preview landing page before the 1 Sep launch.

create table if not exists preview_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null default 'customer' check (role in ('customer', 'driver')),
  company text,
  ref_code text,
  notified_at timestamptz,          -- set when the launch email is sent
  created_at timestamptz not null default now()
);

create index if not exists idx_preview_signups_role on preview_signups (role);

-- Service role bypasses RLS; enabling it blocks anon/public access entirely.
alter table preview_signups enable row level security;
