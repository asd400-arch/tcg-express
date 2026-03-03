# TCG Express — QA 테스트 히스토리 & 테스트 시나리오

> **테스터**: 스캇 (Founder) — 모든 베타 테스트를 직접 수행  
> **방식**: 수동 E2E 테스트 (Client/Driver/Admin 역할 전환하며 전체 플로우 검증)  
> **베타 데이터**: 플랫폼의 모든 오더/비딩/트랜잭션은 스캇님의 테스트 데이터  
> **마지막 업데이트**: 2026-03-02

---

## Part 1: 테스트를 통해 발견 & 해결한 이슈 전체 로그

### 🔴 Critical — 서비스 중단급 버그

| # | 발견일 | 이슈 | 원인 | 해결 |
|---|--------|------|------|------|
| C1 | 02-22 | Hydration Error | 서버: 'Tech Chain Express', 클라이언트: 'TCG Express' 렌더링 불일치 | 전체 브랜딩 통일 |
| C2 | 02-22 | Beta 계정 시드 SQL 실패 | `is_ev_vehicle` 컬럼 미존재, 마이그레이션 미적용 상태에서 참조 | 마이그레이션 의존 컬럼 제거 |
| C3 | 02-22 | UUID 형식 에러 | `p0000000-...` 사용 (UUID는 hex만 허용, p는 불가) | `a0000000`, `b0000000` 등으로 수정 |
| C4 | 02-22 | Wallet INSERT 충돌 | 트리거가 자동 생성한 wallet과 시드 INSERT 충돌 | INSERT → UPDATE로 변경 |
| C5 | 02-26 | Accept 버튼 404 에러 | `instant-accept` API에서 `estimated_fare` 컬럼 참조 (DB에 없음) | `budget_min`/`budget_max`로 수정 |
| C6 | 02-26 | Available Jobs 최신 잡 누락 | `{ count: 'exact' }` 옵션 + 정렬 순서 문제 | count 옵션 제거, `created_at DESC` 통일 |
| C7 | 02-26 | Checkout 500 에러 | Stripe API key에 줄바꿈(`%0A`) 포함 | `.trim()` 적용 |
| C8 | 02-26 | WebSocket 연결 실패 | Supabase anon key에 줄바꿈 포함 | `.trim()` 적용 |
| C9 | 02-26 | CSRF Origin 차단 | Origin 검증이 Vercel 배포 URL 차단 | `*.vercel.app` 허용 + Origin 없는 경우 허용 |
| C10 | 02-26 | 6개 API 잘못된 테이블명 | Wallet 마이그레이션이 테이블명 변경했으나 API 미수정 | `express_wallets` → `wallets` 등 전체 수정 |
| C11 | 03-01 | `pickup_regions.map` 크래시 | RFQ에서 string 저장, Admin에서 `.map()` 호출 | `toArray()` 헬퍼 함수 추가 |
| C12 | 03-01 | 파일 업로드 거부 | Excel/Word 파일 MIME 타입 미허용 | 6개 Office 파일 타입 추가 |

### 🟠 Major — 기능 오작동

| # | 발견일 | 이슈 | 원인 | 해결 |
|---|--------|------|------|------|
| M1 | 02-22 | 5개 테이블 누락 | 코드가 참조하는 테이블이 DB에 미생성 | `master-fix-all-missing.sql` 실행 |
| M2 | 02-22 | `express_messages.receiver_id` 누락 | 코드는 `receiver_id` 사용, DB는 `recipient_id` | 컬럼 추가 + 백필 |
| M3 | 02-22 | `express_bids.message` 누락 | 비딩 메시지 컬럼 미존재 | 컬럼 추가 |
| M4 | 02-22 | express_jobs 타임스탬프 컬럼 누락 | `delivered_at`, `completed_at` 등 미존재 | 6개 컬럼 추가 |
| M5 | 02-22 | `wallets.bonus_balance` 미존재 | 월렛 topup에서 존재하지 않는 컬럼 참조 | `wallet_credit` RPC로 대체 |
| M6 | 02-22 | `wallets.points` 미존재 | 트랜잭션 release에서 참조 | `green_points_ledger` + `express_users.green_points_balance`로 대체 |
| M7 | 02-22 | Push subscriptions 컬럼 누락 | `type`, `expo_token`, `platform` 미존재 | 컬럼 추가, `p256dh`/`auth` nullable로 변경 |
| M8 | 02-22 | Realtime publication 누락 | 5개 테이블이 Supabase Realtime에 미등록 | publication에 추가 |
| M9 | 02-22 | promo_codes RLS 미설정 | anon key로 누구나 읽기/쓰기 가능 | RLS 활성화 |
| M10 | 02-22 | Driver wallet 정산 누락 | 배송 완료 시 `wallet_credit()` 미호출 | 정산 로직 추가 |
| M11 | 02-26 | Accept $null 표시 | `max_budget`이 null인 잡 | `budget_min` → `budget` → `estimated_fare` 폴백 체인 |
| M12 | 02-26 | 차량 필터링 역방향 | 오토바이 드라이버가 24ft 잡 수락 가능 | 차량 계층 구조 필터링 추가 |
| M13 | 02-26 | Bid API 차량 검증 누락 | Accept은 수정됐으나 Bid API에 검증 없음 | Bid 엔드포인트에도 차량 크기 검증 추가 |
| M14 | 02-26 | 고객 잔액부족 메시지가 드라이버에게 표시 | 드라이버 Accept에서 고객 월렛 체크 | 서버사이드로 이동, 클라이언트에만 에러 전달 |
| M15 | 02-26 | 서명 저장 실패 | Supabase Storage 버킷 미존재 또는 RLS 차단 | 버킷 생성 + 드라이버 업로드 권한 |
| M16 | 02-26 | 배송 완료 시 에러 | `delivered_at` 컬럼 누락 | 컬럼 추가 |
| M17 | 02-26 | Accept 버튼 최고가 표시 | `max_budget` 대신 `min_budget` 표시해야 함 | 최저가 기준으로 변경 |

### 🟡 Minor — UI/UX 개선

| # | 발견일 | 이슈 | 해결 |
|---|--------|------|------|
| U1 | 02-22 | 사이드바 미완성 기능 메뉴 노출 | 작동하는 기능만 표시하도록 정리 |
| U2 | 02-26 | 잡 카드에 Job ID만 표시 (드라이버에게 무의미) | 차량타입, 지역명, 시간, 금액 우선 표시로 재설계 |
| U3 | 02-26 | 우편번호 그대로 표시 | 싱가포르 우편번호 → 지역명 변환 함수 추가 |
| U4 | 02-26 | 모바일 헤더 겹침 | 콘텐츠 영역에 `padding-top` 추가 |
| U5 | 02-26 | 디버그 텍스트 노출 | "DB: X rows..." 텍스트 (아직 제거 안 됨) |
| U6 | 03-01 | CSP 경고 | Google Fonts, Stripe JS 차단 (가이드 제공, 미적용) |
| U7 | 02-26 | Express 잡이 Standard 위에 정렬 | `created_at DESC` 단일 정렬로 통일 |

### 🔵 기능 구현 이력

| # | 날짜 | 기능 | 상태 |
|---|------|------|------|
| F1 | 02-11 | 전체 플랫폼 HTML 프로토타입 (고객/디스패처/드라이버) | ✅ |
| F2 | 02-11 | Admin 페이지, About 드롭다운 리구조화 | ✅ |
| F3 | 02-22 | MVP 범위 확정 (40개→15개 기능으로 축소) | ✅ |
| F4 | 02-22 | T&C 체크박스 (고객/드라이버 가입) | ✅ |
| F5 | 02-22 | Wallet + PayNow 결제 시스템 | ✅ |
| F6 | 02-22 | 차량 L×W×H 매칭 | ✅ |
| F7 | 02-22 | 방어적 코딩 (트랜잭션 원자성, 이중클릭 방지) | ✅ |
| F8 | 02-22 | 보안 강화 (RLS, 입력검증, CSRF) | ✅ |
| F9 | 02-22 | Geo-fencing 실적용 | ✅ |
| F10 | 02-22 | Corp Premium 드라이버 UI | ✅ |
| F11 | 02-22 | 로고 브랜딩 통일 | ✅ |
| F12 | 02-22 | 20ft/40ft Trailer 차량 추가 | ✅ |
| F13 | 02-22 | 폼 검증 (빨간 에러 표시) | ✅ |
| F14 | 02-26 | 드라이버 잡 카드 UI 통일 | ✅ |
| F15 | 02-26 | 홍보 콘텐츠 (LinkedIn, Carousell) | ✅ |
| F16 | 02-26 | Wallet-only 결제 (Stripe 우회) | ✅ |
| F17 | 02-26 | POD 전자서명 + PDF 인보이스 | ⚠️ 서명 저장 이슈 |
| F18 | 03-01 | Admin 견적(Quote) 작성 기능 | ✅ 프론트 / ⏳ DB |
| F19 | 03-02 | Client 견적 수신/수락/거절 UI | ✅ 코드 완료 |
| F20 | 03-02 | 파일 업로드 타입 확장 | ✅ |

---

## Part 2: 미해결 이슈 (현재 남아있는 문제)

| # | 이슈 | 심각도 | 비고 |
|---|------|--------|------|
| O1 | Push Notifications 미작동 | 🔴 | VAPID 키/Service Worker/구독 저장 전체 점검 필요 |
| O2 | 서명 저장 에러 | 🟠 | Storage 버킷 또는 RLS 문제 가능 |
| O3 | CSP 경고 | 🟡 | Google Fonts, Stripe JS 차단 |
| O4 | 디버그 텍스트 노출 | 🟡 | "DB: X rows..." 제거 필요 |
| O5 | Stripe 계정 제한 | 🟠 | Review 제출 필요, HitPay 대안 검토 중 |
| O6 | Dispute Resolution | 🟡 | 미테스트 |
| O7 | admin_quote DB 컬럼 미추가 | 🟠 | SQL 실행 대기 중 |
| O8 | upload-route.js 미배포 | 🔴 | Excel 업로드 에러 지속 (파일 덮어쓰기 필요) |

---

## Part 3: 체계적 테스트 시나리오

> 각 시나리오는 실제 비즈니스 플로우를 따름
> ✅ = 테스트 통과 / ❌ = 실패 / ⏳ = 미테스트

### Scenario 1: Spot Delivery 전체 플로우 (핵심)

```
[Client] 로그인
  └→ New Delivery 클릭
     └→ 1-1. 필수 입력값 빈칸 제출 → 빨간 에러 표시되는가?      ⏳
        1-2. 픽업 주소 입력 + 배송 주소 입력                     ⏳
        1-3. 차량 타입 선택 + 무게 입력                          ⏳
        1-4. STANDARD/EXPRESS 선택                              ⏳
        1-5. 예산 범위 설정 ($min - $max)                        ⏳
        1-6. 제출 → 잡 생성 확인                                 ⏳

[Driver] 로그인
  └→ Available Jobs
     └→ 2-1. 방금 생성한 잡이 목록에 보이는가?                   ⏳
        2-2. 차량 타입 필터링: 오토바이 드라이버에게 Van 잡 안 보이는가? ⏳
        2-3. 잡 카드에 차량타입, 지역명, 금액, 시간 표시되는가?    ⏳
        2-4. Accept $XXX 클릭 → 최저가(min_budget) 기준인가?     ⏳
        2-5. Accept 성공 → 잡 status가 'assigned'로 변경되는가?   ⏳

[Driver] 배송 진행
  └→ My Jobs
     └→ 3-1. 배정된 잡이 My Jobs에 보이는가?                     ⏳
        3-2. "Start Pickup" 클릭 → status: in_progress           ⏳
        3-3. 픽업 사진 업로드 가능한가?                           ⏳
        3-4. "Picked Up" 확인                                    ⏳
        3-5. "Start Delivery" → 배송 시작                        ⏳
        3-6. "Mark Delivered" → 서명 패드 뜨는가?                 ⏳
        3-7. 서명 완료 → 저장 성공하는가?                         ⏳
        3-8. 배송 완료 → status: completed                       ⏳

[Client] 배송 확인
  └→ 4-1. 배송 완료 알림 수신하는가? (push/인앱)                  ⏳
     4-2. 배송 상세에서 서명 이미지 보이는가?                     ⏳
     4-3. PDF 인보이스 다운로드 가능한가?                         ⏳
     4-4. 드라이버 리뷰 작성 가능한가?                           ⏳

[정산]
  └→ 5-1. 고객 월렛에서 금액 차감되었는가?                       ⏳
     5-2. 드라이버 월렛에 수익 입금되었는가?                     ⏳
     5-3. 플랫폼 수수료가 정확한가?                              ⏳
```

### Scenario 2: Bidding 플로우

```
[Client] 잡 생성 (예산 범위: $100-$200)

[Driver A] 
  └→ 6-1. Bid $120 제출                                         ⏳
     6-2. 비딩 확인 메시지 표시되는가?                            ⏳

[Driver B]
  └→ 6-3. Bid $150 제출                                         ⏳

[Client]
  └→ 6-4. 비딩 목록에 두 건 모두 보이는가?                       ⏳
     6-5. Driver A 비딩 Accept → 성공하는가?                     ⏳
     6-6. Driver B 비딩 → 자동 rejected 되는가?                  ⏳
     6-7. 월렛 잔액 충분한가? 부족 시 메시지 표시?                ⏳
```

### Scenario 3: Corp Premium RFQ → 견적 → 수락

```
[Client]
  └→ RFQ 탭
     └→ 7-1. 프로젝트 제목, 설명, 기간 입력                     ⏳
        7-2. 차량 타입, 지역, 볼륨 입력                          ⏳
        7-3. 파일 첨부 (Excel .xlsx) → 업로드 성공?               ⏳
        7-4. 파일 첨부 (PDF) → 업로드 성공?                       ⏳
        7-5. NDA 동의 체크                                       ⏳
        7-6. 제출 → 성공 토스트                                  ⏳

[Admin]
  └→ Corp Premium 페이지
     └→ 8-1. 새 RFQ가 목록에 보이는가?                           ⏳
        8-2. 상세 펼치기 → 첨부파일 다운로드 가능?                ⏳
        8-3. "Mark Under Review" 클릭 → 상태 변경?               ⏳
        8-4. 견적 작성 (Monthly Rate, Per Delivery, Setup Fee)   ⏳
        8-5. Line Items 추가/삭제                                ⏳
        8-6. "Send Quote" → 상태: quote_sent                    ⏳

[Client]
  └→ Tracking 탭
     └→ 9-1. 견적 카드가 보이는가?                               ⏳
        9-2. 금액, 유효기간, 결제조건 표시?                       ⏳
        9-3. "Accept" 클릭 → 상태: accepted                     ⏳
        9-4. "Decline" 클릭 → 사유 입력 모달 → 상태: rejected    ⏳
```

### Scenario 4: Wallet & Payment

```
[Client]
  └→ 10-1. Wallet 페이지 접속 → 잔액 표시?                      ⏳
     10-2. Top Up 클릭 → PayNow QR 표시?                        ⏳
     10-3. 카드 결제 → "Card payments coming soon" 표시?          ⏳
     10-4. 잔액 부족 상태에서 Bid Accept → 에러 메시지?           ⏳
     10-5. 충전 후 Bid Accept → 성공?                            ⏳

[Driver]
  └→ 11-1. Earnings 페이지 → 수익 내역 표시?                     ⏳
     11-2. 출금 요청 → 처리?                                     ⏳
```

### Scenario 5: 차량 타입 검증

```
차량 계층: motorcycle < car < 1.7m_van < 2.4m_van < 10ft_lorry < 14ft_lorry < 24ft_lorry

[Motorcycle Driver]
  └→ 12-1. motorcycle 잡 보이는가?                               ⏳
     12-2. car 잡 안 보이는가?                                   ⏳
     12-3. van 잡에 Bid 시도 → 서버 거부?                        ⏳

[2.4m Van Driver]
  └→ 12-4. motorcycle, car, 1.7m_van, 2.4m_van 잡 보이는가?     ⏳
     12-5. 10ft_lorry 잡 안 보이는가?                            ⏳

[24ft Lorry Driver]
  └→ 12-6. 모든 잡 보이는가?                                     ⏳
```

### Scenario 6: Edge Cases & 방어 테스트

```
[이중 클릭 방지]
  └→ 13-1. Accept 버튼 빠르게 2번 클릭 → 1번만 처리?            ⏳
     13-2. Bid 제출 빠르게 2번 → 1건만 생성?                     ⏳
     13-3. 결제 버튼 2번 → 1번만 차감?                           ⏳

[잘못된 입력]
  └→ 14-1. 예산 $0 또는 음수 → 거부?                            ⏳
     14-2. 빈 주소로 잡 생성 → 거부?                             ⏳
     14-3. 50MB 파일 업로드 → 용량 초과 에러?                    ⏳

[동시성]
  └→ 15-1. 2명 드라이버가 동시에 같은 잡 Accept → 1명만 성공?    ⏳
     15-2. 잡 Accept 중 고객이 잡 취소 → 적절한 처리?            ⏳

[네트워크]
  └→ 16-1. 서명 저장 중 네트워크 끊김 → 재시도 가능?             ⏳
     16-2. 결제 중 네트워크 끊김 → 이중 결제 방지?               ⏳
```

### Scenario 7: 모바일 반응형

```
[375px 모바일]
  └→ 17-1. 로그인 폼 → 레이아웃 정상?                           ⏳
     17-2. 잡 카드 → 텍스트 잘림 없이 표시?                      ⏳
     17-3. 서명 패드 → 터치로 서명 가능?                         ⏳
     17-4. 사이드바 → 햄버거 메뉴 작동?                          ⏳
     17-5. 파일 업로드 → 카메라/갤러리 선택?                     ⏳
     17-6. 헤더에 콘텐츠 가려지지 않는가?                        ⏳

[태블릿 768px]
  └→ 17-7. 2컬럼 레이아웃 정상?                                  ⏳

[데스크탑 1280px+]
  └→ 17-8. 사이드바 + 메인 영역 정상?                            ⏳
```

### Scenario 8: Admin 기능

```
[Admin]
  └→ 18-1. 대시보드 → 전체 잡 수, 매출, 드라이버 수 표시?        ⏳
     18-2. 유저 목록 → Client/Driver 필터링?                     ⏳
     18-3. 잡 상세 → 상태 변경 가능?                             ⏳
     18-4. Corp Premium → RFQ 목록 + 견적 전송?                  ⏳
     18-5. Wallet → PayNow 충전 확인 승인?                       ⏳
     18-6. 출금 요청 승인/거절?                                   ⏳
```

---

## Part 4: 테스트 실행 가이드

### 테스트 계정

| 역할 | 이메일 | 비고 |
|------|--------|------|
| Admin | (실제 admin 계정) | 전체 관리 |
| Client (Beta) | 시드 데이터 계정 | 잡 생성/결제 |
| Driver (Beta) | 시드 데이터 계정 | 잡 수락/배송 |

### 테스트 순서 (권장)

```
1차: Scenario 1 (Spot Delivery 전체 플로우) — 가장 중요
2차: Scenario 3 (Corp Premium RFQ) — 이번 주 신규 기능
3차: Scenario 4 (Wallet Payment)
4차: Scenario 5 (차량 필터링)
5차: Scenario 2 (Bidding)
6차: Scenario 6 (Edge Cases)
7차: Scenario 7 (모바일)
8차: Scenario 8 (Admin)
```

### 테스트 결과 기록 방법

각 항목을 테스트하면서:
- ✅ 통과 → 날짜와 함께 체크
- ❌ 실패 → 에러 스크린샷 + 콘솔 로그 저장
- 실패 항목은 Claude에게 스크린샷과 함께 공유하면 즉시 수정

---

## Part 5: 앞으로의 테스트 전략

### 배포 전 체크리스트 (매번)

```
□ npm run build 에러 0개
□ Scenario 1의 1-1 ~ 5-3 전체 통과
□ 모바일(375px)에서 주요 화면 확인
□ 콘솔에 빨간 에러 없음
□ 네트워크 탭에서 500 에러 없음
```

### 주간 회귀 테스트

```
매주 금요일:
□ Scenario 1 전체 재실행
□ Scenario 3 (Corp Premium) 재실행
□ Scenario 7 모바일 체크
□ 발견된 이슈 마스터 플랜에 기록
```

### 신규 기능 테스트

```
새 기능 배포 시:
1. 해당 기능 시나리오 실행
2. Scenario 1 (핵심 플로우) 회귀 테스트
3. 모바일 확인
4. Edge case 1개 이상 테스트
```
