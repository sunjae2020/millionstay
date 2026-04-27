# Agent / Commission / Lead Onboarding Workflow

> ✅ **T005-REWRITE** 2026-04-27 (T001 시점 81L NEEDS REVISION → 본 110L; T002 ops-crm.md + portal-partner.md + public.md + admin.md + T003 _context/domain-logic-{ops-crm,portal-partner,public}.md + T004 _rules/{financial,security,no-magic}-rules.md 통합).
> **상위 source**: `_context/domain-logic-ops-crm.md §1` (lead state machine 5 + commissions=real) / `_context/domain-logic-portal-partner.md` (CF-014 POSITIVE EXEMPLAR SHP:365) / `_audit/CRITICAL_FINDINGS.md` CF-001/CF-005/CF-023.a/F12.
> **Cross-ref**: booking-lifecycle.md §1 (lead → booking conversion) + payment-workflow.md §1 (commission 지급 invoice).

---

## §1 AGENT / LEAD ONBOARDING — 3 paths (CF-023.a sole outlier)

| path | helper | booking_ref 생성 | 안전성 |
|------|--------|------------------|--------|
| public.ts:175-204 (3 OPEN POST) | `insertLeadWithGeneratedRef` (`lib/leadRef.ts:15-41`) | ✅ 정상 helper (UNIQUE compound `lead_ref+account_id`) | 안전 (POSITIVE) |
| **leads.ts:175-204 /convert** | (helper 미사용) | ❌ booking row 미생성 — lead 만 update + booking_ref orphan ref | **CF-023.a outlier (sole)** |
| guest-portal.ts:138-141 | `insertLeadWithGeneratedRef` (정상 helper 호출) | ✅ 정상 | 안전 |

**CF-023.a 핵심 (T002.2.h CLOSED + T003 묶음 3 spot-check confirm)**: `leads.ts:175-204 /convert` endpoint 는 lead 를 "Converted" 로 update + `booking_ref` 텍스트 필드 입력만 함. 실제 `bookings` 테이블 INSERT 없음 → lead.booking_ref 가 존재하지 않는 booking_ref 가리킴 (orphan reference). 운영 데이터 분석 "converted lead 의 booking 매출" 쿼리 join 결과 NULL.

**Phase 2 prescription**: `leads.ts:175-204` 에서도 `insertLeadWithGeneratedRef` (또는 동등 helper) 호출 + bookings INSERT + lead.booking_ref 검증 (`bookings WHERE booking_ref=?` 존재 보장).

---

## §2 COMMISSION CALCULATION — Formula B + 양극단 carrier

`agent-portal.ts:251` earnings query:
```ts
const earned = commission?.commission_type === "Percentage" && commission.commission_rate
  ? rentAmount * (commission.commission_rate / 100)
  : commission?.commission_amount ?? 0;
```

**CF-001 양극단 carrier** (financial-rules §2): finance 도메인 내부 split:
- ✅ `invoices.amount = numeric` (정밀)
- ⚠️ `commissions.amount = real` (precision-lossy) + `commission_rate = real`

**F12 commissions.status enum 부재** (financial-rules §5.2 cross-ref): `commissions.ts:20,69` status filter 사용 + Archived 만 등장 → 다른 status 값 (Pending? Paid? Cancelled?) 의미 불명. 운영 데이터 분석 시 "지급 완료 commission 합계" 쿼리 결과 신뢰 어려움.

**Phase 2 prescription** (financial-rules §5.2): (1) commissions.amount + rate → numeric (CF-001 통일) / (2) commissions.status enum 정의 (Pending/Approved/Paid/Cancelled/Archived) + transition 가드 / (3) commission 지급 trigger = invoice "Paid" 시점 자동 INSERT commission row (현재 코드 부재).

---

## §3 ONBOARDING-LEAD SCOPE 흡수 (사용자 가설 onboarding-lead)

**Lead state machine** (5 state, `domain-logic-ops-crm.md §1.3`):
```
New → Contacted → Qualified → Converted (booking 생성)
                          └─→ Lost (any state, lost_reason 선택)
```

**3 lead → booking 변환 sites** (cross-domain enumeration, T003 묶음 3 spot-check):
1. `public.ts:175-204` 3 OPEN POST → `insertLeadWithGeneratedRef` (CF-024 rate limiting carrier — public OPEN 12 ep)
2. `leads.ts:175-204 /convert` → CF-023.a outlier (helper 미호출)
3. `guest-portal.ts:138-141` → `insertLeadWithGeneratedRef` (sole-owner E20 보호)

**CF-005 portal_type drift cross-pack** (security-rules §8): `partner_users.portal_type` runtime "service_host" 값 입력 가능 (TS type 미정의; SHP:365 POSITIVE 가드 우회). agent vs owner vs service_host 구분 = SHP 도입 후 TS schema 재생성 필요.

---

## §4 CROSS-REF + Phase 2

- booking-lifecycle.md §1 — Draft → Confirmed (CF-023.a 정상 lead → booking 경로)
- payment-workflow.md §3 — contract activate cascade (commission 지급 trigger 부재)
- public.md (T002 INDEX) — public.ts insertLeadWithGeneratedRef helper anchor
- portal-partner (T003 묶음 4) — SHP:365 CF-014 POSITIVE EXEMPLAR

**Phase 2 종합** (financial-rules §5.2 + security-rules §8): (1) leads.ts:175-204 /convert helper 통합 / (2) commissions.amount+rate numeric / (3) commissions.status enum / (4) commission 자동 INSERT trigger / (5) portal_type TS type 재생성 (service_host 추가) / (6) lead → booking 3 path 통일.

---

## §5 자가 검증 (3 spot-check ✅)

- C1 `leads.ts:175-204` `db.update(leads)` only — `db.insert(bookings)` 0 hit (CF-023.a sole outlier confirmed)
- C2 `commissions.ts` schema `amount: real()` + `commission_rate: real()` (CF-001 양극단)
- C3 F12 `commissions.ts:20,69` status filter — Archived 외 enum 미정의 (`rg "commission.*status" --type=ts` 단편)
