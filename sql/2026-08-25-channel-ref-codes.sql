-- Channel referral codes for the launch campaign — v3
-- (adds required zone_name; idempotent — safe to re-run)

with existing as (
  select id from zone_campaigns where name = 'Launch Channels (Sep 2026)' limit 1
), created as (
  insert into zone_campaigns (name)
  select 'Launch Channels (Sep 2026)'
  where not exists (select 1 from existing)
  returning id
), c as (
  select id from existing
  union all
  select id from created
)
insert into zone_campaign_zones (campaign_id, zone_key, zone_name, promo_code, ref_code)
select c.id, v.zone_key, v.zone_key, v.promo_code, v.ref_code
from c,
(values
  ('Driver - Carousell',       'DRVCARO', 'DRVCARO'),
  ('Driver - MyCareersFuture', 'DRVMCF',  'DRVMCF'),
  ('Driver - Facebook',        'DRVFB',   'DRVFB'),
  ('Driver - Telegram',        'DRVTG',   'DRVTG'),
  ('Driver - LinkedIn',        'DRVLI',   'DRVLI'),
  ('Customer - LinkedIn',      'CUSLI',   'CUSLI'),
  ('Customer - Facebook',      'CUSFB',   'CUSFB'),
  ('Vehicle QR',               'VEHICLE', 'VEHICLE')
) as v(zone_key, promo_code, ref_code)
where not exists (
  select 1 from zone_campaign_zones z where upper(z.ref_code) = v.ref_code
);

-- Verify:
select zone_key, promo_code, ref_code, created_at
from zone_campaign_zones
order by created_at desc
limit 10;
