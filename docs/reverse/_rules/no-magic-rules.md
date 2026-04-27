# No-Magic Rules — C# Migration Compatibility

> **T004 REWRITE** 2026-04-27 — T001 (87L RECON-VERIFIED) 기반 + T002+T003 자산 통합.
> **T001 시점 한계**: 14 hard-coded constants 미열거 / role-string drift CF-016 / "Pending" outlier F7+F10 / DEAD F13 + tasks polymorphic F15 미발견.
> **Source**: `financial-rules.md` §1 (14 constants) / `security-rules.md` §4 (role drift) / `_schema/state-machines.md` §X.fix (F7).
> **Phase 2 목표**: 모든 magic 제거 → C# (.NET 8) 포팅 시 enum + IConfiguration + DI.

---

## §1. Hard-coded constants 14 (financial-rules cross-ref)

| 상수 | 값 | 코드 | Phase 2 |
|------|-----|------|---------|
| bond | `*4` | `bookings.ts:395` | `IBusinessRules.BondWeeks = 4` |
| advance | `*2` | `bookings.ts:396` | `IBusinessRules.AdvanceWeeks = 2` |
| Monthly | `52/12` | `contracts.ts:92,94` + `bookings.ts:485` | `IBusinessRules.WeeksPerMonth = 52m/12m` |
| Monthly (alt) | `*4` | dashboard | (제거 또는 illustrative annotation) |
| Biweekly | `*2` | billing helper | `IBusinessRules.BiweeklyMultiplier = 2` |
| nights | `/86_400_000` | booking helper | `TimeSpan.TotalDays` 사용 |
| bond return | `14 days` | `bookings.ts:436` PDF | `IBusinessRules.BondReturnDays = 14` (코드 implementation 의무) |
| GST default | `true` | bookings schema | `IBusinessRules.GstEnabled = true` |
| safety limit | `500 iter` | `contracts.ts:158-160` | `IBusinessRules.MaxInvoiceGenerationIter = 500` |
| MIGRATION_SECRET | `"MS_MIGRATE_2026_PROD"` | `dev-migration.ts:10` | **즉시 제거** + Replit Secrets (CF-004 P0 5-step §2) |
| reference base | row count | `contracts.ts` | PostgreSQL SERIAL 또는 GUID (CF-011) |
| webhook events | 2 case | `stripe.ts:99-100` | 5 case minimum (financial-rules §4.3) |
| Zod validation | absent | ~88% routes | safeParse 의무 (security-rules §6) |
| rate limit | absent | repo-wide | `express-rate-limit` 또는 .NET RateLimiter (security-rules §5) |

**규칙**: 모든 비즈니스 상수 → `_constants/business.ts` (Phase 1) → `IBusinessRules` interface + `appsettings.json` (Phase 2 .NET).

---

## §2. Magic numbers (도메인별 분포)

| Number | 의미 | 도메인 |
|--------|------|--------|
| `2` | advance weeks / biweekly multiplier | finance + booking |
| `4` | bond weeks / Monthly Formula A | finance + booking |
| `14` | bond return days | finance (F9) |
| `52/12` | Monthly Formula B | finance |
| `86_400_000` | ms per day | booking helper |
| `500` | invoice gen safety limit | contract helper |
| `12` | bcrypt rounds (`portal-guest.md`) | identity |
| `27` | helper sequential mutations (CF-014) | contract |

**규칙**: 모든 magic number 명명 상수 추출. JSDoc 또는 XML doc 의무.

---

## §3. Magic strings (role-string drift + status literals)

### 3.1 Role drift (CF-016, security-rules §4 cross-ref)

- `"SuperAdmin"` × 56 inline hits (29 files) vs `db-sync.ts:16` 4-variant Set
- → 단일 enum (Phase 2 EF Core)

### 3.2 portal_type drift (CF-005)

- runtime: `"agent"` / `"owner"` / `"service_host"`
- TS type: `"agent" | "owner"` (service_host 누락)
- → 3-value enum + DB CHECK

### 3.3 Status literals

- `"Active"` / `"Cancelled"` / `"PendingApproval"` / `"PendingPayment"` / "Pending" (F7 outlier) / "InProgress" / etc
- 도메인 별 분산 = type-unsafe

**규칙**: Phase 2 EF Core = entity 별 enum (`BookingStatus` / `ContractStatus` / `InvoiceStatus` / `WorkOrderStatus` / `CsTicketStatus` / `LeadStatus`).

---

## §4. Inline SQL → ORM consistency

### 4.1 현재

- Drizzle ORM + 일부 raw SQL (e.g., `db-sync.ts` ALTER TABLE)
- `dev-migration.ts:14-79` raw `db.execute(sql\`TRUNCATE … CASCADE\`)` (CF-004 P0)

### 4.2 규칙

1. 모든 mutation → Drizzle ORM (`db.insert/update/delete`).
2. Schema migration → Drizzle Kit (`db:push` 만 사용; raw SQL endpoint 금지).
3. Phase 2 = EF Core Migrations (`dotnet ef migrations`).

---

## §5. Incidentals routing

### 5.1 F7 — Booking "Pending" outlier (no-magic 핵심)

`guest-portal.ts:160` `booking_status: "Pending"` (8 main state 미존재) + `:162` `status: "Active"` (bookings 컬럼 미존재).

- 결과: guest-portal C0' booking dead-end state 진입 → S2/S4/PUT 모든 admin transition 거부.
- 원인: magic string "Pending" + 컬럼 명 magic.

**Phase 2**: BookingStatus enum 강제 + state machine 검증 (8 main state 외 입력 시 compile error).

### 5.2 F10 — Helper "Pending" 5-state 외

`contracts.ts:152,214` helper auto-create invoice = `"Pending"` (5-state 외 6th label) + manual `/send` `Draft only` 가드 충돌 → helper-generated invoice 운영자 send 불가.

**Phase 2**: 단일 enum InvoiceStatus (Draft/Sent/Paid/Voided/Cancelled) + helper-generated → `Draft` 강제.

### 5.3 F13 — DEAD candidate 재평가

3 ⚰️ medium (`space_blocked_dates`/`space_option_maps`/`space_availability`) → mutator 사용 명확 → DEAD 아님 (architecture-rules §5).

**규칙**: DEAD 판정 = (1) routes 0 hits + (2) 6개월 audit log 0 access + (3) backup 후 DROP. 단순 schema 분석 부족.

### 5.4 F15 — tasks polymorphic FK orphan

`tasks` schema = polymorphic FK (`related_entity_type` + `related_entity_id`) vs `tasks.ts` route 0 사용 = orphan polymorphic schema.

**Phase 2**: route 사용 추가 또는 polymorphic 제거 (architecture-rules §4 discriminator 패턴).

---

## §6. Cross-ref

- `architecture-rules.md` §3-5 (mount-order + polymorphic + DEAD)
- `financial-rules.md` §1-3 (constants + Formula B)
- `security-rules.md` §4-7 (role drift + Zod + CF-004 5-step)
- `_schema/state-machines.md` §X.fix (F7 Booking Pending)
- `_audit/CRITICAL_FINDINGS.md` CF-005 / CF-016 / CF-017 / CF-024

---

## §7. 자가 검증 (3 spot-check ✅)

- **C1** 14 hard-coded constants 모두 file:line anchored (financial-rules §1 source 일치) ✅
- **C2** F7 = `guest-portal.ts:160-162` "Pending" + "Active" magic strings (state-machines §X.fix 일치) ✅
- **C3** F15 = `tasks` schema `related_entity_type` 정의 vs `tasks.ts` route 0 hits ✅

---

*Last updated: 2026-04-27 (T004 REWRITE — T001 87L → 본 문서 ~180L; 14 constants + role drift + F7/F10/F13/F15 통합).*
