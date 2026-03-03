# Corp Premium — Client ↔ Admin 상호작용 플로우 설계

> 전체 비즈니스 플로우를 한눈에 보고, 각 단계별 필요한 UI/API를 명확히 정의

---

## 전체 플로우 다이어그램

```
CLIENT                          ADMIN                           SYSTEM
──────                          ─────                           ──────
1. RFQ 작성 & 제출 ──────────→ 
   (제목, 설명, 지역,                2. RFQ 접수 확인
    볼륨, 차량, 첨부파일)             상태: submitted
                                  │
                                  ▼
                              3. 검토 시작
                                 상태: under_review
                                  │
                                  ▼
                              4. 견적 작성 & 전송 ──────────→ 이메일/알림 발송
                                 (월정액, 건당요금,
                                  셋업비, 유효기간,
                                  결제조건, 라인아이템)
                                 상태: quote_sent
                                  │
◄─────────────────────────────────┘
5. 견적 수신 & 검토
   │
   ├─→ 수락 (Accept) ──────────→ 6. 계약 확정 알림
   │   상태: accepted              상태: accepted → active
   │
   ├─→ 거절 (Reject) ──────────→ 7. 거절 알림 + 사유
   │   상태: rejected
   │
   └─→ 협상 요청 ──────────────→ 8. 재견적 작성
       (코멘트/반론)                상태: under_review (재순환)
                                  │
                                  ▼
                              9. 수정 견적 전송 ──→ (5번으로 돌아감)

═══════════════════════════════════════════════════════
계약 활성화 후 (status: active)
═══════════════════════════════════════════════════════

CLIENT                          ADMIN
──────                          ─────
10. 배송 요청 생성 ────────────→ 11. 잡 배정/관리
    (Corp Premium 전용 잡)
                                  │
◄─────────────────────────────────┘
12. 배송 진행 상황 확인
    │
    ▼
13. 월간 리포트 확인
    (배송 건수, 비용, SLA)
```

---

## 현재 상태 vs 필요한 구현

| 단계 | 기능 | Client UI | Admin UI | API | 상태 |
|------|------|-----------|----------|-----|------|
| 1 | RFQ 작성/제출 | ✅ 완료 | - | ✅ | 완료 |
| 2 | RFQ 접수 리스트 | - | ✅ 완료 | ✅ | 완료 |
| 3 | 검토 시작 (Under Review) | - | ✅ 버튼 추가됨 | ✅ | 완료 |
| 4 | 견적 작성/전송 | - | ✅ 완료 | ✅ | ✅ DB 컬럼 필요 |
| 5 | **견적 수신/검토** | ❌ 없음 | - | ⏳ | **구현 필요** |
| 6 | **견적 수락** | ❌ 없음 | ❌ 알림 없음 | ⏳ | **구현 필요** |
| 7 | **견적 거절 + 사유** | ❌ 없음 | ❌ 알림 없음 | ⏳ | **구현 필요** |
| 8 | **협상/코멘트** | ❌ 없음 | ❌ 없음 | ❌ | **향후** |

---

## 이번 구현 범위: Client 견적 수신/수락/거절

### Client RFQ Tracking 탭 개선안

현재 Tracking 탭에는 상태 바만 있음. 다음을 추가:

```
┌─────────────────────────────────────────────┐
│ Annual RFQ                    QUOTE SENT 📝  │
│ 01 Mar 2026 - 12 months                     │
│                                              │
│ ┌─ 상태 타임라인 바 ─────────────────────┐   │
│ │ Submitted ▸ Under Review ▸ Quote Sent  │   │
│ └────────────────────────────────────────┘   │
│                                              │
│ ┌─ 📝 견적서 (Quote) ───────────────────┐   │
│ │                                        │   │
│ │  Monthly Rate        $2,500/mo         │   │
│ │  Per Delivery        $15               │   │
│ │  Setup Fee           $500 (one-time)   │   │
│ │                                        │   │
│ │  ── Line Items ──                      │   │
│ │  EV Vehicle Premium    $200/mo         │   │
│ │  White Glove Service   $50/delivery    │   │
│ │                                        │   │
│ │  Valid Until: 01 Apr 2026              │   │
│ │  Payment Terms: Net 30                 │   │
│ │                                        │   │
│ │  Notes: Includes dedicated fleet...    │   │
│ │                                        │   │
│ │  ┌──────────┐  ┌──────────┐           │   │
│ │  │ ✅ Accept │  │ ❌ Reject│           │   │
│ │  └──────────┘  └──────────┘           │   │
│ └────────────────────────────────────────┘   │
│                                              │
│ Submitted: 28 Feb 2026                       │
└─────────────────────────────────────────────┘
```

### 견적 수락 시
- status → 'accepted'
- Client에게 확인 토스트 + 계약 시작 안내
- Admin에게 알림 (향후: 이메일/push)

### 견적 거절 시
- 거절 사유 입력 모달 표시
- status → 'rejected'
- rejection_reason 저장
- Admin에게 알림

---

## DB 변경사항

```sql
-- 1. admin_quote 컬럼 (이미 계획됨)
ALTER TABLE corp_premium_requests
ADD COLUMN IF NOT EXISTS admin_quote jsonb DEFAULT NULL;

-- 2. 거절 사유 컬럼
ALTER TABLE corp_premium_requests
ADD COLUMN IF NOT EXISTS rejection_reason text DEFAULT NULL;

-- 3. Client 응답 시간 기록
ALTER TABLE corp_premium_requests
ADD COLUMN IF NOT EXISTS client_responded_at timestamptz DEFAULT NULL;
```

---

## API 변경사항

### Client가 견적에 응답하는 API

`POST /api/corp-premium/[id]/bids`에 추가할 액션:

```javascript
// action: 'client_accept_quote'
// → status를 'accepted'로 변경, client_responded_at 기록

// action: 'client_reject_quote'  
// → status를 'rejected'로 변경, rejection_reason 저장, client_responded_at 기록
```

### 권한 체크
- client_accept_quote / client_reject_quote: request의 client_id === session.userId
- send_quote / update_status: session.role === 'admin'
