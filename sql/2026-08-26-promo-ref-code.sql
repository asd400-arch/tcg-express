-- Flyer / promoter channel referral codes (idempotent)

with c as (
  select id from zone_campaigns where name = 'Launch Channels (Sep 2026)' limit 1
)
insert into zone_campaign_zones (campaign_id, zone_key, zone_name, promo_code, ref_code)
select c.id, v.zone_key, v.zone_key, v.promo_code, v.ref_code
from c,
(values
  ('Promoter - Flyer',  'PROMO',  'PROMO'),
  ('Promoter - Badge',  'PROMOB', 'PROMOB')
) as v(zone_key, promo_code, ref_code)
where not exists (
  select 1 from zone_campaign_zones z where upper(z.ref_code) = v.ref_code
);

select zone_key, promo_code, ref_code, created_at
from zone_campaign_zones
order by created_at desc
limit 10;
