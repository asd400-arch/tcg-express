-- TCG Fleet launch promo (11 Oct 2026): FLEET15 = S$15 flat, anywhere in Singapore.
-- T&C enforced in code (lib/fleet-promo.js): TCG Express fleet booking only, up to 5 kg and 1 cbm, no cross-border.
-- Run once in the Supabase SQL editor (new tab).

alter table promo_codes drop constraint if exists promo_codes_discount_type_check;
alter table promo_codes add constraint promo_codes_discount_type_check
  check (discount_type in ('percentage', 'fixed', 'fixed_price'));

insert into promo_codes (code, description, discount_type, discount_value, valid_from, valid_until, is_active, usage_count, new_customers_only)
values (
  'FLEET15',
  'TCG Fleet launch: S$15 flat anywhere in Singapore. TCG Express fleet bookings only, up to 5kg / 1cbm. T&C apply.',
  'fixed_price', 15,
  now(), '2026-11-30 23:59:59+08', true, 0, false
)
on conflict (code) do update set
  description = excluded.description, discount_type = excluded.discount_type, discount_value = excluded.discount_value,
  valid_until = excluded.valid_until, is_active = true;

-- check: expect one row, fixed_price 15
select code, discount_type, discount_value, valid_until, is_active from promo_codes where code = 'FLEET15';
