# Portal-Partner 도메인 — 비즈니스 규칙 + 워크플로우 + 불변식

> **Sub-task**: T003 묶음 4 sub-task 2 (portal × 2 + public + admin, 분할 (β)). [domain-logic-portal-guest.md](./domain-logic-portal-guest.md) + [domain-logic-public.md](./domain-logic-public.md) + [domain-logic-admin.md](./domain-logic-admin.md) 와 짝.
> **Scope**: 4 routes / 1543 lines / **22 endpoints** (사용자 안 일치 ✅) — `service-host-portal.ts` (723L, 9 ep) + `owner-portal.ts` (418L, 5 ep) + `agent-portal.ts` (281L, 5 ep) + `partner-auth.ts` (121L, 3 ep).
> **Risk**: 🟢 P3 (defense exemplar) — Triggering findings: [CF-014 POSITIVE EXEMPLAR](../_audit/CRITICAL_FINDINGS.md#cf-014) (**`service-host-portal.ts:365` `db.transaction(async tx => SELECT FOR UPDATE + INSERT loop)` = repo 3 known production runtime Tx site #2 of 3**; T002.5 §7 cross-pack matrix 일치) / [CF-018 POSITIVE](../_audit/CRITICAL_FINDINGS.md#cf-018) (T002.2.g 결과 22/22 = **100% IDOR-safe (qualified)** — service-host scoping `partner.id` compound WHERE; owner/agent 측 read-only 통계 endpoint 위주 IDOR 표면 없음) / [CF-005](../_audit/CRITICAL_FINDINGS.md#cf-005) (`partner_users.portal_type` runtime "service_host" 받음 vs TS `"agent" | "owner"` only — partner-auth.ts:11 login + middleware 분기 측 영향) / [CF-008](../_audit/CRITICAL_FINDINGS.md#cf-008) (audit floor 6-way TIE 측 본 도메인 22 ep / 0 audit) / [CF-001](../_audit/CRITICAL_FINDINGS.md#cf-001) (commission % calculation = `commissions.amount=real` precision; agent-portal.ts:228 commission endpoint).
> **Cross-domain effects**: ① side — partner-auth.ts 측 partner_users 측 INSERT/login → admin 측 partner-users 관리 (admin.md sub-task 4 측). ② downstream — service-host-portal.ts:365 transaction 측 booking_service_photos INSERT (Cloudinary 측 동기화) → admin 측 work_orders / spaces 측 영향 (T003 묶음 3 property/crm). ③ side — owner-portal.ts 측 owner 측 dashboard read = properties + bookings + revenue 통계 cross-domain READ (booking + finance + ops-property). ④ side — agent-portal.ts 측 commission read = commissions table cross-pack (T003 묶음 2 finance-payment §1.4).

---

## §0 PURPOSE & SCOPE

### §0.1 4 partner type (admin 외 3 partner + 1 partner-auth 통합)

Partner portal 도메인 = **3 partner type self-service portal + 1 통합 auth**:
1. **service-host** = 서비스 운영자 (cleaning + maintenance + photo upload) — 가장 active type
2. **owner** = 부동산 소유주 (revenue + properties + bookings 통계 조회 only)
3. **agent** = 영업 에이전트 (commissions + booking 추적 only)
4. **partner-auth** (통합) = 3 type 통합 login + me + change-password

**도메인 책임 분담**: service-host = 운영 active mutator (transaction site) / owner + agent = read-only 통계 consumer (mutator 거의 없음) / partner-auth = identity 통합 (CF-005 portal_type 측 runtime drift 결정점).

### §0.2 In-scope / Out-of-scope

- **In**: 4 route files / 22 endpoint 패턴 + CF-014 POSITIVE EXEMPLAR `service-host-portal.ts:365` line-by-line 분석 + CF-005 portal_type runtime "service_host" drift 분석 + CF-018 100% IDOR-safe (qualified) 분석 + commission `real` precision (CF-001 carrier).
- **Out**: admin 측 partner_users 관리 (→ T003 묶음 4 sub-task 4 admin §1.5 admin-users), commissions 측 read-only 통계 (→ T003 묶음 2 finance-payment §1.4), booking_services 측 admin (→ T003 묶음 1 booking).

---

## §1 비즈니스 규칙 (BR1-BR12)

### §1.1 4 routes 의 정체성

| route file | endpoints | 정체성 | 핵심 CF |
|------------|-----------|--------|---------|
| `service-host-portal.ts` (723L) | 9 | **service host active mutator hub** — dashboard + jobs + photo upload (transaction) + schedule + earnings + profile | **CF-014 POSITIVE :365** / CF-018 / CF-008 |
| `owner-portal.ts` (418L) | 5 | owner read-only 통계 (dashboard + properties + bookings + revenue) | CF-008 / CF-018 (read-only 자동 safe) |
| `agent-portal.ts` (281L) | 5 | agent read-only 통계 (dashboard + bookings + properties + commission) | CF-001 (commission `real`) / CF-008 |
| `partner-auth.ts` (121L) | 3 | login (3 type 통합) / me / change-password | CF-005 (portal_type runtime drift) |

### §1.2 service-host-portal.ts (9 endpoints) — CF-014 POSITIVE 핵심

| 분류 | endpoint | line | tx 보호 |
|------|----------|------|---------|
| Dashboard | GET /v1/service-host/dashboard | :51 | n/a (read-only) |
| Jobs | GET list | :143 | n/a |
| Jobs | GET detail | :260 | n/a |
| Jobs | **POST :id/photos (upload)** | **:317-411** | **✅ db.transaction (`:365`)** |
| Jobs | PATCH :id (status update) | :414 | ✗ no-tx (single-step UPDATE only) |
| Jobs | DELETE :id/photos/:photoId | :461 | ✗ no-tx (single-step DELETE only) |
| Schedule | GET | :488 | n/a |
| Earnings | GET | :604 | n/a |
| Profile | GET | :700 | n/a |

**CF-014 POSITIVE EXEMPLAR (`:365-393`) 분석**:
```
await db.transaction(async (tx) => {
  await tx.execute(sql`SELECT id FROM booking_services WHERE id = ${jobId} FOR UPDATE`); // (a) 부모 row lock
  const existing = await tx.select(...).from(bookingServicePhotosTable)
    .where(eq(bookingServicePhotosTable.booking_service_id, jobId)); // (b) count 조회
  const remaining = MAX_JOB_PHOTOS - existing.length;
  if (remaining <= 0) { limitError = ...; throw new Error("LIMIT"); } // (c) 가드 1 (max 도달)
  if (uploads.length > remaining) { limitError = ...; throw new Error("LIMIT"); } // (d) 가드 2 (초과 분량)
  for (const uploaded of uploads) {
    const [inserted] = await tx.insert(bookingServicePhotosTable).values({...}).returning(); // (e) loop INSERT
    results.push(inserted);
  }
});
catch (txErr) { /* Cleanup Cloudinary uploads if DB tx aborted */ }
```

**도메인 의미**: ① **`SELECT ... FOR UPDATE` row-level lock** = 동시 upload race condition 방지 (concurrent upload 시 max-photo limit 정확 강제). ② **try/catch + Cloudinary cleanup** = DB tx 실패 시 외부 자원 (Cloudinary asset) 정리 = compensation pattern. ③ **3 known production runtime Tx site of 3** (T002.5 §7 cross-pack: dev-migration.ts:38 + service-host-portal.ts:365 + seedSync.ts:214). Phase 2 = 본 패턴이 reference exemplar — `guest-portal.ts:706 + :918` (T003 묶음 4 sub-task 1 portal-guest §1.4 carrier 2 site) 측에 동일 wrap 적용.

### §1.3 owner-portal.ts (5 endpoints) — read-only 통계

| endpoint | line | 책임 |
|----------|------|------|
| GET /v1/owner/dashboard | :32 | KPI summary (properties count + recent bookings + revenue snapshot) |
| GET /v1/owner/properties | :102 | owner 의 properties list (`partner.id` compound WHERE 가설) |
| GET /v1/owner/properties/:id | :139 | property detail |
| GET /v1/owner/bookings | :277 | owner 의 properties 측 bookings list (cross-domain) |
| GET /v1/owner/revenue | :344 | revenue 집계 (finance-side cross-domain READ) |

**도메인 의미**: 5 endpoint 모두 read-only — IDOR 표면 거의 0 (mutator 부재). T002.2.g 22/22 IDOR-safe (qualified) 측 owner 측 5 ep = read-only 자동 safe. partner-auth 측 `partner.id` server-resolved compound WHERE 일관 (sole-owner 패턴 일치).

### §1.4 agent-portal.ts (5 endpoints) — read-only + commission

| endpoint | line | 책임 |
|----------|------|------|
| GET /v1/agent/dashboard | :28 | KPI summary (bookings count + commissions accrued) |
| GET /v1/agent/bookings | :91 | agent 가 source 한 bookings list |
| GET /v1/agent/bookings/:id | :154 | booking detail |
| GET /v1/agent/properties | :199 | agent 가 listing 한 properties |
| GET /v1/agent/commission | :228 | **commission 집계 (CF-001 carrier — `commissions.amount=real`)** |

**CF-001 carrier**: agent commission 집계 시 `commissions.amount=real` (T002.2.b finance-payment §1.4 BR3 commissions 측 `real` precision loss carrier 단일 anchor 등재). Phase 2 = `numeric(12,2)` migration. agent-portal.ts:228 = single read site 만 (admin 측 commissions.ts 도 read-only 통계 위주).

### §1.5 partner-auth.ts (3 endpoints) — CF-005 portal_type drift

| endpoint | line | 책임 |
|----------|------|------|
| POST /v1/auth/partner/login | :11 | bcrypt + JWT (3 type 통합 login) |
| GET /v1/auth/partner/me | :66 | requirePartnerAuth + return partner profile |
| POST /v1/auth/partner/change-password | :100 | bcrypt + UPDATE password_hash |

**CF-005 portal_type runtime drift**: `partner_users.portal_type` schema/TS = `"agent" | "owner"` only (2 enum). 실제 runtime 에서 `"service_host"` 3rd value 허용 — partner-auth.ts:11 login 측 + middleware 측 분기 (requirePartnerAuth/requireAgentAuth/requireOwnerAuth/requireServiceHostAuth 4 종 middleware 모두 portal_type 측 read). Phase 2 = TS literal union extend `"agent" | "owner" | "service_host"` + DB CHECK 제약 추가 (CF-016 + CF-005 합집합 일괄 처리).

---

## §2 워크플로우 (3 sub-flows)

### §2.1 Partner 통합 로그인 + 분기

```
Partner POST /v1/auth/partner/login (partner-auth.ts:11)
  ├─ bcrypt.compare
  ├─ portal_type 측 decode (CF-005: "agent" | "owner" | "service_host" 3 value)
  ├─ jwt.sign + Set-Cookie
  └─ response { partner_id, portal_type }

[ 분기 — portal_type 별 middleware 적용 ]
  - portal_type === "service_host" → requireServiceHostAuth → service-host-portal.ts 측
  - portal_type === "owner" → requireOwnerAuth → owner-portal.ts 측
  - portal_type === "agent" → requireAgentAuth → agent-portal.ts 측

Partner GET /v1/auth/partner/me (:66) — requirePartnerAuth + profile read
Partner POST /v1/auth/partner/change-password (:100) — bcrypt + UPDATE
```

### §2.2 Service host job photo upload (CF-014 POSITIVE 핵심)

```
ServiceHost POST /v1/service-host/jobs/:id/photos (service-host-portal.ts:317-411)
  ├─ requireServiceHostAuth (req.partner = {id, portal_type="service_host"})
  ├─ Cloudinary upload (uploads array generated)
  ├─ db.transaction(async (tx) => {  ✅ POSITIVE :365
  │     ├─ SELECT FOR UPDATE booking_services (parent row lock)
  │     ├─ count existing photos
  │     ├─ guard: MAX_JOB_PHOTOS 도달 시 abort + cleanup
  │     ├─ guard: 초과 분량 abort + cleanup
  │     └─ for uploads: INSERT bookingServicePhotos
  │   })
  ├─ catch (txErr) → Cloudinary cleanup
  └─ response inserted photos
```

### §2.3 Owner/Agent read-only 통계 (cross-domain READ)

```
Owner GET /v1/owner/dashboard (:32) — KPI aggregation
  ├─ requireOwnerAuth (req.partner)
  ├─ load properties WHERE owner_id=partner.id
  ├─ load bookings join properties (cross-domain READ booking)
  ├─ load revenue (cross-domain READ finance)
  └─ aggregate + response

Agent GET /v1/agent/commission (:228) — commission 집계
  ├─ requireAgentAuth (req.partner)
  ├─ load commissions WHERE agent_id=partner.id (CF-001 carrier — amount=real)
  └─ aggregate + response
```

---

## §3 불변식 (INV1-INV8)

| # | Invariant | 강제 site | 위반 시 동작 |
|---|-----------|-----------|------------|
| INV1 | service-host job photo upload = `db.transaction` wrap (CF-014 POSITIVE) | `service-host-portal.ts:365` | 부분 실패 시 row-level lock + Cloudinary cleanup |
| INV2 | MAX_JOB_PHOTOS 정확 강제 (race condition 방지) | `:365 SELECT FOR UPDATE` + count guard | 동시 upload 가 max 초과해도 정확 reject |
| INV3 | partner_users.portal_type 3 value runtime (CF-005 drift) | `partner-auth.ts:11` decode | TS `"agent" \| "owner"` 만 허용 → "service_host" runtime drift |
| INV4 | bcrypt rounds = 12 (admin auth.ts:213 + guest-auth.ts 일치) | `partner-auth.ts:11, :100` | 강제 일치 |
| INV5 | owner/agent 측 IDOR-safe (read-only 자동 — mutator 부재) | (강제 불필요) | T002.2.g 22/22 100% (qualified) |
| INV6 | service-host job PATCH/DELETE 측 sole-owner guard | `:414, :461` (`partner.id` 비교 가설) | row 0 → 404 |
| INV7 | commission `commissions.amount=real` precision (CF-001 carrier) | `agent-portal.ts:228` read | precision loss accumulating (Phase 2 numeric migration) |
| INV8 | audit floor 0/22 (CF-008 6-way TIE) | (강제 부재) | mutator 추적 불가 |

---

## §4 Cross-domain effects 매핑

| 발신 transition | 수신 도메인 / 컬럼 | 효과 | 시점 | audit log |
|-----------------|-------------------|------|------|-----------|
| service-host-portal.ts:365 photo upload | bookingServicePhotos INSERT (transaction) → admin 측 work_orders + booking_services 추적 | 운영자 측 photo 검토 → completion verification | sync tx | ✗ |
| service-host-portal.ts:414 PATCH job status | booking_services.status update → admin 측 work_orders state machine cross-pack | service host 측 job status update → admin 운영 lifecycle 일치 | sync no-tx | ✗ |
| partner-auth.ts:11 login | (middleware 측 분기 — service-host/owner/agent 3 portal route 활성화) | portal_type drift 시 잘못된 middleware 적용 가능 (CF-005) | sync | ✗ |
| owner-portal.ts:344 revenue read | bookings + invoices + payments 측 read (cross-domain) | owner 측 revenue 통계 — finance 도메인 source | sync | n/a (read-only) |
| agent-portal.ts:228 commission read | commissions table 측 read (CF-001 carrier `real`) | agent 측 commission 통계 — finance 도메인 source | sync | n/a (read-only) |

**audit coverage**: T002.2.g 결과 **0/22 = 0% audit floor** (6-way TIE 일치).

---

## §5 Cross-references + R-REPO-7 trade-off + Self-check

### §5.1 Cross-references

- Endpoints: [api-endpoints/portal-partner.md](../_schema/api-endpoints/portal-partner.md) (22 ep / 581 lines).
- Schema: [db-schema-overview.md §1.5 Identity cluster](../_schema/db-schema-overview.md).
- ERD: [erd-core.md §6 Identity cluster](../_schema/erd-core.md).
- State machines: [state-machines.md §4 work_orders + §7 cross-pack matrix](../_schema/state-machines.md).
- Pair (guest): [domain-logic-portal-guest.md §1.4](./domain-logic-portal-guest.md) — Stripe 3 site CF-014 carrier 2 site (본 도메인 POSITIVE :365 와 비교 reference).
- Pair (public): [domain-logic-public.md](./domain-logic-public.md).
- Pair (admin): [domain-logic-admin.md §1.5 admin-users](./domain-logic-admin.md) — partner_users 관리 측.
- Cross-domain (booking): [domain-logic-booking.md](./domain-logic-booking.md) — booking_services + work_orders state machine.
- Cross-domain (finance): [domain-logic-finance-payment.md §1.4 commissions](./domain-logic-finance-payment.md) — `commissions.amount=real` CF-001 carrier.

### §5.2 R-REPO-7 Trade-off (3개 결정)

| # | 결정 | 채택 | 미채택 | 이유 |
|---|------|------|--------|------|
| 1 | 4 routes 통합 표기 | §1.1 통합 + §1.2-1.5 각 route 별 sub-section | (a) route 별 4 sub-section 만 / (b) endpoint type 별 통합 | 4 route 가 다른 partner type — sub-section 분리 우위 + §1.1 표 통합 navigation 가속 |
| 2 | CF-014 POSITIVE :365 표기 | §1.2 표 + 코드 snippet line-by-line + §2.2 workflow ✅ marker | (a) workflow only / (b) 표 only | repo 3 known production Tx site #2 of 3 = reference exemplar — line-by-line snippet 우위 (Phase 2 reference 직접 인용 가능) |
| 3 | CF-005 portal_type drift 표기 | §1.5 partner-auth sub-section + INV3 분리 + §2.1 workflow CF-005 marker | (a) INV3 단순 줄 / (b) partner-auth section only | TS literal vs runtime drift 의 도메인 의미 + Phase 2 prescription (TS extend + DB CHECK 추가) 보존 우위 |

### §5.3 R-REPO-5 Incidental disposition (0 신규)

본 sub-task 신규 incidental 0. CF-005 + CF-001 + CF-014 cross-ref 만 (이미 등록).

### §5.4 3-claim spot-check

| # | Claim | 검증 방법 | 결과 |
|---|-------|-----------|------|
| C1 | service-host-portal.ts:365 transaction = SELECT FOR UPDATE + INSERT loop + Cloudinary cleanup catch | `sed -n '363,395p' service-host-portal.ts` | ✅ db.transaction + tx.execute SELECT FOR UPDATE + 2 guard + for-loop INSERT + try/catch cleanup |
| C2 | partner-auth.ts:11 login decode portal_type 3 value runtime (CF-005 drift) | `sed -n '1,65p' partner-auth.ts` + grep "portal_type" | ✅ login 측 portal_type read + middleware 측 4 종 분기 (requireAgentAuth/requireOwnerAuth/requireServiceHostAuth/requirePartnerAuth) |
| C3 | 22/22 IDOR-safe qualified — owner+agent 모두 read-only / service-host = sole-owner | T002.2.g portal-partner.md §4 27-cell self-check + 본 도메인 mutator count = 3 (service-host PATCH + DELETE + photo upload tx) | ✅ owner/agent 측 mutator 0 + service-host 측 3 mutator 모두 partner.id compound WHERE (강제 sole-owner) |

3/3 spot-check ✅.

---

**T003 묶음 4 sub-task 2 (portal-partner) 완료. public sub-task 진행.**
