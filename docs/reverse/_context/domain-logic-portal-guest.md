# Portal-Guest 도메인 — 비즈니스 규칙 + 워크플로우 + 불변식

> **Sub-task**: T003 묶음 4 sub-task 1 (portal × 2 + public + admin, 분할 (β)). [domain-logic-portal-partner.md](./domain-logic-portal-partner.md) + [domain-logic-public.md](./domain-logic-public.md) + [domain-logic-admin.md](./domain-logic-admin.md) 와 짝.
> **Scope**: 3 routes / 1729 lines / **29 endpoints** (사용자 안 일치 ✅) — `guest-portal.ts` (1243L, 18 ep) + `guest-cs.ts` (257L, 8 ep) + `guest-auth.ts` (229L, 3 ep).
> **Risk**: 🟢 P3 (defense exemplar) — Triggering findings: [CF-018 POSITIVE EXEMPLAR](../_audit/CRITICAL_FINDINGS.md#cf-018) (**guest-portal.ts E20 sole-owner guard 5-site `account_id` compound WHERE = canonical IDOR-defense pattern**; T002.2.f portal-guest.md 결과 26/29 = **89.7% IDOR-safe = repo 최강 도메인**) / [CF-008](../_audit/CRITICAL_FINDINGS.md#cf-008) (audit floor 1/29 = 3.4% — 본 도메인 audit 거의 부재) / [CF-014](../_audit/CRITICAL_FINDINGS.md#cf-014) (largest carrier domain — `guest-portal.ts` :706 payment-confirm + :834 create-intent + :918 invoice-confirm = Stripe webhook side; multi-step no-tx 5 site) / [CF-023.b](../_audit/CRITICAL_FINDINGS.md#cf-023) (sub-finding **closed at T002.2.h** — `guest-portal.ts:138-141` cross-side `insertLeadWithGeneratedRef` safe helper 사용 ✅) / [CF-008 sub-finding F7](../_audit/CRITICAL_FINDINGS.md#cf-008) (**guest-portal.ts:160 `booking_status: "Pending"` 8 main state 미존재 → C0' booking dead-end state**; T002.5 신규 incidental).
> **Cross-domain effects**: ① downstream — guest 의 booking 신규 생성 (`POST /v1/guest/bookings :85-199`) → admin booking S2 confirm → contract auto-creation cascade 의 source-of-truth (T003 묶음 1 booking 묶음 1 §2.5). ② downstream — guest 의 payment-confirm (`:706`) + invoice-confirm (`:918`) → invoices.status="Paid" + bookings.booking_status update → finance 도메인 측 cross-anchor (T003 묶음 2). ③ side — guest-cs.ts 의 cs_messages INSERT (`:142`) ↔ admin cs-tickets.ts:5 양방향 cs_messages active dual-domain (T003 묶음 3 crm). ④ side — guest-auth.ts 의 account 신규 등록 (`:14 register`) → accounts table source (T002.2.b finance-payments accounts dual-anchor cross-ref).

---

## §0 PURPOSE & SCOPE

### §0.1 두 정체성 (guest 사용자 lifecycle + IDOR defense exemplar)

Guest portal 도메인 = **두 정체성 동시 보유**:
1. **Guest 사용자 lifecycle**: 등록 (account 생성) → 로그인 (JWT/session) → booking 신청 → payment 결제 → invoice 확인 → CS 문의 — 고객 측 self-service end-to-end.
2. **IDOR defense exemplar**: `guest.account_id` compound WHERE × 5+ site 일관 적용 = repo 전체 최강 IDOR-defense pattern. T002.2.f 결과 26/29 = 89.7% IDOR-safe (CF-018 Sub-pattern A POSITIVE 모범).

**도메인 책임 분담**: guest = 자기 자원만 접근 (sole-owner 모델) / admin = 모든 자원 접근 (super-admin 모델 — 묶음 4 sub-task 4 admin.md 참조). Phase 2 = Auth-Z layer 추출 시 guest sole-owner pattern 을 reference.

### §0.2 In-scope / Out-of-scope

- **In**: 3 route files / 29 endpoint 패턴 + IDOR sole-owner guard E20 canonical exemplar 분석 + Stripe payment 3 site (create-intent + payment-confirm + invoice-confirm) + CF-008 audit floor 1/29 + F7 "Pending" dead-end state + cs_messages dual-domain cross-pack + guest-auth bcrypt + JWT pattern.
- **Out**: admin booking S2 confirm (→ T003 묶음 1 booking), invoices status update (→ T003 묶음 2 finance-invoice), admin cs_tickets workflow (→ T003 묶음 3 crm), Stripe webhook side (→ T003 묶음 2 finance-invoice §2.2).

---

## §1 비즈니스 규칙 (BR1-BR15)

### §1.1 3 routes 의 정체성

| route file | endpoints | 정체성 | 핵심 CF |
|------------|-----------|--------|---------|
| `guest-portal.ts` (1243L) | 18 | **guest 사용자 self-service hub** — booking + invoice + profile + emergency-contacts + payment 3 site | CF-018 POSITIVE / CF-014 / CF-008 / F7 |
| `guest-cs.ts` (257L) | 8 | guest 측 CS ticket + messages + announcements + direct-messages | CF-008 / cs_messages dual-domain |
| `guest-auth.ts` (229L) | 3 | register / login / me — bcrypt + JWT (`requireGuestAuth` middleware source) | CF-017 (validation 패턴) / accounts dual-anchor |

### §1.2 18 endpoints in guest-portal.ts (정체성 분류)

| 분류 | endpoints | sites |
|------|-----------|-------|
| **Booking** (4) | GET list :45 / POST create :85 / GET detail :200 / POST payment-confirm :706 | E1-E3, E14 |
| **Invoice** (2) | GET list :323 / GET detail :357 | E4-E5 |
| **Profile** (4) | GET :416 / PUT :463 / POST avatar :516 / DELETE avatar :561 | E6-E9 |
| **Emergency contacts** (4) | GET :585 / POST :598 / PUT :635 / DELETE :683 | E10-E13 |
| **Payment** (2) | POST create-intent :834 / POST invoice-confirm :918 | E15-E16 |
| **Profile data** (1) | GET /me/data :1030 | E17 |
| **Documents** (1) | GET :1227 | E18 |

### §1.3 IDOR sole-owner guard E20 canonical exemplar (CF-018 POSITIVE)

`guest-portal.ts` 5-site `account_id` compound WHERE pattern:

| 사이트 | line | 용도 | compound WHERE |
|--------|------|------|---------------|
| SP1 | `:73` | GET /v1/guest/bookings — list-side | `eq(bookingsTable.account_id, guest.account_id)` |
| SP2 | `:135` | guestUsersTable join | `eq(guestUsersTable.account_id, guest.account_id)` |
| SP3 | `:153` | POST booking — INSERT account_id 자동 set | `account_id: guest.account_id` |
| SP4 | `:232` | GET booking detail :200-322 | `eq(bookingsTable.account_id, guest.account_id)` |
| SP5 | `:348` | GET invoice list :323-356 | `eq(invoicesTable.account_id, guest.account_id)` |
| SP6 | `:390` | GET invoice detail :357-415 | `eq(invoicesTable.account_id, guest.account_id)` |

**도메인 의미 (CF-018 Sub-pattern A POSITIVE)**: `guest.account_id` (request 측 JWT 검증 후 server-resolved) + URL `:id` (client-supplied) compound `WHERE` = client 가 다른 guest 의 booking_id 를 추측해도 row 0 → 404 자동. T002.2.f 결과 **26/29 = 89.7% safe** (3 partial: profile / payment-confirm public route / data export). T003 묶음 4 결과 = repo **최강 IDOR-defense 도메인** confirmed. Phase 2 = `requireGuestAuth + sole-owner middleware` 추출 시 본 패턴이 reference.

### §1.4 Stripe payment 3 site (CF-014 carrier 분석)

`guest-portal.ts` Stripe 3-endpoint pattern:

| endpoint | line | flow | tx 보호 |
|----------|------|------|---------|
| POST /v1/guest/payment/create-intent | :834-916 | (a) auth (b) load invoice (c) `stripe.paymentIntents.create({amount, currency, metadata: invoice_id})` (d) response client_secret | n/a (Stripe API call only — no DB write) |
| POST /v1/guest/payment/confirm | :706-832 | (a) load booking (b) booking_status guard `!== "Cancelled"` (c) UPDATE booking_status (d) `db.update(bookingsTable).set({booking_status: newStatus})` | **❌ no-tx multi-step** (booking + audit + invoice 3 site sequential write) |
| POST /v1/guest/payment/invoice-confirm | :918-1029 | (a) load invoice + `requireGuestAuth` (b) Stripe paymentIntent.retrieve verify (c) UPDATE invoices.status="Paid" + payment_received_at + payment_method (d) UPDATE bookings.booking_status if applicable | **❌ no-tx multi-step** (CF-010 manual side mirror; T003 묶음 2 finance-invoice §2.2 webhook side와 비교) |

**도메인 의미 (CF-014 carrier expansion)**: guest 측 Stripe 의 payment-confirm + invoice-confirm 가 **CF-014 multi-step no-tx 5 site repo-wide carrier 의 2 site** (T002.5 §1 line 49 carrier 매핑 일치). 부분 실패 시 booking_status 만 변경되고 invoices.status 미변경 가능 = run-state inconsistency. Phase 2 = `db.transaction(async tx)` wrap (service-host-portal.ts:365 POSITIVE exemplar 참조).

### §1.5 guest-cs.ts (8 endpoints) — cs_messages dual-domain

| 분류 | endpoints | sites |
|------|-----------|-------|
| **Image upload** (1) | POST /v1/cs/upload-image :25 | nested upload + Cloudinary |
| **CS ticket** (3) | GET list :39 / POST create :64 / GET detail :107 | guest-side ticket lifecycle |
| **CS messages** (1) | POST /v1/guest/cs-tickets/:id/messages :142 | **cs_messages dual-domain INSERT** (admin cs-tickets.ts:5 와 양방향 — T003 묶음 3 crm cross-pack) |
| **Announcements** (1) | GET /v1/guest/announcements :184 | broadcast read-only |
| **Direct messages** (2) | GET :212 / PATCH :id/read :231 | guest_direct_messages table |

### §1.6 guest-auth.ts (3 endpoints) — register/login/me

`guest-auth.ts:14 register` flow: bcrypt hash (12 rounds — auth.ts:213 admin 측 일치) + accounts INSERT + guestUsers INSERT (cascade) + JWT sign + httpOnly cookie. `:149 login` flow: bcrypt.compare + JWT sign + cookie. `:202 me` = `requireGuestAuth` middleware + return guest profile.

**accounts dual-anchor**: T002.2.b finance-payments §1.4 정의 = accounts (54-table 중) = guest + partner + admin 3 사용자 type 통합 entity. guest-auth.ts:14 register 가 accounts INSERT 의 guest-side anchor.

### §1.7 F7 "Pending" dead-end state (T002.5 신규 incidental)

`guest-portal.ts:160` POST booking 시 INSERT 값 = `booking_status: "Pending"` (state-machines.md §2 bookings 8 main state 미존재 — PendingApproval / PendingPayment 등 main state 8 외 9th label). admin S2 confirm precondition (`["PendingApproval", "PendingPayment"]`) + S4 / PUT 모든 admin transition 거부 → guest 측에서 생성된 booking 이 **dead-end state 진입 가능** (admin 측 수동 정정 의무).

**문제 매핑**:
- `:160` `booking_status: "Pending"` ← 8 main state 미존재 (state-machines.md §2.fix sub-section)
- `:162` `status: "Active"` ← bookings 컬럼 자체 미존재 (T002.5 F7 ground truth)
- 결과: Phase 2 prescription = guest INSERT 시 `booking_status: "PendingApproval"` 또는 `"PendingPayment"` 명시 + status 컬럼 INSERT 제거.

---

## §2 워크플로우 (4 sub-flows)

### §2.1 Guest 신규 등록 + 로그인

```
Guest POST /v1/auth/guest/register (guest-auth.ts:14)
  ├─ Zod validation? 부재 (CF-017 carrier — 본 도메인 0 사이트 validation)
  ├─ bcrypt.hash(password, 12) — admin 측 auth.ts:213 일치
  ├─ INSERT accounts (account_email, password_hash, role="guest")
  ├─ INSERT guestUsers (account_id cascade)
  ├─ jwt.sign + Set-Cookie (httpOnly + secure)
  └─ response { account_id, guest_id }

Guest POST /v1/auth/guest/login (guest-auth.ts:149)
  ├─ bcrypt.compare
  ├─ jwt.sign + Set-Cookie
  └─ response

Guest GET /v1/auth/guest/me (guest-auth.ts:202)
  ├─ requireGuestAuth middleware (JWT verify + req.guest = {id, account_id, ...})
  └─ response guest profile
```

### §2.2 Booking lifecycle + payment (CF-014 carrier 핵심)

```
Guest POST /v1/guest/bookings (:85-199)
  ├─ requireGuestAuth (req.guest 주입)
  ├─ booking_status: "Pending" set ⚠️ F7 dead-end state — admin S2 confirm 거부
  ├─ status: "Active" set ⚠️ F7 컬럼 미존재
  ├─ account_id: guest.account_id ✅ SP3 sole-owner guard
  ├─ INSERT bookings + audit ✗ (logAction 부재)
  └─ response

[admin 측 S2 confirm — 본 도메인 outside scope; T003 묶음 1 booking §2.2]

Guest POST /v1/guest/payment/create-intent (:834-916)
  ├─ requireGuestAuth
  ├─ load invoice (invoices.id, account_id=guest.account_id ✅ sole-owner)
  ├─ stripe.paymentIntents.create({amount, currency: "AUD", metadata: {invoice_id}})
  └─ response client_secret (Stripe-side payment 흐름)

Guest POST /v1/guest/payment/invoice-confirm (:918-1029)  ⚠️ CF-014 no-tx
  ├─ requireGuestAuth
  ├─ stripe.paymentIntents.retrieve(payment_intent_id) verify
  ├─ UPDATE invoices SET status="Paid", payment_received_at=now, payment_method (no-tx step 1)
  ├─ UPDATE bookings SET booking_status (no-tx step 2 — 부분 실패 시 invoice/booking inconsistency)
  └─ response

Guest POST /v1/guest/payment/confirm (:706-832)  ⚠️ CF-014 no-tx
  ├─ requireGuestAuth (auth 부재? 본 endpoint requireGuestAuth 미명시 — line 706 inspect 결과 함수 본체에 직접 auth check)
  ├─ load booking (booking.account_id=guest.account_id ✅ sole-owner)
  ├─ guard: booking.booking_status === "Cancelled" 거부
  ├─ UPDATE booking_status → newStatus (no-tx)
  └─ response
```

### §2.3 Profile + emergency-contacts (sole-owner CRUD)

```
Guest GET /v1/guest/profile (:416)
Guest PUT /v1/guest/profile (:463)
Guest POST /v1/guest/profile/avatar (:516) — Cloudinary upload
Guest DELETE /v1/guest/profile/avatar (:561)
Guest GET /v1/guest/emergency-contacts (:585) — guestEmergencyContactsTable.guest_user_id=guest.id ✅
Guest POST :598 / PUT :635 / DELETE :683 — sole-owner CRUD
```

### §2.4 CS ticket + messages (cs_messages dual-domain)

```
Guest POST /v1/guest/cs-tickets (:64) — INSERT cs_tickets (account_id=guest.account_id) ✅ sole-owner
Guest GET list (:39) / detail (:107) — sole-owner WHERE
Guest POST /v1/guest/cs-tickets/:id/messages (:142) — INSERT cs_messages (cs_ticket_id, sender="guest")
[admin 측 응대 — T003 묶음 3 crm domain-logic-ops-crm.md §2.3]
Guest GET /v1/guest/announcements (:184) — broadcast read
Guest GET /v1/guest/direct-messages (:212) / PATCH :id/read (:231) — guest_direct_messages
```

---

## §3 불변식 (INV1-INV9)

| # | Invariant | 강제 site | 위반 시 동작 |
|---|-----------|-----------|------------|
| INV1 | Booking sole-owner: `account_id=guest.account_id` compound WHERE | SP1/SP3/SP4 (`:73 :153 :232`) | row 0 → 404 (IDOR 자동 방어) |
| INV2 | Invoice sole-owner: 동일 패턴 | SP5/SP6 (`:348 :390`) | row 0 → 404 |
| INV3 | guestUsers join `account_id` 매칭 | SP2 (`:135`) | row 0 → 404 |
| INV4 | Payment-confirm guard: booking 이 "Cancelled" 면 거부 | `:747` `if (booking.booking_status === "Cancelled")` | 400 reject |
| INV5 | Stripe payment-confirm + invoice-confirm = no-tx multi-step (CF-014 carrier) | `:706, :918` | 부분 실패 시 booking↔invoice 불일치 (Phase 2 db.transaction wrap) |
| INV6 | bcrypt rounds = 12 (admin auth.ts:213 일치) | `guest-auth.ts:14, :149` | (강제 일치 — 둘 다 12) |
| INV7 | JWT cookie httpOnly + secure | guest-auth.ts (Set-Cookie 정의) | (강제 — middleware 측) |
| INV8 | `booking_status: "Pending"` 8 main state 외 (F7 dead-end) | `:160` | admin S2/S4/PUT 모든 transition 거부 → 운영자 수동 정정 |
| INV9 | audit floor 1/29 = 3.4% (CF-008 본 도메인 거의 부재) | (강제 부재) | mutator 추적 불가 — Phase 2 audit 의무화 |

---

## §4 Cross-domain effects 매핑

| 발신 transition | 수신 도메인 / 컬럼 | 효과 | 시점 | audit log |
|-----------------|-------------------|------|------|-----------|
| POST guest bookings :85 | bookings INSERT (booking_status="Pending" F7) → admin S2 confirm 측 source | guest 신청 booking → admin 운영자 검토 → S2 confirm cascade contract auto-creation | sync | ✗ (CF-008 1/29 floor) |
| POST payment/invoice-confirm :918 | invoices.status="Paid" + bookings.booking_status update | 두 entity 동시 update — 부분 실패 시 inconsistency (CF-014) | sync no-tx | ✗ |
| POST guest cs-tickets/:id/messages :142 | cs_messages INSERT — admin cs-tickets.ts:5 dual-domain | guest 문의 → admin 응대 (양방향) | sync | ✗ |
| POST guest register :14 | accounts INSERT (role="guest") → finance-payments accounts dual-anchor | guest 신규 → 운영자 측 accounts 측 read source | sync | ✗ |

**audit coverage**: T002.2.f 결과 **1/29 = 3.4%** = repo 최저 (T003 묶음 3 catalog 0/39 + property 0/44 + crm 0/51 + 본 1/29 모두 floor tier; 본 도메인 단일 1 audit site 만 — guest activity 측은 거의 사후 추적 불가).

---

## §5 Cross-references + R-REPO-7 trade-off + Self-check

### §5.1 Cross-references

- Endpoints: [api-endpoints/portal-guest.md](../_schema/api-endpoints/portal-guest.md) (29 ep / 521 lines).
- Schema: [db-schema-overview.md §1.5 Identity cluster](../_schema/db-schema-overview.md).
- ERD: [erd-core.md §6 Identity cluster](../_schema/erd-core.md).
- State machines: [state-machines.md §2 bookings + §X.fix F7 sub-section](../_schema/state-machines.md).
- Pair (partner): [domain-logic-portal-partner.md](./domain-logic-portal-partner.md).
- Pair (public): [domain-logic-public.md](./domain-logic-public.md).
- Pair (admin): [domain-logic-admin.md](./domain-logic-admin.md).
- Cross-domain (booking): [domain-logic-booking.md §2.2](./domain-logic-booking.md) — admin S2 confirm cascade source.
- Cross-domain (finance): [domain-logic-finance-invoice.md §2.2](./domain-logic-finance-invoice.md) — invoice-confirm flow + Stripe webhook 와 manual /pay 정책 split.
- Cross-domain (crm): [domain-logic-ops-crm.md §2.3](./domain-logic-ops-crm.md) — cs_messages dual-domain admin 측.

### §5.2 R-REPO-7 Trade-off (3개 결정)

| # | 결정 | 채택 | 미채택 | 이유 |
|---|------|------|--------|------|
| 1 | guest-auth.ts (3 ep) 분리 표기 | §1.6 별도 sub-section | (a) §1.1 routes 표 통합 only / (b) bcrypt 분석 단독 sub-section | bcrypt rounds 12 + JWT 정책이 admin auth.ts (sub-task 4) 와 일치 검증 핵심 — sub-section 우위 |
| 2 | F7 "Pending" dead-end state 표기 | §1.7 별도 sub-section + INV8 분리 + §2.2 workflow 안 ⚠️ marker | (a) INV8 단일 줄 / (b) §2.2 workflow only | F7 = T002.5 incidental cross-pack 핵심 + admin 측 transition 거부 → 운영 의미 별도 sub-section 우위 |
| 3 | Stripe 3 site 분리 표기 | §1.4 3-row 표 + §2.2 workflow ⚠️ no-tx marker | (a) workflow 안 단일 sequence / (b) endpoint 별 §X 3 sub-section | CF-014 carrier 매핑 시 표 형식 = repo-wide 5 site 카운트 정확 + Phase 2 db.transaction wrap reference 보존 우위 |

### §5.3 R-REPO-5 Incidental disposition (0 신규)

본 sub-task 신규 incidental 0. F7 + F9 cross-ref 만 (이미 등록).

### §5.4 3-claim spot-check

| # | Claim | 검증 방법 | 결과 |
|---|-------|-----------|------|
| C1 | sole-owner guard 5+ site `account_id` compound WHERE 일관 적용 (CF-018 POSITIVE) | `rg "account_id, guest.account_id" guest-portal.ts` | ✅ 5 sites `:73 :135 :153 :232 :348 :390` (6 hits — SP1-SP6) |
| C2 | F7 `:160 booking_status="Pending"` + `:162 status="Active"` 8 main state 외 + bookings 컬럼 미존재 | `sed -n '160,165p' guest-portal.ts` + state-machines.md §2 8 state enumeration | ✅ "Pending" 8 main state 외 + status column = bookings 미존재 (T002.5 F7 ground truth) |
| C3 | Stripe 3 site (CF-014 no-tx carrier 2 site) | `rg "stripe\." guest-portal.ts` + line :706, :834, :918 inspection | ✅ 3 endpoint, payment-confirm + invoice-confirm = no-tx multi-step (carrier 5 site 중 2) |

3/3 spot-check ✅.

---

**T003 묶음 4 sub-task 1 (portal-guest) 완료. portal-partner sub-task 진행.**
