# TCG Express — 프로젝트 마스터 플랜

> **마지막 업데이트**: 2026-03-02  
> **프로젝트 소유자**: 스캇 (Founder/Developer)  
> **이 문서 목적**: 모든 개발 히스토리, 현재 상태, TODO를 한 곳에서 관리

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **프로젝트명** | TCG Express (Tech Chain Global Express) |
| **설명** | 싱가포르 최초 B2B 기술장비 배송 플랫폼 |
| **단계** | Beta → Production 전환 중 |
| **기술스택** | Next.js (App Router) + Supabase + Vercel |
| **GitHub** | `asd400-arch/tcg-express` |
| **라이브 URL** | `app.techchainglobal.com` (Express 앱) |
| **메인 사이트** | `techchainglobal.com` (GitHub: `asd400-arch/techchain-global`) |
| **프로젝트 구조** | `app/` 디렉토리 (src/ 없음) |

### Tech Chain Global 생태계
- **TCG Express** — B2B 배송 플랫폼 (현재 집중)
- **TCG Warehouse** — 창고 서비스 (향후)
- **TCG Freight** — 화물 운송 (향후)

---

## 2. 완료된 작업 로그

### Phase 1 — 초기 설정 및 메인 사이트 (2026-02 초)
- ✅ `express.techchainglobal.com` 서브도메인 설정 (Vercel + DNS)
- ✅ 메인 사이트 `/tech-delivery` 페이지 생성 (TCG Express 소개/CTA)
- ✅ `/services` 페이지에 Tech Delivery 링크 추가
- ✅ 홈페이지 "What's New" TCG Express 프로모션 배너 추가
- ✅ 푸터 Tech Delivery 링크 → `/tech-delivery`로 변경
- ✅ 메인 사이트 회사 프로필 타임라인, 글로벌 네트워크, ESG 섹션 구현
- ✅ Glassmorphism 디자인 효과 적용
- ✅ 드롭다운 메뉴로 네비게이션 리구조화

### Phase 2 — 핵심 버그 수정 (2026-02-26)
- ✅ **Accept 버튼 404 에러 해결**
  - 원인: `app/api/jobs/[id]/instant-accept/route.js`에서 `estimated_fare` 컬럼 참조
  - DB 실제 컬럼: `budget_min`, `budget_max` (express_jobs에 estimated_fare 없음)
  - 해결: estimated_fare → budget_min/budget_max로 수정 + 빈 body 추가

- ✅ **Available Jobs 최신 잡 누락 문제 해결**
  - 원인: `{ count: 'exact' }` 옵션 + 정렬 순서 문제
  - 해결: count 옵션 제거, created_at DESC 정렬 통일

- ✅ **잡 카드 UI 개선 (Available Jobs + Dashboard)**
  - 차량 아이콘 + 타입 | 무게 | STANDARD/EXPRESS 배지
  - 날짜/시간 + "in Xh Xm" 카운트다운
  - 우편번호 앞 2자리 → 싱가포르 지역명 변환

### Phase 3 — Corp Premium & 파일 업로드 수정 (2026-03-01 ~ 03-02)

#### 3a. pickup_regions.map 런타임 에러 수정
- **문제**: `TypeError: f.pickup_regions.map is not a function`
  - RFQ 폼 (`app/client/rfq/page.js`)에서 `pickup_regions`를 string으로 저장
  - Admin 페이지 (`app/admin/corp-premium/page.js`)에서 `.map()`으로 배열 취급 → 크래시
- **수정 파일**:
  - `app/admin/corp-premium/page.js` — `toArray()` 헬퍼 함수 추가 (null, string, JSON string, 배열 모두 안전 처리)
  - `app/client/rfq/page.js` — insert 시 쉼표 기준 split하여 배열로 저장
  - `vehicle_types`, `delivery_regions`, `certifications_required`도 동일 방어 적용

#### 3b. CSP (Content Security Policy) 설정
- **문제**: Google Fonts, Stripe JS, Vercel feedback 등 CSP에 의해 차단
- **필요한 수정** (next.config.js 또는 middleware.ts):
  - `connect-src`: supabase, api.stripe.com, api.anthropic.com, router.project-osrm.org, fonts.googleapis.com, basemaps.cartocdn.com
  - `script-src`: js.stripe.com, maps.googleapis.com, unpkg.com, vercel.live
  - `style-src`: fonts.googleapis.com
  - `font-src`: fonts.gstatic.com
  - `frame-src`: js.stripe.com, vercel.live
- **상태**: ⏳ 가이드 제공됨, 적용 대기

#### 3c. Admin 견적(Quote) 작성 기능 추가
- **기능**: Admin이 직접 가격 책정하여 Client에게 견적 전송
- **수정 파일**: `app/admin/corp-premium/page.js`
- **추가된 기능**:
  - 견적 작성 폼 (Monthly Rate, Per Delivery, Setup Fee, Line Items)
  - Quote Validity (7/14/30/60일) 및 Payment Terms 선택
  - 실시간 Quote Summary 프리뷰
  - 기존 견적 표시 카드 (보라색 테마)
  - "Revise Quote" 재수정 기능
  - "Mark Under Review" 상태 버튼 추가
- **API**: `app/api/corp-premium/[id]/bids/route.js` — `send_quote` 액션 이미 구현됨
- **DB**: `corp_premium_requests` 테이블에 `admin_quote` (jsonb) 컬럼 필요
- **상태**: ✅ 프론트엔드 완료, ⏳ DB 컬럼 추가 필요

```sql
-- Supabase SQL Editor에서 실행
ALTER TABLE corp_premium_requests
ADD COLUMN IF NOT EXISTS admin_quote jsonb DEFAULT NULL;
```

#### 3d. 파일 업로드 타입 확장
- **문제**: RFQ 첨부파일이 이미지/PDF만 허용 → Excel 업로드 불가
- **수정 파일**: `app/api/upload/route.js`
- **추가된 타입**:
  - `.xlsx` (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
  - `.xls` (application/vnd.ms-excel)
  - `.docx` (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
  - `.doc` (application/msword)
  - `.csv` (text/csv)
  - `.pptx` (application/vnd.openxmlformats-officedocument.presentationml.presentation)
- **추가 수정**: rfq-attachments 버킷에도 allowedMimeTypes 명시적 설정
- **상태**: ✅ 완료 및 배포됨

### 홍보 콘텐츠 (2026-02-26)
- ✅ LinkedIn 포스트 3종 (Professional / Story-driven / Short)
- ✅ Carousell 배너 3종 (Main Promo / Driver Recruitment / Vehicle Pricing)
- ✅ Carousell 리스팅 텍스트 2종 (Customer / Driver recruitment)

---

## 3. 현재 프로젝트 상태

### 상태 플로우

**Express Jobs 플로우:**
```
Client 생성 → open → bidding → assigned → in_progress → completed
```

**Corp Premium RFQ 플로우:**
```
Client RFQ 제출 → submitted → under_review → quote_sent → accepted/rejected
                                            ↘ bidding_open → bidding_closed → awarded → active → completed
```

**Admin 견적 플로우:**
```
RFQ 접수 → Mark Under Review → Send Quote → Client Accept/Reject
                              → 또는 Open Bidding (파트너 입찰)
```

### 파일 구조 (핵심)

```
app/
├── admin/
│   ├── corp-premium/page.js    ← 견적 기능 추가됨
│   ├── dashboard/page.js
│   └── ...
├── client/
│   ├── rfq/page.js             ← 배열 저장 + 파일타입 확장
│   └── ...
├── driver/
│   ├── dashboard/page.js
│   └── ...
├── api/
│   ├── corp-premium/
│   │   ├── route.js            ← 리스트 API
│   │   └── [id]/bids/route.js  ← send_quote 액션 포함
│   ├── upload/route.js         ← 파일타입 확장됨
│   ├── jobs/
│   │   └── [id]/instant-accept/route.js  ← budget_min/max 수정됨
│   └── ...
├── components/
│   ├── AuthContext.js
│   ├── Sidebar.js
│   ├── Toast.js
│   └── ...
└── ...
```

---

## 4. DB 테이블 구조

### express_jobs 주요 컬럼
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid | PK |
| client_id | uuid | FK |
| job_number | text | |
| pickup_address, delivery_address | text | |
| pickup_lat/lng, delivery_lat/lng | float | |
| budget_min, budget_max | numeric | ⚠️ estimated_fare 없음 |
| final_amount | numeric | |
| status | text | open/bidding/assigned/in_progress/completed |
| assigned_driver_id | uuid | ⚠️ driver_id 아님 |
| assigned_bid_id | uuid | |
| vehicle_required | text | |
| item_weight | text | |
| urgency | text | STANDARD/EXPRESS |
| pickup_by, deliver_by | timestamp | |

### corp_premium_requests 주요 컬럼
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid | PK |
| client_id | uuid | FK |
| request_number | text | 예: CPR-2026-013 |
| title, description | text | |
| pickup_regions | jsonb | ⚠️ 배열로 저장 권장 |
| delivery_regions | jsonb | ⚠️ 배열로 저장 권장 |
| vehicle_types | text/jsonb | |
| admin_quote | jsonb | 🆕 Admin 견적 데이터 |
| status | text | submitted/under_review/quote_sent/accepted/rejected/bidding_open/... |
| contract_duration | int | 개월 수 |
| nda_accepted | bool | |
| attachments | jsonb | URL 배열 |

### express_users 주요 역할
- `admin` — 플랫폼 관리자
- `client` — 배송 의뢰 고객
- `driver` — 배송 기사/파트너

### 전체 테이블 목록
```
Leads, blog_posts, chatbot_sessions, consolidation_groups, contracts,
corp_premium_bids, corp_premium_requests, driver_job_queue, express_bids,
express_disputes, express_driver_locations, express_jobs, express_messages,
express_notifications, express_promo_banners, express_push_subscriptions,
express_reviews, express_schedules, express_settings, express_support_messages,
express_support_tickets, express_transactions, express_users, faq_articles,
faq_categories, green_points_ledger, green_points_redemption, pages,
payments, processed_webhook_events, promo_codes, quote_requests,
regular_schedules, service_zones, site_content, support_messages,
support_tickets, wallet_topups, wallet_transactions, wallet_withdrawals,
wallets, warehouse_inventory, warehouse_orders, warehouse_rates,
warehouse_stock_movements, warehouses
```

---

## 5. 알려진 이슈 & 주의사항

### ⚠️ 개발 시 주의할 점
1. **estimated_fare 컬럼 없음** — express_jobs에서 항상 `budget_min`/`budget_max` 사용
2. **driver_id 아님** — express_jobs에서 `assigned_driver_id` 사용
3. **pickup_regions는 타입 혼재** — 기존 데이터는 string, 신규는 배열. `toArray()` 헬퍼로 방어 필수
4. **Supabase 버킷** — `express-uploads` (일반), `rfq-attachments` (RFQ 전용)
5. **app/ 디렉토리** — src/ 사용하지 않음

### 🐛 미해결 버그
1. **Push Notifications** — 작동 안 됨
2. **Bid Acceptance** — Accept 수정 완료, 상세 플로우 추가 테스트 필요
3. **Dispute Resolution** — 미테스트
4. **CSP 경고** — Google Fonts, Stripe 등 차단됨 (가이드 제공, 적용 대기)

---

## 6. TODO (우선순위)

> 📋 상세 주간 계획: `TCG_EXPRESS_WEEKLY_PLAN_0302.md` 참조

### 🔴 P0 — 이번 주 필수 (매출/서비스 차단 요소)
- [ ] 전체 배송 플로우 E2E 테스트 (Client→Driver→Pickup→Delivery→POD→완료)
- [ ] `admin_quote` jsonb 컬럼 추가 (SQL 실행)
- [ ] E2E 테스트에서 발견된 버그 즉시 수정

### 🟠 P1 — 이번 주 중요 (사용자 이탈 방지)
- [ ] Push Notifications 진단 및 수정 (또는 Realtime 인앱 알림 대안)
- [ ] CSP 설정 적용 (Google Fonts, Stripe JS 차단 해제)
- [ ] 디버그 텍스트 제거 ("DB: X rows..." 등)

### 🟢 P3 — 이번 주 목표 (기능 완성)
- [ ] Client측 견적 수신/수락/거절 UI 구현
- [ ] 결제 방향 결정 (Stripe 해제 vs HitPay vs PayNow 수동)
- [ ] Dashboard 잡 카드 UI를 Available Jobs와 완전 통일

### 🔵 향후 계획 (다음 주 이후)
- [ ] 결제 연동 구현 (결정된 방향 기준)
- [ ] Android 앱 배포 (TWA 방식)
- [ ] iOS 앱 (Capacitor 또는 PWA)
- [ ] EV Rewards / CO2 트래킹 활성화 (MVP 이후)
- [ ] Green Points 캐시백 시스템 활성화
- [ ] 드라이버 Multi-Job Queue 활성화
- [ ] Dispute Resolution 테스트 및 수정

---

## 7. 결제 현황

| 방법 | 상태 | 비고 |
|------|------|------|
| Stripe | ⚠️ 계정 제한 | 제한 해제 필요 |
| HitPay | 🔍 검토 중 | 싱가포르 현지 대안 |
| PayNow | ✅ 구현됨 | 0% 수수료 폴백 |

---

## 8. 드라이버 모집 전략

- **플랫폼**: Carousell (주력), LinkedIn
- **인센티브**:
  - 가입 보너스
  - 추천 리워드
  - 첫 배송 보너스
- **타겟**: 기존 물류/배송 기사, 프리랜서 드라이버
- **우선순위**: 드라이버 확보 > 고객 확보 (공급 먼저)

---

## 9. 외주 개발자 정보

- **제안서 파일**: TCG_Express_Developer_Proposal.docx
- **추천 인력**: Upwork 프리랜서 Shanikumar S. (Next.js + Supabase + Singpass)
- **예산**: Phase 1 $1,500-$2,500 (1-2주)
- **범위**: Push Notifications, Singpass 연동, 결제 통합

---

## 10. 변경 이력

| 날짜 | 작업 | 상태 |
|------|------|------|
| 2026-02-26 | Accept 버튼 404 수정, Available Jobs 정렬 수정, 잡 카드 UI 개선 | ✅ |
| 2026-02-26 | 홍보 콘텐츠 제작 (LinkedIn, Carousell) | ✅ |
| 2026-03-01 | pickup_regions.map 에러 수정 (toArray 헬퍼) | ✅ |
| 2026-03-01 | RFQ 폼 배열 저장 수정 | ✅ |
| 2026-03-02 | Admin 견적(Quote) 작성 기능 추가 | ✅ 프론트 / ⏳ DB |
| 2026-03-02 | 파일 업로드 타입 확장 (Excel, Word, CSV, PPTX) | ✅ |
| 2026-03-02 | CSP 수정 가이드 제공 | ⏳ |
| 2026-03-02 | 마스터 플랜 MD 문서 생성 | ✅ |
| 2026-03-02 | 이번 주 작업 우선순위 계획 수립 | ✅ |

---

*이 문서는 프로젝트 진행에 따라 지속적으로 업데이트됩니다.*
