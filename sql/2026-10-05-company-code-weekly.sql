-- Company contract code + weekly invoices (5 Oct 2026)
-- One contract (rate card) can now be shared by several staff accounts of the same company:
-- each staff member signs up, enters the company code once, and orders at the contract rate.
-- All their deliveries land on one invoice per company, billed weekly or monthly.
-- Run in a NEW Supabase SQL tab. Safe to run twice.

-- 1) Rate cards: company name, shareable code, weekly billing; owner account optional
alter table public.customer_rate_cards
  add column if not exists company_name text,
  add column if not exists join_code text;

alter table public.customer_rate_cards alter column client_id drop not null;

create unique index if not exists customer_rate_cards_join_code_key
  on public.customer_rate_cards (upper(join_code)) where join_code is not null;

alter table public.customer_rate_cards drop constraint if exists customer_rate_cards_billing_check;
alter table public.customer_rate_cards
  add constraint customer_rate_cards_billing_check check (billing in ('monthly_invoice', 'weekly_invoice'));

-- 2) Staff accounts linked to a company contract (one contract per account)
alter table public.express_users
  add column if not exists contract_card_id uuid references public.customer_rate_cards(id);

create index if not exists express_users_contract_card_idx
  on public.express_users (contract_card_id) where contract_card_id is not null;

-- Existing single-account cards: link their owner too
update public.express_users u
   set contract_card_id = c.id
  from public.customer_rate_cards c
 where c.client_id = u.id and c.active and u.contract_card_id is null;

-- sanity: expect 3 | 1 (new columns, billing check present)
select
  (select count(*) from information_schema.columns
     where table_schema = 'public'
       and ((table_name = 'customer_rate_cards' and column_name in ('company_name', 'join_code'))
         or (table_name = 'express_users' and column_name = 'contract_card_id'))) as new_columns,
  (select count(*) from pg_constraint where conname = 'customer_rate_cards_billing_check') as billing_check;
