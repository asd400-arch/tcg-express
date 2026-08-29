# TCG Express — 진행 기록 (PROGRESS)

> **이 파일의 목적**: 새 채팅창을 열었을 때 이 파일 하나만 읽으면 바로 이어서 작업할 수 있게 하는 것.
> **갱신 규칙**: 매일 작업 종료 시 `## 날짜별 기록` 맨 위에 그날 항목을 추가한다. 상단 요약(현재 상태·열린 결정)은 변경된 것만 덮어쓴다.
> 마지막 갱신: **2026-08-29 (토) 09:18 SGT**

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
- 진행상황 일자별 기록(`PROGRESS.md`)을 저장소에 생성. 다음 세션이 이 파일부터 읽고 이어가도록 규칙 명시.
- 매일 09:00 SGT 정기 점검 작업의 프롬프트를 전면 개편: 3개 트랙 경계 명시(TCG Express만 담당), Gmail 점검 섹션(인쇄 5개사 견적 / 차량 데칼 / 총판 콜드메일 / 앱스토어 / DBS / 기타), 프로모터 채용 섹션(기존 Store Hand 섹션 대체), 상태 보드, 보고 포맷.
- 메모리에 워크스트림 경계 2 기록: Store Hand 채용 트랙은 별도 세션 담당 → 이 세션은 열람·응대·보고 금지.
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
