-- TCG Express — 스키마 확인용 진단 쿼리 (읽기 전용, 아무것도 바꾸지 않음)
-- Supabase → SQL Editor → 새 탭에 붙여넣고 Run.
-- 코드는 쓰고 있는데 마이그레이션 파일에는 없는 컬럼/테이블만 모아둔 것.
-- expected_by_code = true 인데 exists = false 면 그 기능은 조용히 실패하고 있는 것.

WITH expected(obj_type, tbl, col) AS (
  VALUES
    ('col','express_users','referral_code'),
    ('col','express_users','expo_push_token'),
    ('col','express_users','locale'),
    ('col','express_jobs','fare_breakdown'),
    ('col','express_jobs','external_order_id'),
    ('col','express_jobs','external_source'),
    ('col','express_jobs','zone_surcharge'),
    ('col','express_jobs','customer_signature_url'),
    ('col','express_jobs','signed_at'),
    ('col','express_jobs','pickup_photo'),
    ('col','express_jobs','delivery_photo'),
    ('col','express_bids','equipment_charges'),
    ('col','wallets','bonus_balance'),
    ('col','promo_codes','owner_user_id'),
    ('col','service_zones','status'),
    ('col','service_zones','is_active'),
    ('col','service_zones','country')
)
SELECT e.obj_type, e.tbl, e.col,
       (c.column_name IS NOT NULL) AS exists,
       c.data_type
FROM expected e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = e.tbl AND c.column_name = e.col
ORDER BY exists, e.tbl, e.col;

-- 테이블 / 뷰 존재 확인
SELECT t.name AS object_name,
       EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name = t.name) AS exists
FROM (VALUES
  ('broadcasts'),('promoters'),('promoter_bonuses'),('promoter_summary'),
  ('zone_campaign_zones'),('referral_rewards'),('external_api_keys'),
  ('processed_webhook_events'),('corp_premium_requests'),('corp_premium_bids'),
  ('payments'),('wallet_transactions'),('express_transactions')
) AS t(name)
ORDER BY exists, object_name;

-- DB 함수 존재 확인 (결제 핵심)
SELECT p.proname AS function_name
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('release_payment','process_bid_acceptance','process_job_payment',
                    'wallet_credit','wallet_debit','check_job_status_transition')
ORDER BY p.proname;
