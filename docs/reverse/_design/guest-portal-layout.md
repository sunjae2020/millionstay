# Guest Portal Layout (`million-stay-web`)

> ✅ **T006-REWRITE** 2026-04-27 (T001 시점 107L NEEDS REVISION → 본 95L; T002 portal-guest.md 29 ep + T003 _context/domain-logic-portal-guest.md (BR1-BR12 + sole-owner E20) + T004 security-rules.md §1 (IDOR sole-owner UI 측면) + state-machines.md §X.fix F7 dead-end 통합).
> **상위 source**: artifacts/million-stay-web/src/{App.tsx, pages/, components/PortalLayout.tsx} + portal-guest 도메인 (29 ep / 3 files: guest-portal 21 + guest-cs 6 + guest-auth 2).
> **Cross-ref**: component-library.md §3 (sole-owner E20 UI carrier) + design-tokens.md §2 (guest 도메인 brand: orange `#F97316` + Inter/Noto Sans JP-Thai fallback) + admin-layout.md §1 (admin shell 대비).

---

## §1 SHELL — 2 도메인 통합 (public + portal)

`million-stay-web` = guest 도메인 단일 artifact 안 **2 shell coexist**:

```
public 도메인 (/, /listing, /property/:id)        portal 도메인 (/portal/*)
┌──────────────────────────────────┐          ┌────────────────────────────────────┐
│ Marketing nav (logo + Sign in)   │          │ PortalSidebar (collapsible drawer) │
├──────────────────────────────────┤          ├────────┬───────────────────────────┤
│ Hero / search / property cards   │          │ Side   │ Page (PageHeader + body)  │
│ ...                              │          │ menu   │ Right rail (sticky cards) │
│ Footer (사이트맵 + 지원)         │          │        │                           │
└──────────────────────────────────┘          └────────┴───────────────────────────┘
```

- `/portal/*` 진입 시 `PortalLayout` shell — public marketing nav 숨김 (인증 후 가시성 분리)
- `/portal/*` mobile = sidebar → hamburger drawer (`< 768px`)
- Right rail = `PaymentSummaryCard` 등 sticky → mobile 에서 sticky bottom bar

---

## §2 PAGES — public 도메인 (T002 public.md 33 ep cross-ref)

| 경로 | 용도 |
|------|------|
| `/` | landing hero + 검색 |
| `/listing` (`accommodation_catalog` 기반) | property 카드 grid + filter (CF-024 OPEN no rate limit cross-ref) |
| `/property/:id` | 상세 + booking CTA → `/booking/wizard` |
| `/booking/wizard` | 4-step BookingWizard (component-library §2) |
| `/login` | guest 로그인 (bcrypt 12) |
| `/signup` | 신규 lead 생성 OPEN POST (CF-008 0% audit floor + CF-024 rate limit 부재) |

**F7 Pending dead-end UI 영향** (state-machines.md §X.fix cross-ref): `/booking/wizard` step 4 confirm 시 `guest-portal.ts:160-162` insert literal `booking_status:"Pending" + status:"Active"` → admin 측 list 에서 transition 거부 (CF-022 9/9 leader 가드 모두 reject) → guest list 에서 본인 booking 보이지만 admin 가공 0 → "submitted but stuck" UX gap.

---

## §3 PORTAL PAGES — `/portal/*` (T002 portal-guest.md 29 ep)

| 경로 | 용도 |
|------|------|
| `/portal` | dashboard (booking 요약 + 다음 예정 + alert) |
| `/portal/bookings` | guest 본인 booking list (`account_id` filter + sole-owner E20 가시성) |
| `/portal/bookings/:id` | 본인 booking 상세 (5 SP IDOR sites POSITIVE compound WHERE; security-rules §2 cross-ref) |
| `/portal/invoices` | sole-owner 일 때만 노출 (E20 canonical exemplar UI carrier) |
| `/portal/cs` | CS ticket inbox (guest-cs 6 ep) + `/portal/cs/:id` 대화 (cs_messages nested) |
| `/portal/profile` | APP12 my-data screen (§4) |

---

## §4 APP 12 MY-DATA SCREEN — sole-owner E20 UI carrier (component-library §3 cross-ref)

순서 rendering:
1. Profile (masked bank/passport)
2. Account
3. **Bookings (sole-owner 일 때만)** ← E20 carrier
4. **Invoices (sole-owner 일 때만)** ← E20 carrier
5. Documents (signed download links)
6. Marketing consents (per-channel opt-in/out + status)
7. Counts table
8. "Download all as JSON" → `?format=download`

상단 standing "Generated at: ISO timestamp" stamp (캐시 vs 신선도 명시).

---

## §5 KNOWN UI DEBT

- `/booking/wizard` step 4 → F7 Pending dead-end (admin 측 처리 가시성 0 → "submitted but stuck" UX)
- BookingWizard mobile = sticky bottom `PaymentSummaryCard` 만 가시; right rail 정보 손실 가능
- `/portal/cs` polling 또는 websocket 통합 부재 — manual refresh
- public `/listing` filter 결과 deep-link 불가 (URL state 부재)

---

## §6 자가 검증 (3 spot-check ✅)

- C1 `million-stay-web/src/App.tsx` `/portal/*` route + `PortalLayout` shell wrap (T002 portal-guest.md cross-ref)
- C2 APP12 section 3-4 (Bookings + Invoices) sole-owner 가시성 = guest-portal.ts E20 backend 가드 동기 (component-library §3)
- C3 F7 dead-end UI = `guest-portal.ts:160-162` insert literal "Pending" + admin 측 9/9 transition reject (state-machines.md §X.fix)
