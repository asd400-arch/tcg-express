# TCG Express — 진행 기록 (PROGRESS)

> **이 파일의 목적**: 새 채팅창을 열었을 때 이 파일 하나만 읽으면 바로 이어서 작업할 수 있게 하는 것.
> **갱신 규칙**: 매일 작업 종료 시 `## 날짜별 기록` 맨 위에 그날 항목을 추가한다. 상단 요약(현재 상태·열린 결정)은 변경된 것만 덮어쓴다.
> 마지막 갱신: **2026-08-29 (토) 13:05 SGT**

---

## 0. 30초 브리핑 (새 세션은 여기부터)

| 항목 | 값 |
|---|---|
| 회사 | Tech Chain Global Pte Ltd (UEN 202005872W) |
| 서비스 | TCG Express — 싱가포르 B2B IT 장비 배송 마켓플레이스 |
| **런칭일** | **2026년 9월 1일 (화)** |
| 오늘 기준 | 2026-08-29 (토) = **D-3** |
| 대표 | Scott (대외 발송물은 성 없이 "Scott". 법인/은행/계약 문서만 "Scott Park") |
| 웹 | https://app.techchainglobal.com · https://techchainglobal.com |
| 업무 메일 | admin@techchainglobal.com |

**지금 이 트랙에서 하는 일**: 앱 출시 마무리 · 인쇄/차량 랩핑 발주 준비 · 프로모터 15명 채용 · 런칭 마케팅.

---

## 1. 워크스트림 경계 (중요 — 섞지 말 것)

이 저장소/이 세션이 담당하는 것은 **TCG Express 런칭 트랙 하나뿐**이다.

| 트랙 | 담당 | 이 세션에서 |
|---|---|---|
| TCG Express 런칭 (앱·인쇄·프로모터·마케팅·총판 콜드메일) | **이 세션** | 담당 |
| 창고 캐파 마켓플레이스 (창고업체 콜드메일) | 별도 세션 | **열람·보고 금지** |
| Store Hand / Warehouse Assistant 채용 (MCF-2026-1422561, 지원자, WhatsApp 후보 연락) | 별도 세션 | **열람·응대·보고 금지** |

프로모터 채용(MCF-2026-1509996)은 **이 트랙**이 맞다. Store Hand 채용과 혼동하지 말 것.

---

## 2. 현재 상태 보드

### 앱 출시
| 항목 | 상태 |
|---|---|
| iOS 1.0.4 (빌드 10) | **심사 대기** — 8/28 15:21 SGT 제출. 24~48시간 예상 → 8/29~8/30 결과 |
| iOS 앱 이름 오타 수정 | 1.0.4에 포함. 승인되면 App Store 표기가 "TCG Express"인지 확인 |
| Play 14일 클로즈드 테스트 | 완료 |
| Play 프로덕션 액세스 신청 | **심사 대기** — 8/28 14:25 신청, 최대 7일 (→ 9/4까지) |
| Play 프로덕션 릴리즈 | 액세스 승인 후 생성·제출 필요 |

> Play 승인 후 할 일: 스토어 링크를 `app/preview/page.js`의 `PLAY_STORE_URL`, `app/api/admin/launch-email/route.js`의 `PLAY_STORE`에 삽입.

### 인쇄 · 차량 랩핑
| 항목 | 상태 |
|---|---|
| 5개 업체 패키지 견적 (배너·티셔츠·차량 데칼·전단) | **회신 대기 — 마감 8/31(월)** |
| Lim Sign 무광 vs 반광 확인 | **미회신** → 배너 발주 결정이 여기에 막혀 있음 |
| CustomPrint 뒷면 최대 인쇄 크기 + 화이트 언더베이스 | **8/19부터 미회신** |
| 차량 데칼 수량 | 로리 옆면 + 밴 10세트 (확정) |
| 전단 | 2,000장 / 약 S$179 (확정) |
| 프로모터 배지 | 이름 확보 필요 → **9/4까지** 확보해야 9/10 납품 |

> **발주는 스캇님이 직접.** 이 세션은 비교표 작성·추천까지만.

### 프로모터 채용 (목표 15명)
| 채널 | 상태 |
|---|---|
| MyCareersFuture **MCF-2026-1509996** | 게재 완료 (8/28). 15 vacancies, S$400–1,200/월 표기(실제 S$12/시 + 건당 S$2), 9/27 자동 마감 |
| Carousell 프로모터 공고 | 게재 중 |
| LinkedIn / Facebook 페이지 채용 글 | 문안 작성 완료, **스캇님이 보류** |
| 확보 인원 | **0 / 15** |

조건: S$12/시 + 사인업 건당 S$2, 4시간 교대, 주급 PayNow, 무경험 가능, 콜드셀링 없음.

### 마케팅 자산 (제작 완료)
- `public/og/driver-poster.jpg` — 드라이버 모집 1200×1200
- `marketing/launch-card-1080.png`, `marketing/launch-card-1200x627.png` — 런칭데이 SNS 카드
- `marketing/promoter-hiring-1080.png` — 프로모터 채용 카드
- `public/artwork/TCG-Express-promoter-kit.pdf` — 프로모터 운영 키트 3p
- `public/artwork/TCG-Express-one-pager.pdf` — 총판용 영업 자료 1p

### 기타 열린 항목
- DBS 계좌명이 아직 **HHI SOLUTIONS** → 변경 완료되면 `lib/paynow-qr.js`의 field('59')와 `lib/walletService.ts`의 `recipient_name` 수정
- Facebook 페이지 링크 오타: techc**ah**inglobal.com → techc**ha**inglobal.com
- Sim Lim Square 홍보 공간 회신 미발송
- 사전등록 수 **1명**에서 정체
- 총판 콜드메일 — ADV Security가 1순위 리드

---

## 3. 열린 결정 (스캇님 몫)

1. 인쇄 패키지 최종 업체 선정 및 **발주** (8/31 견적 도착 후)
2. Lim Sign 마감 회신 도착 시 배너 발주 여부
3. LinkedIn / Facebook 채용 글 게재 여부 (현재 보류)
4. 프로모터 채용 확정 (면접·오퍼)
5. 송금·광고비 집행·계약

> 이 세션은 발주·송금·채용 확정·계약을 **대신 실행하지 않는다.** 준비·비교·초안까지.

---

## 4. 날짜별 기록

### 2026-08-29 (토) — D-3
- **Alibaba Printing 상태 확인**: 8/26·8/26·8/27 3회 발송, **3일간 무응답**. 8/28 5개사 패키지 입찰(Kiasu·CustomPrint·Lim Sign·Raffles Tag·Fatty Print)에는 **포함되지 않았음**. 오늘 확정 수량 전체 패키지 RFQ를 재발송(월 31일 마감, "입찰 불가면 한 줄만 회신" 포함).
- **링크 문제 원인 확정**: 발송 메일의 아트워크 링크가 전부 `google.com/url?q=...` 로 재작성되고 있었음. Dekawrap(Betty)·VWrap(Yik Khoon)·Fatty Print 모두 "열리지 않는다"고 회신. → **프로토콜 없이 `app.techchainglobal.com/artwork/x.pdf` 형태로만 발송할 것.** 오늘 발송분부터 적용.
- **Fatty Print(Ginnie) 회신 처리**: A5 전단 2,000장 익스프레스 **$219+GST**(일반 $179), 월 31일 11am까지 아트워크 → 9/2 오후 납품. 아트워크 최종본 안내 + 밴 데칼 치수 회신 완료. 주문 확정은 월요일 비교 후라고 명시.
- **밴 데칼 모듈 치수 확정**(아트워크 PDF에서 실측): 면당 5피스 — 로고바 1000×280 / 스트립 1000×150 ×3 / 정사각 350×350. 면당 약 0.85㎡, 밴 10대 양면 = 100피스 / 약 17㎡.
- **프로모터 스크리닝 키트 제작**: 6항목 100점 배점표 + 5분 전화 스크립트 PDF, 30명분 자동채점 XLSX. `marketing/`에 저장. 성별·연령 항목 없음(TAFEP 리스크 회피).
- MCF 지원자 확인은 **포털 로그인 만료로 대기 중**. 지원 메일(admin@)은 현재 0건.
- 진행상황 일자별 기록(`PROGRESS.md`)을 저장소에 생성.
- 매일 09:00 SGT 정기 점검 작업의 프롬프트를 전면 개편: 3개 트랙 경계 명시, Gmail 점검 섹션, 프로모터 채용 섹션, 상태 보드, 보고 포맷.
- 메모리에 워크스트림 경계 2 기록: Store Hand 채용 트랙은 별도 세션 담당.
- **견적 리마인드 3건 발송**: Raffles Tag(랜야드 단가·배지 20세트 총액·배너 4/6개+무광), CustomPrint(8/19에 이미 답변된 건을 재질문한 것 정정+사과, 50장 가격, A3 제약 대안, 9/10 납기 가능 여부), Kiasu(배너 하드웨어·무광 재확인·배송비 상충·납기 상충, 전단은 타사로 간다고 통보).
- **중간 견적 비교표 작성** → `marketing/TCG-Express-print-quote-comparison.xlsx` (품목별 비교 / 결정 요약 / 미회신 추적 3시트).
- **기록 정정 2건**: (1) Lim Sign 무광은 미회신이 아니라 8/26에 "세미글로시, 100% 무광 아님"으로 **답변 완료**. (2) CustomPrint 뒷면 최대크기·화이트언더베이스도 8/19에 **답변 완료** — 최대 A3(279×356mm), 언더베이스는 $12.90/장에 포함. 우리 디자인 280×400mm는 A3 초과.
- **건당 지급 리퍼럴 파트너 트랙 제안서 작성** → `marketing/TCG-Express-referral-partner-proposal.pdf`. 시급 없음, 테크 기업 대상. 다운로드가 아니라 (1)검증된 비즈니스 가입 (2)첫 유료 배송 2단계 지급. 권장안 S$15+S$35. 고용계약 아닌 독립 리퍼럴 계약으로 구성해야 하며 MCF 게재 부적합(급여범위 필수). 변호사 검토 필요.
- **리퍼럴 파트너 요율 C안 확정** (스캇님 승인): 검증 가입 S$20 + 첫 유료배송 S$50 = 계정당 최대 S$70. 드라이버를 1차 파트너 채널로 운영하는 방식도 승인.
- **드라이버 활성화 프로모션 신설** (스캇님 지시): 등록·검증 S$20(9/7 마감) + 첫 배송 S$30(9/14 마감). 기존 5건 웰컴보너스 S$50과 중첩 → 첫 5건에 최대 S$100 + 30일 0% 커미션. 유효 배송 게이트 6종(무관 UEN 사업자 계정, 앱 POD, 2km 이상, 기기·번호 중복 배제, 14일 무취소, 14일 후 지급) 설계.
- **30일 인센티브 예산 모델** → `marketing/TCG-Express-launch-incentive-budget.xlsx`. 기본 가정 기준 총 S$9,846. **이 중 프로모터 시급 S$5,760(58%)이 성과와 무관하게 나가는 고정비** — 성과연동 변동비는 S$4,086.
- **중복 지급 구조 확인**: 배송 1건이 파트너 S$50 + 드라이버 S$30을 동시에 발동 가능(의도된 결과). 단 드라이버가 본인 코드로 소개한 계정의 주문을 본인이 배송하는 자기거래는 하나만 지급하도록 예외 필요.
- **발송 문안 4종 작성** → `marketing/launch-messages.md` (드라이버 활성화 공지 / 미등록 리마인더 / 파트너 모집 / 파트너 등록 확인). 발송 전 승인 필요.
- **프로모터 8명으로 시작 확정** (2주 성과 확인 후 15명까지 증원). 총 예산 S$10,024 → **S$7,000**, 고정비 비중 57% → **44%**. 확보 예상 계정 400 → 232, 계정당 획득비용 S$25.1 → S$30.2.
- **기존 검증 드라이버 처리 확정**: 같은 S$20을 'Thank you for waiting'(대기 감사금)으로 지급. 신규는 'Verification bonus'. 발송 문안도 분리(문안 5번).
- **파트너 계약서 초안 작성** → `marketing/TCG-Express-referral-partner-agreement-DRAFT.docx`. 10개 조항(독립계약자 지위, 사전 회사 등록·14일 영역락, 커미션 2단계, 미지급 사유, PDPA 준수 행동규칙, 기밀유지, 정지·해지, 면책, 싱가포르 준거법) + 마지막 장에 **변호사에게 물을 질문 7개**. ⚠️ 변호사 검토 전 배포 금지.
- **DB 마이그레이션 작성** → `supabase/migrations/20260901000000_partner_referral_and_driver_activation.sql`. 신규 테이블 4개(referral_partners / partner_company_claims / partner_commissions / driver_activation_bonuses), 자기거래 감시 뷰, 주간 지급 뷰, RLS(service_role 전용), `generate_partner_code()`. **아직 실행 안 함 — 스캇님 검토 필요.** 기존 `express_users.referral_code`(TCG-XXXX)와 `referral_rewards`는 건드리지 않음.
- 미확인: 드라이버 40명 중 실제 검증 완료 인원. SQL 파일 SECTION 0에 조회 쿼리 넣어둠.
- iOS 심사 결과 대기 중, Play 프로덕션 액세스 심사 대기 중.

### 2026-08-28 (금) — D-4
- **Carousell**: 코인 충전 후 드라이버 모집 공고 게재·활성화(1,000코인 = 공고 1건 / 90일). 추가 충전분은 "$10 OFF 고객 프로모" 공고용으로 확보.
  - 학습: Carousell 무료 쿼터는 Jobs 하위 카테고리별로 각각 0. 약 100코인 ≈ S$1.
- **iOS**: App Store 앱 이름 오타 수정. 출시된 버전은 이름 변경 불가 → 새 버전 필요 → 새 빌드 필요(빌드 9는 1.0에 이미 소진). `app.json`의 buildNumber를 9→10으로 올려 빌드 10 생성, 1.0.4에 연결, **15:21 SGT 심사 제출**.
- **Play**: 14일 클로즈드 테스트 완료 확인 후 **14:25 프로덕션 액세스 신청 제출** (모집 경로·참여도·피드백 방식·발견 이슈 응답 포함).
- **디자인**: 런칭데이 SNS 카드 2종(1080 정사각 / 1200×627), 프로모터 운영 키트 PDF 3p, 총판용 원페이저 PDF 1p, 프로모터 채용 카드 1080 제작 완료 → 저장소 커밋.
- **인쇄**: 단일 업체 일괄 발주 대신 **5개 업체 패키지 입찰**로 전환. 수량 확정본과 마감(8/31)을 명시해 발송.
  - 학습: Gmail이 링크를 `google.com/url?q=` 로 감싸 벤더 메일필터가 차단 → 아트워크 링크는 `https://` 없이 `app.techchainglobal.com/artwork/x.pdf` 형태로 보낼 것.
- **채용**: MyCareersFuture에 프로모터 공고 **MCF-2026-1509996** 게재 완료. 지원 접수는 MCF 포털 + admin@techchainglobal.com.

### 2026-08-19 (수) 이전 — 누적 마일스톤
- 웹앱(Next.js/Vercel) 및 모바일 앱(Expo 54) 빌드 파이프라인 구축, 브랜드 시스템(네이비 #0B1428 / 블루 #2398EC, Archivo Black + Inter) 확정.
- 아트워크 호스팅 경로 확립: PDF는 `public/artwork/`, 이미지는 `public/og/` 및 `marketing/` → app.techchainglobal.com에서 서빙.
- 인쇄 업체 접촉 시작. CustomPrint에 뒷면 최대 인쇄 크기·화이트 언더베이스 질의(8/19, 미회신).
- 창고 마켓플레이스 콜드메일 트랙을 **별도 세션으로 분리**.

---

## 5. 고정 참고 정보

### 저장소 (스캇님 노트북, Windows)
```
C:\Users\user\Desktop\tcg-express        Next.js → Vercel (브랜치: master)
C:\Users\user\Desktop\tcg-express-app    Expo 54 (모바일)
C:\Users\user\Desktop\tcg-express-mobile
```
- 셸은 **PowerShell — `&&` 사용 불가.** 명령은 줄바꿈 또는 `;` 로 구분.
- git add/commit/push는 **스캇님이 직접 실행**.

### 브랜드
- 네이비 `#0B1428` → `#0C1B35` → `#0E2242` (그라디언트)
- 블루 `#2398EC`, 라이트 `#6EC8F5`, 화이트 `#fff`, 뮤트 `#C8DCF0` / `#9FC4E4`
- 폰트: Archivo Black (헤드라인) + Inter 400/600/800

### EAS / 버전
- `eas.json`의 `appVersionSource: "local"` → **`app.json`이 버전/빌드번호의 기준**.
- 현재: version `1.0.4`, iOS buildNumber `10`, Android versionCode `11`.

### 정기 작업
- 매일 09:00 SGT — TCG Express 런칭 점검 및 보고
- 9/1 런칭일 작업
- Wave2 총판 콜드메일

---

## 6. 다음 세션 체크리스트

1. 이 파일의 §2 상태 보드부터 확인.
2. Gmail에서 확인할 것: 인쇄 5개사 견적 회신 / Lim Sign 마감 답변 / CustomPrint 답변 / App Store Connect·Play Console 알림 / DBS.
3. iOS 심사 결과 나왔으면 App Store 앱 이름 표기 확인.
4. Play 프로덕션 액세스 승인 나왔으면 릴리즈 생성 → 링크 2곳 코드 삽입.
5. 8/31 이후면 견적 비교표 작성 → 추천안 제시 (**발주는 하지 말 것**).
6. 프로모터 지원 현황 집계 (MCF + admin@ 메일). 9/4까지 배지용 이름 확정 필요.
7. 작업 끝나면 이 파일 §4에 오늘 항목 추가.
