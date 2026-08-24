# 정산 구조 점검 + PayNow 자동 크레딧 구현 (2026-08-24)

## 1부. 법인명 변경(HHI Solutions → Tech Chain Global) 점검 결과

### 코드에서 발견·수정한 곳 (3곳)

| 파일 | 내용 | 조치 |
|---|---|---|
| `lib/paynow-qr.js` | PayNow QR의 상호명 필드(59)가 `HHI Solutions Pte Ltd` — **고객 은행앱에 표시되는 이름** | `Tech Chain Global Pte Ltd`로 수정 (정확히 25자 = EMVCo 한도) |
| `lib/paynow.ts` | `COMPANY_NAME: 'HHI SOLUTIONS PTE LTD'` | `TECH CHAIN GLOBAL PTE LTD`로 수정 |
| `lib/walletService.ts` | 충전 화면에 보여주는 `recipient_name: 'HHI Solutions Pte Ltd'` | `Tech Chain Global Pte Ltd`로 수정 |

이미 올바른 곳: 인보이스(`lib/generate-invoice.js`)는 이미 "TCG Express — Tech Chain Global Pte Ltd", 이메일 도메인·앱 링크는 techchainglobal.com. **UEN(202005872W)은 법인명 변경과 무관하게 그대로**이므로 QR 자체는 계속 유효합니다.

### 코드 밖에서 스캇님이 확인할 것

1. **은행 PayNow 등록 명의**: ACRA 변경 후 은행이 PayNow 레지스트리의 표시명을 갱신했는지 — 본인 은행앱에서 UEN 202005872W로 송금 시도해 수취인 이름이 "TECH CHAIN GLOBAL"로 뜨는지 확인. (아직 HHI로 나오면 은행에 갱신 요청)
2. **Stripe 계정**: Dashboard → Settings → Business details의 법인명과 statement descriptor가 Tech Chain Global인지.
3. 약관/개인정보처리방침 페이지에 HHI 표기가 남아 있는지 (이번 점검 파일 범위 밖 — 앱에서 페이지 열어 확인).

## 2부. PayNow 자동 크레딧 (어드민 확인 제거)

### 왜 기존 방식으론 자동화가 불가능한가

기존 흐름은 고객이 **회사 UEN으로 직접 은행 이체**하는 방식입니다. 일반 은행 이체는 앱에 입금 알림(웹훅)을 보내줄 방법이 없어서, 어드민이 은행 내역을 보고 수동 확인하는 단계가 필수였습니다.

### 구현한 방식: Stripe PayNow

Stripe(이미 카드 결제로 연동돼 있음)가 싱가포르 PayNow를 지원합니다. 새 흐름:

1. 고객이 충전 금액 선택 → 서버가 Stripe에 PayNow 결제 생성 → **Stripe가 발급한 PayNow QR**을 기존과 똑같은 화면에 표시
2. 고객이 아무 은행앱으로 스캔·결제
3. Stripe가 즉시 웹훅(`payment_intent.succeeded`)을 호출 → **서버가 자동으로 지갑 크레딧 + 보너스($500→+$25, $1000→+$75) 지급** → 화면이 3초 이내 "충전 완료"로 자동 전환
4. 어드민 개입 없음

Stripe가 미설정이거나 PayNow가 활성화 안 된 경우엔 **기존 수동 방식으로 자동 폴백**되므로, 배포해도 지금 당장 아무것도 깨지지 않습니다.

### 수정·추가된 파일

| 파일 | 변경 |
|---|---|
| `lib/walletService.ts` | `createStripePayNowTopup`(자동 QR 생성), `completeStripeTopup`(웹훅 크레딧), `applyTopupBonus`(보너스 로직 공통화 — 기존엔 카드 충전 시 보너스가 누락되는 버그가 있었는데 함께 해결, 중복 지급 방지 가드 포함) |
| `app/api/wallet/topup/route.ts` | POST: Stripe 가능 시 자동 모드, 실패 시 수동 폴백. GET 추가: 클라이언트가 충전 상태를 폴링해 자동 완료 감지 |
| `app/api/payment/stripe-webhook/route.ts` | 지갑 충전 자동 크레딧 + 보너스, 이벤트 중복 처리 방지(잡 결제 웹훅과 충돌 안 나게 네임스페이스 분리), 실패/취소 처리 |
| `app/components/wallet/TopupModal.tsx` | 자동 모드 UI: "결제 즉시 자동 충전" 안내, 대기 표시, 완료 자동 감지. 수동 폴백 시 기존 화면 유지 |
| `types/wallet.ts` | auto/manual 모드 타입 추가 |
| `sql/2026-08-24-paynow-auto-credit.sql` | **새 파일** — 웹훅 중복방지 테이블(기존 코드가 참조하는데 실제로 없었음) + 조회 인덱스 2개 |
| `.env.example` | STRIPE 환경변수 문서화 |

### 활성화하려면 스캇님이 할 일 (순서대로)

1. **Supabase SQL Editor**에서 `sql/2026-08-24-paynow-auto-credit.sql` 실행 (1회, 재실행해도 안전)
2. **Stripe Dashboard** → Settings → Payment methods에서 **PayNow 활성화** (싱가포르 법인 계정이면 신청 가능)
3. Stripe Dashboard → Developers → **Webhooks**에 엔드포인트 추가:
   - URL: `https://<앱도메인>/api/payment/stripe-webhook`
   - 이벤트: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`
   - 발급된 signing secret을 복사
4. **Vercel** → 프로젝트 환경변수에 `STRIPE_SECRET_KEY`(live 키), `STRIPE_WEBHOOK_SECRET`(3번의 secret) 설정 후 재배포
5. **테스트**: $10 소액 충전 → 본인 은행앱 스캔 → 몇 초 내 자동 충전 확인

### 알아둘 점

- **수수료**: Stripe PayNow는 건당 약 1.3% (직접 이체는 무료였음). $100 충전 시 약 $1.30이 Stripe 수수료로 빠지고, 정산은 Stripe 잔액 → 회사 은행계좌로 들어옵니다. 최신 요율은 stripe.com/en-sg/pricing에서 확인.
- **고객 은행앱 표시**: Stripe QR은 Stripe의 수취 계정으로 들어가므로 은행앱에 "STRIPE PAYMENTS SINGAPORE" 류로 표시될 수 있습니다. 앱 화면에는 "TCG Express (via Stripe)"로 안내하도록 해뒀습니다.
- **어드민 확인 화면은 유지**: 수동 폴백 건과 과거 pending 건 처리용으로 그대로 둡니다. 자동 건은 어드민 목록에 이미 completed로 표시됩니다.
- 환경변수를 넣기 전까지는(1~4 미완료) 앱은 지금과 100% 동일하게 동작합니다.

---

## 추가 확인 (같은 날, 이메일 근거)

- **Stripe: 계정 폐쇄 확정.** 2026-02-21 "high level of risk" 사유로 결제 수취 중단 통보(계정 acct_1T2SHY39y5eEH8fe), 2026-02-23 "will remain closed" 최종 통보. 위 2부의 Stripe 활성화 절차(②③④)는 **보류** — 코드는 Stripe 미설정 시 기존 수동 방식으로 동작하므로 앱에는 영향 없음.
- **HitPay: 가입 반려.** 2026-05-10 "internal policies, risk or regulatory considerations" (상세 사유 비공개, compliance@hit-pay.com).
- 두 곳 모두 반려된 정황상 지갑 충전(선불 잔액)+마켓플레이스 정산 모델이 고위험으로 분류된 것으로 추정. 자동 크레딧은 PSP 없이 가능한 대안(은행 입금 알림 기반 자동 대사)을 검토 중.

---

## 3부. PSP 없이 가는 자동 크레딧: 은행 알림 자동 대사 (채택안)

Stripe·HitPay 반려로 PSP 경로가 막혀, **회사 UEN 직접 수취(수수료 0, 심사 불필요)를 유지하면서 확인만 자동화**하는 방식으로 전환. 스캇님 승인 (2026-08-24).

### 동작 방식

1. 고객이 $50 충전 요청 → 서버가 **고유 센트 금액** 배정 (예: $50.07 — 동시 대기 건과 절대 겹치지 않음) → QR은 이 금액으로 고정(금액 수정 불가 플래그)
2. 고객이 은행앱으로 정확히 $50.07 이체 → 고객 지갑에는 $50.07 그대로 충전 (손해 없음)
3. 법인 계좌의 **입금 알림 이메일** → 전달 스크립트가 금액을 파싱해 앱의 `/api/wallet/paynow-incoming` 호출 (시크릿 인증)
4. 서버가 금액이 정확히 일치하는 대기 건 1건을 찾아 **자동 크레딧 + 보너스 지급** → 충전 화면이 폴링으로 자동 "완료" 전환
5. 어드민 개입 없음. 매칭이 모호하거나 실패한 건만 기존 어드민 화면에 남음 (안전망 유지)

### 이번에 추가·수정된 코드

| 파일 | 변경 |
|---|---|
| `lib/walletService.ts` | `pickUniqueTopupAmount`(고유 센트 배정), `autoConfirmTopupByAmount`(입금 알림 자동 매칭·크레딧·보너스) |
| `lib/paynow-qr.js` | QR 금액 수정불가 플래그(03=0) — 정확 금액 매칭의 전제 |
| `app/api/wallet/paynow-incoming/route.ts` | **새 파일** — 입금 알림 수신 엔드포인트 (Bearer 시크릿 인증) |
| `app/components/wallet/TopupModal.tsx` | "표시된 정확한 금액으로 이체" 안내, 수동 모드에서도 5초 폴링으로 자동 완료 감지 |
| `.env.example` | `PAYNOW_ALERT_SECRET` 추가 |

### 활성화에 필요한 것 (스캇님)

1. **법인 계좌 은행이 어디인지** 알려주기 (DBS/OCBC/UOB/기타)
2. 그 은행의 기업 인터넷뱅킹에서 **입금 건별 이메일 알림**을 admin@techchainglobal.com 으로 켜기 (은행별 메뉴 위치는 은행 확인 후 안내)
3. 알림이 켜지면 **소액 테스트 이체 1건** — 알림 이메일의 실제 형식을 보고 전달 스크립트(파서)를 만들어 연결 (개발은 제가)
4. Vercel 환경변수 `PAYNOW_ALERT_SECRET` 설정 (아무 긴 무작위 문자열)

전달 스크립트는 Gmail에 도착한 은행 알림을 1분 간격으로 읽어 앱에 전달하는 Google Apps Script로 제공 예정 — 별도 서버 불필요, 무료.

### 참고

- 2부의 Stripe 코드는 그대로 두지만(향후 PSP 승인 시 즉시 사용 가능) 현재는 항상 수동+자동대사 경로로 동작.
- 입금 알림이 늦게 오는 경우를 위해 QR 만료 후 10분까지는 매칭 허용. 그 이후 도착분은 어드민 수동 확인으로 처리.
