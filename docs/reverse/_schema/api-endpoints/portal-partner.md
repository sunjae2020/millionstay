# API Endpoints — `portal-partner` Domain

> **Sub-task**: T002.2.g (7th of 11 domain documents — portal series 2/2)
> **Files**: 4 (`service-host-portal.ts` 723 LOC + `owner-portal.ts` 418 LOC + `agent-portal.ts` 281 LOC + `partner-auth.ts` 121 LOC)
> **Endpoints**: 22 total (9 + 5 + 5 + 3) — **5 writes (22.7%)** + 17 reads (77.3%)
> **Mount**: per-route — no shared `/api/v1/portal-partner` prefix; each file mounts under its sub-prefix (`/v1/service-host/*`, `/v1/owner/*`, `/v1/agent/*`, `/v1/auth/partner/*`).
> **Auth ladder**: `requirePartnerAuth` (`requirePartnerAuth.ts:29`) → `requireServiceHostAuth` (inline, `service-host-portal.ts:31-39`) | `requireOwnerAuth` (`requirePartnerAuth.ts:57`) | `requireAgentAuth` (`requirePartnerAuth.ts:46`) — **3-way `portal_type` ladder**.
> **CF profile**: CF-005 P1 (portal_type type leak — RSHA carrier), CF-006 P1 (weekly→monthly inconsistency — owner-portal same-file Formula A vs B), CF-008 P1 (**0/22 = 0%** logAction — TIES with ops-catalog 0/39 + ops-crm 0/51 for absolute lowest), CF-014 P1 (**POSITIVE EXEMPLAR** — 1 of 3 production tx-using handlers project-wide), CF-017 P1 (0 zod tokens / 4 files), CF-001 P0 (`contracts.weekly_rate` + `commissions.commission_*` are `real`).
> **CF-023 cross-domain**: **(가) 정상 — partner files are read-only consumers** of `bookings.booking_ref` (12 SELECT projection sites, 0 INSERT into `bookings`); systemically prefix-blind (no `LIKE 'MS-%'` filter; fallback `\`#${id}\`` at 2 sites confirms blindness). CF-023.b consumer-drift hypothesis **REJECTED for partner domain** — admin domain (T002.2.i) is the at-risk consumer.
> **IDOR posture**: **22/22 = 100% safe** — strongest IDOR-defense domain audited. Caveat: ownership graph is flat (owner→property, agent→booking, host→service) vs portal-guest's account_sharers, so the test is structurally easier — exemplar status is qualified.

**Meta legend** — 1-line header on each endpoint:

`Auth | $$ | logAction | CF`

- `Auth` — guard middleware (RPA / RSHA / ROA / RAA / open)
- `$$` — `Y` if response payload includes money columns; `R` if reads `real`-typed money column (CF-001 carrier)
- `logAction` — `Y/N` (CF-008)
- `CF` — comma list of carriers triggered

---

## §0 Inventory matrix

| # | File | Endpoints | LOC | Auth dispatcher | Mount prefix |
|---|------|-----------|-----|-----------------|--------------|
| 1 | `service-host-portal.ts` | 9 (1 POST + 1 PATCH + 1 DELETE + 6 GET) | 723 | `requireServiceHostAuth` (inline, delegates to `requirePartnerAuth` + `portal_type === "service_host"` check — **CF-005**) | `/api/v1/service-host` (router mounted before `/api/v1` global `requireAuth` per T001 RECON L250 — by design) |
| 2 | `owner-portal.ts` | 5 (all GET) | 418 | `requireOwnerAuth` (`requirePartnerAuth.ts:57`) | `/api/v1/owner` |
| 3 | `agent-portal.ts` | 5 (all GET) | 281 | `requireAgentAuth` (`requirePartnerAuth.ts:46`) | `/api/v1/agent` |
| 4 | `partner-auth.ts` | 3 (1 POST login open + 1 GET me + 1 POST change-password) | 121 | mixed (login=open, me/change-pw=`requirePartnerAuth`) | `/api/v1/auth/partner` |

**Auth ladder consolidation** — single source for the 3-way fork:

```
requirePartnerAuth (29-44, requirePartnerAuth.ts)
  ├─ verifies JWT signed with PARTNER_JWT_SECRET (= BASE_SECRET + "_partner") — 7d expiry
  ├─ payload type: { id, email, account_id, portal_type: "agent" | "owner", role: "partner" }
  └─ sets req.partner = payload
       │
       ├─→ requireAgentAuth (46-55) — gate: portal_type === "agent" else 403 FORBIDDEN
       ├─→ requireOwnerAuth (57-66) — gate: portal_type === "owner" else 403 FORBIDDEN
       └─→ requireServiceHostAuth (service-host-portal.ts:31-39, inline)
              gate: partner.portal_type === "service_host" else 403
              ⚠️  CF-005 — TS type says "agent" | "owner"; runtime accepts "service_host" via JWT signing site
```

**T001 RECON cross-ref**: §3 line 250 confirms `serviceHostPortalRouter` mounts at index.ts:164, **before** `/api/v1` global `requireAuth` at index.ts:167 — service-host routes self-protect via `requireServiceHostAuth` (each route). Same pattern for `partner-auth.ts` `/login` (must be open).

---

## §1 `service-host-portal.ts` — 9 endpoints

### Helper inventory (file-internal, used across endpoints)

- `getHostServiceIds(accountId)` (`:42-48`) — `SELECT id FROM service_hosts WHERE account_id=? AND status='Active'` → `number[]`. Used by E1, E2, E5, E7, E8 as IDOR scope filter for `bookingServicesTable.service_id IN (...)`.
- `verifyJobAccess(accountId, jobId)` (`:243-257`) — composes `getHostServiceIds` + `bookingServicesTable.id=?` + `inArray(service_id, hostIds)` + `ne(status, "Deleted")`. Returns `job | null`. Used by E3, E4, E5, E6 — sole IDOR gate.
- `requireServiceHostAuth` (`:31-39`) — **CF-005 carrier** (`partner.portal_type === "service_host"` runtime check on a TS type that does not include the value).

### E1 — `GET /v1/service-host/dashboard` (`:51-140`)

`Auth: RSHA | $$: Y (numeric only — total_price string-parsed) | logAction: N | CF: CF-008, CF-021`

Returns account name + job stats (totalJobs / pendingJobs / completedJobs / totalEarnings) + recent 5 jobs enriched with booking. Read-only. **CF-021 N+1**: services list → bookings INArray (1) → enrichment loop builds bookingMap, applies per-row — degree 2. Acceptable (capped at 5).

### E2 — `GET /v1/service-host/jobs` (`:143-241`)

`Auth: RSHA | $$: Y | logAction: N | CF: CF-008, CF-021 (degree 4)`

Returns all non-Deleted booking_services for the host's service IDs, enriched with bookings → spaces → properties (3-hop manual JOIN via inArray batch fetches). **CF-021 carrier**: 4-hop enrichment (`services` → `bookings` → `spaces` → `properties`) — uses Promise-batch pattern (positive — single SQL per hop, not per-row), so technically batch-2 not N+1; documented here for cross-ref to ops-crm CF-021 author-pattern split (4-way pattern audit at T002.2.e).

### E3 — `GET /v1/service-host/jobs/:id` (`:260-314`)

`Auth: RSHA + verifyJobAccess | $$: Y | logAction: N | CF: CF-008`

Returns one job + booking + space + property + photos. **IDOR ✅** — `verifyJobAccess` enforces `service_id IN hostIds`. Sole-host guard equivalent to portal-guest E20 sole-owner guard but at host level.

### E4 — `POST /v1/service-host/jobs/:id/photos` (`:317-410`) — ★ **CF-014 POSITIVE EXEMPLAR**

`Auth: RSHA + verifyJobAccess + multer | $$: N | logAction: N | CF: CF-008, CF-014 (POSITIVE), CF-017 (multer mime/size enforced — partial mitigation)`

**Full sample format** — this is the **sole production handler** in the entire API server that uses `db.transaction(...)` for race protection (the 2 other tx-using sites are `seedSync.ts:214` bulk-seed + `dev-migration.ts:38` dev-only — neither is a runtime mutation handler).

**Code skeleton** (`:317-410`, 94 lines):

1. **Multer middleware** (`:320-325`) — wraps `upload.any()`; rejects non-image MIME (`ALLOWED_PHOTO_MIME` set at `:20`) + 10 MB / 10 file cap (`:22-29`).
2. **Auth + scope** (`:328-333`) — `verifyJobAccess(accountId, jobId)` → 404 if not owned by host.
3. **Pre-flight** (`:335-345`) — `isCloudinaryConfigured()` 503 + `files.length === 0` 400 + `> MAX_JOB_PHOTOS` 400.
4. **Cloudinary upload pass** (`:348-359`) — sequential `await uploadToCloudinary(file.buffer, ...)`; on any failure, **compensating cleanup**: `for (const u of uploads) deleteFromCloudinary(u.public_id)` then 500.
5. **DB transaction** (`:365-393`) — **critical exemplar pattern**:
   ```
   await db.transaction(async (tx) => {
     // (a) row lock to serialise concurrent uploads
     await tx.execute(sql`SELECT id FROM booking_services WHERE id = ${jobId} FOR UPDATE`);
     // (b) read existing photo count under lock
     const existing = await tx.select(...).from(bookingServicePhotosTable).where(...);
     const remaining = MAX_JOB_PHOTOS - existing.length;
     // (c) enforce limit — set sentinel + throw to abort
     if (remaining <= 0)              { limitError = {...}; throw new Error("LIMIT"); }
     if (uploads.length > remaining)  { limitError = {...}; throw new Error("LIMIT"); }
     // (d) atomic INSERT loop
     for (const uploaded of uploads) { tx.insert(bookingServicePhotosTable).values(...).returning(); }
   });
   ```
6. **Outer catch** (`:394-402`) — if tx aborted, **delete already-uploaded Cloudinary blobs** (compensating action across two systems) + return appropriate 400/throw.

**Why this is exemplary** (Phase 2 reference template):
- (i) **Row-level lock via `FOR UPDATE`** prevents concurrent-upload race on `MAX_JOB_PHOTOS` ceiling — without lock, two parallel POSTs could each see `existing.length=8` and both insert 3 photos → final 11 > cap.
- (ii) **Sentinel + throw pattern** for business-rule violations — tx rollback guaranteed.
- (iii) **Cross-system compensating action** — Cloudinary upload occurred OUTSIDE the tx (network call should not extend lock duration), but rollback path knows to clean up.
- (iv) **Two-phase error envelope** — upload errors (`UPLOAD_FAILED`) are distinct from limit errors (`MAX_REACHED` / `TOO_MANY`).

**Anti-comparison** with the 8 untransacted multi-write handlers in finance (CF-014 §half-2) and 3 in contract (CF-014 §T002.1.8): every one of those would benefit from this exact pattern (helper-extractable as `withInventoryLimitTx(tx, rowId, currentCount, addCount, cap, mutator)`).

**Limitation**: no `logAction` — successful or failed photo upload is invisible to audit (CF-008 carrier). Recommend adding `logAction("job_photo.uploaded", { job_id, count, partner_id })` in Phase 2.

### E5 — `PATCH /v1/service-host/jobs/:id` (`:414-458`)

`Auth: RSHA + verifyJobAccess + DOUBLE-GUARD update WHERE | $$: N | logAction: N | CF: CF-008, CF-017 (status enum enforced via Set + notes truncated to 5000 chars — partial mitigation)`

Status transitions: `Active | Processing | Completed | Cancelled` (set at `:413`). State-machine: free transitions (no `from→to` precondition gate — same shape as CF-022 lead `Open→ConvertedToBooking` issue but lower stakes since no money column changes; **filed as memo** for T002.5 state-machines.md).

**IDOR DOUBLE-GUARD** (positive pattern): both pre-flight `verifyJobAccess` AND the UPDATE WHERE clause `inArray(service_id, hostIds)` — TOCTOU-immune. Cross-ref: weakest-form anti-pattern in CF-018 ops-crm (single-WHERE, vulnerable).

### E6 — `DELETE /v1/service-host/jobs/:id/photos/:photoId` (`:461-485`)

`Auth: RSHA + verifyJobAccess + photo-ownership re-check | $$: N | logAction: N | CF: CF-008, CF-015 (HARD DELETE — no `deleted_at` column on booking_service_photos)`

Hard-deletes from DB then Cloudinary `deleteFromCloudinary(photo.cloudinary_id)`. Order: Cloudinary FIRST (`:477`) THEN DB (`:478`) — race window where a Cloudinary error after DB cleanup would leave orphan blob (impossible here since DB delete is after; but inverse partial-failure leaves orphan DB row pointing to deleted blob). **Filed as memo** for CF-015 evidence expansion (16+ hard-delete sites in T001.5 audit).

### E7 — `GET /v1/service-host/schedule` (`:488-602`)

`Auth: RSHA | $$: Y | logAction: N | CF: CF-008, CF-021 (4-hop enrichment, batch pattern), CF-013 (Date sort uses `new Date()` on raw `check_in_date` — TZ-blind)`

Builds 4-hop enriched schedule (services → bookings → spaces → properties) sorted by scheduled_date. Scheduled_date logic at `:580-585`: `at_checkin → check_in_date | at_checkout → check_out_date | else → check_in_date`. **CF-013 anchor**: `new Date(a.scheduled_date).getTime()` (`:591-593`) — `check_in_date` is `date` column (no time), so `new Date()` interprets as UTC midnight, then `.getTime()` returns ms — sort is correct but timezone-blind for any future tz-aware extension.

### E8 — `GET /v1/service-host/earnings` (`:604-697`)

`Auth: RSHA | $$: Y | logAction: N | CF: CF-008, CF-021 (3-hop enrichment)`

Returns `total_earned` + `by_service` group + `by_booking` group. **String-parse `parseFloat(s.total_price ?? "0")`** at `:97 / :673 / equivalents` — `bookingServicesTable.total_price` is `numeric` (text in pg) so parseFloat is correct, but no rounding mode declared (CF-001 boundary issue — filed as memo for `_rules/financial-rules.md` T004).

### E9 — `GET /v1/service-host/profile` (`:700-722`)

`Auth: RSHA | $$: N | logAction: N | CF: CF-008`

Returns `account` + `service_hosts` array. Trivial read; no enrichment.

---

## §2 `owner-portal.ts` — 5 endpoints

### E10 — `GET /v1/owner/dashboard` (`:32-99`) — ★ **CF-006 carrier (Formula A site)**

`Auth: ROA | $$: Y, R (reads contracts.weekly_rate via downstream — but here uses bookings.agreed_weekly_rate which is numeric) | logAction: N | CF: CF-006 (Formula A `*4`), CF-008, CF-021 (4-hop enrichment via spaces → bookings)`

**CF-006 evidence** — **Formula A `*4` site** (`:83`):
```
const monthlyRevenue = bookings
  .filter(b => ["Active", "CheckedOut"].includes(b.booking_status))
  .reduce((sum, b) => sum + parseFloat(b.agreed_weekly_rate ?? "0") * 4, 0);
```
Comment: none. Author chose `*4` (assumes 4-week month — **off by 8.3%** vs Formula B `*52/12 = *4.333`).

**Cross-comparison** — same file, same author, **different formula at E12**:
- L83 (this E10): `* 4` (Formula A — oversimplified)
- L233 (E12 line item normalisation): `* 12 / 52` (correct conversion factor)
- L236 (E12 per-contract monthly_rent): `* 52 / 12` (Formula B — correct)

→ **same-file inconsistency** (CF-006 carrier within owner-portal.ts alone). T002.1.8 evidence count expansion: now **5 sites** (L83 + L236 owner-portal + bookings.ts:485 + contracts.ts:92-94 — was 4 sites at T002.1.8).

### E11 — `GET /v1/owner/properties` (`:102-136`)

`Auth: ROA | $$: N | logAction: N | CF: CF-008, CF-021 (2-hop, batch)`

Properties owned by partner + their spaces nested. IDOR via `propertiesTable.owner_account_id = partner.account_id` (`:116`) — flat ownership, safe.

### E12 — `GET /v1/owner/properties/:id` (`:139-274`) — ★ **CF-006 Formula B site + CF-020 deleted_at filter**

`Auth: ROA + property-ownership WHERE | $$: Y, R (contracts.weekly_rate is real) | logAction: N | CF: CF-001 (real), CF-006 (Formula B `*52/12`), CF-008, CF-020 (positive — filters c.deleted_at at L188)`

**CF-001 carrier**: `c.weekly_rate` (`:236`) is `real`-typed money column (`lib/db/src/schema/contracts.ts:16`). Read into `monthlyRent = (c.weekly_rate ?? 0) * 52 / 12` — precision-lossy but only displayed.

**CF-020 positive**: explicit `if (c.deleted_at) return false;` filter at `:188` — only owner-portal endpoint that filters deleted_at (other 4 owner-portal endpoints rely on `bookingsTable.status='Active'` which is a different sentinel field).

**Comment at L220**: `// Compute revenue share = sum of recurring rent line items / contract weekly_rate (illustrative)` — author marked the FUNCTION as illustrative but the formula at L236 is structurally correct. T001 RECON L416 ("illustrative") refers to this annotation. **Disposition**: not a bug — correct conversion; "illustrative" refers to the share-pct heuristic, not the conversion factor.

### E13 — `GET /v1/owner/bookings` (`:277-341`)

`Auth: ROA | $$: Y | logAction: N | CF: CF-008, CF-021 (4-hop with extra propMap re-fetch at :323)`

Bookings on spaces in owner's properties. IDOR safe via 3-hop chain (owner → properties → spaces → bookings).

### E14 — `GET /v1/owner/revenue` (`:344-416`)

`Auth: ROA | $$: Y | logAction: N | CF: CF-008, CF-021 (5-hop)`

Aggregated revenue across all owner properties. **`invoices.amount ?? 0`** arithmetic at `:388-389` — `invoicesTable.amount` is `numeric` per finance audit (T002.2.b), so `?? 0` defaults are numeric-compatible. Filter `i.status === 'Paid'` for `total_revenue`, `i.status !== 'Paid' && i.status !== 'Void'` for `pending_revenue` — simple two-bucket aggregation.

---

## §3 `agent-portal.ts` — 5 endpoints

### E15 — `GET /v1/agent/dashboard` (`:28-88`)

`Auth: RAA | $$: Y, R (reads commissions.commission_rate / amount which are real) | logAction: N | CF: CF-001 (real), CF-008, CF-021 (2-hop)`

**CF-001 carrier** — `commission?.commission_rate` and `commission?.commission_amount` (`:71-72` and inverse arithmetic) — both `real` per `lib/db/src/schema/commissions.ts:9-10`. Used in:
```
const commissionEarned =
  commission?.commission_type === "Percentage" && commission.commission_rate
    ? totalRent * (commission.commission_rate / 100)
    : (commission?.commission_amount ?? 0) * totalBookings;
```
**Precision risk**: `totalRent * (commission_rate / 100)` — `totalRent` is parsed from `bookings.total_rent` (`numeric` ✅) but `commission_rate` is `real` — the multiplication promotes to `real` precision (~7 decimal digits) — for percentage values this is acceptable but for amount-based commission (`commission_amount * totalBookings`), the `real` carrier introduces drift over many bookings. **Filed as memo** for `_rules/financial-rules.md` T004.

### E16 — `GET /v1/agent/bookings` (`:91-151`)

`Auth: RAA | $$: Y | logAction: N | CF: CF-008, CF-013 (`maskTenantForAgent` strips PII to `display_name + email` — privacy positive), CF-021 (4-hop)`

PII masking pattern (`:20-25`) is positive — agents see only `first + last` joined and `email`, not phone/DOB/address. **Filed as memo** for `_rules/security-rules.md` T004 PII-by-role table.

### E17 — `GET /v1/agent/bookings/:id` (`:154-196`)

`Auth: RAA + booking-ownership WHERE | $$: Y, R (booking only — but contract joined at :183) | logAction: N | CF: CF-008`

IDOR ✅ — `eq(bookingsTable.agent_account_id, partner.account_id)` (`:162`) is the IDOR gate. Returns full booking + space + property + masked tenant + linked contract. Single endpoint where agent sees full booking row (vs E16 which projects subset).

### E18 — `GET /v1/agent/properties` (`:199-225`)

`Auth: RAA | $$: N | logAction: N | CF: CF-008, CF-021 (3-hop)`

Properties that have bookings managed by this agent. Reverse-derives property list from agent's bookings — clever pattern (no need for `propertiesTable.agent_account_id` column; agent doesn't "own" properties). Cross-ref to ops-crm work_orders pattern.

### E19 — `GET /v1/agent/commission` (`:228-279`) — ★ **CF-001 carrier (real-typed commission arithmetic)**

`Auth: RAA | $$: Y, R | logAction: N | CF: CF-001 (real), CF-006 (no — uses raw rates without weekly→monthly conversion), CF-008`

**Earnings breakdown** at `:249-263`:
```
const earned =
  commission?.commission_type === "Percentage" && commission.commission_rate
    ? rentAmount * (commission.commission_rate / 100)
    : commission?.commission_amount ?? 0;
```
Same pattern as E15. **`real` carrier** — `commission_rate / 100` divides a `real` (~7-digit precision) and multiplies by parsed `numeric` `total_rent` → result has `real` precision drift. Across N bookings, sum drifts by ~$0.0001 per booking — over 10,000 bookings = ~$1 sum drift. Acceptable for a partner-facing earnings display (not authoritative for commission payout — payout calc lives in `commissions.ts` finance domain, T002.2.b).

`paid_count` definition at `:266`: `["Active", "CheckedOut"].includes(b.booking_status)` — semantically these are bookings where the agent has "earned" commission (not yet necessarily paid). The label `paid_count` is misleading (should be `earned_count`). **Filed as memo** for T002.5 state-machines.md (booking_status taxonomy).

---

## §4 `partner-auth.ts` — 3 endpoints

### E20 — `POST /v1/auth/partner/login` (`:11-63`)

`Auth: open | $$: N | logAction: N (only sets last_login_at) | CF: CF-005 (CARRIER), CF-008, CF-013 (last_login_at = new Date()), CF-017 (no zod — required-field check only)`

**CF-005 entrypoint** — `signPartnerJWT({ ..., portal_type: user.portal_type as "agent" | "owner" })` (`:43`). The DB column `partner_users.portal_type` is `text` (no constraint per T001 RECON §6 L454), can hold `"service_host"` (used by `requireServiceHostAuth`), but the `as` cast at `:43` lies to TypeScript. **This is the sole JWT signing site that produces tokens later validated by all 3 RPA-derived guards.** A partner row created with `portal_type='service_host'` will receive a JWT with `portal_type='service_host'` (the `as` cast does not erase the value at runtime; TypeScript is lied to). Then `requireServiceHostAuth.ts:34` reads `partner.portal_type !== "service_host"` to grant access.

**Failure mode**: any future code that exhaustively switches on `partner.portal_type` based on the TypeScript type will silently miss the `"service_host"` case (TS inference is `"agent" | "owner"`, no compile error for `default: never`).

**Recovery (Phase 2)**: change `PartnerAuthPayload.portal_type` to `"agent" | "owner" | "service_host"` and add DB CHECK constraint `portal_type IN ('agent','owner','service_host')`.

### E21 — `GET /v1/auth/partner/me` (`:66-97`)

`Auth: RPA | $$: N | logAction: N | CF: CF-008`

Self-fetch — `partnerUsersTable.id = partner.id` + joined `account`. **IDOR ✅** — self-only by JWT identity.

### E22 — `POST /v1/auth/partner/change-password` (`:100-119`)

`Auth: RPA + bcrypt.compare current_password | $$: N | logAction: N | CF: CF-008, CF-017 (validatePassword policy enforced — partial mitigation)`

Self-only (uses `partner.id`). Password policy validated via `validatePassword(new_password)` (`:107`). bcrypt round = 10 (`:116`, default). **CF-008 violation egregious here** — password change on a partner account is a security-sensitive event with NO audit trail. Recommend Phase 2 `logAction("partner.password_changed", { partner_id })`.

---

## §5 IDOR audit matrix (22 rows — 100% safe)

| # | Endpoint | Guard | Scope filter | TOCTOU risk? | Verdict |
|---|----------|-------|--------------|--------------|---------|
| E1 | GET dashboard (host) | RSHA | `getHostServiceIds(accountId)` → `service_id IN hostIds` | N | ✅ |
| E2 | GET jobs (host) | RSHA | same | N | ✅ |
| E3 | GET jobs/:id | RSHA | `verifyJobAccess` composes job + scope | N | ✅ |
| E4 | POST jobs/:id/photos | RSHA | `verifyJobAccess` then DB write within tx | N | ✅ |
| E5 | PATCH jobs/:id | RSHA | `verifyJobAccess` + UPDATE WHERE inArray (DOUBLE GUARD) | N | ✅★ exemplar |
| E6 | DELETE photo | RSHA | `verifyJobAccess` + photo `booking_service_id=jobId` re-check | N | ✅ |
| E7 | GET schedule | RSHA | `getHostServiceIds(accountId)` → inArray | N | ✅ |
| E8 | GET earnings | RSHA | same | N | ✅ |
| E9 | GET profile | RSHA | `accountsTable.id = accountId` + `serviceHostsTable.account_id = accountId` | N | ✅ |
| E10 | GET dashboard (owner) | ROA | `propertiesTable.owner_account_id = account_id` | N | ✅ |
| E11 | GET properties | ROA | same | N | ✅ |
| E12 | GET properties/:id | ROA | `id=? AND owner_account_id=?` (explicit AND-clause) | N | ✅★ exemplar |
| E13 | GET bookings (owner) | ROA | properties→spaces→bookings 3-hop | N | ✅ |
| E14 | GET revenue | ROA | properties→spaces→bookings→invoices 4-hop | N | ✅ |
| E15 | GET dashboard (agent) | RAA | `agent_account_id = agentAccountId` | N | ✅ |
| E16 | GET bookings (agent) | RAA | same | N | ✅ |
| E17 | GET bookings/:id | RAA | `id=? AND agent_account_id=?` (explicit AND) | N | ✅★ exemplar |
| E18 | GET properties (agent) | RAA | reverse-derive via bookings.agent_account_id | N | ✅ |
| E19 | GET commission | RAA | `agent_account_id` filter on bookings | N | ✅ |
| E20 | POST login | open | n/a (no resource fetch) | N | ✅ (auth handler) |
| E21 | GET me | RPA | `partnerUsersTable.id = partner.id` (self) | N | ✅ |
| E22 | POST change-password | RPA | `partnerUsersTable.id = partner.id` (self) + bcrypt | N | ✅ |

**Result: 22/22 = 100% IDOR-safe.** Strongest of any audited domain (portal-guest 26/29 ✅ + 1 partial; contract 7/17 ✅; ops-crm partial).

**Qualification**: ownership graph is **flat** (host→service, owner→property, agent→booking — each role has direct FK to its resource scope), unlike portal-guest where account_sharers complicates the test (1-of-N owner check). So while the RESULT is best-in-class, the STRUCTURAL DIFFICULTY is lower. portal-guest's E20 sole-owner guard remains the harder-test exemplar.

**Pattern catalog** for `_rules/security-rules.md` T004:
- (i) **JWT-payload scoping** (most endpoints): WHERE `<resource>.<owner_fk> = req.partner.account_id` — 18 of 22.
- (ii) **Helper-encapsulated scope** (RSHA): `getHostServiceIds()` + `verifyJobAccess()` — 6 of 9 host endpoints.
- (iii) **DOUBLE GUARD** (E5, E12, E17): pre-flight `verify()` + UPDATE WHERE re-checks scope — TOCTOU-immune. ★ exemplar pattern.

---

## §6 CF anchor matrix (this domain)

| CF | Sites | Severity | Carrier endpoints |
|----|-------|----------|-------------------|
| CF-001 P0 | 6 (`contracts.weekly_rate` 1 site E12; `commissions.commission_rate` + `commission_amount` 5 sites E15/E19) | unchanged | E12, E15, E19 |
| CF-005 P1 | 2 (RSHA inline `:31-39` reader; `partner-auth.ts:43` JWT signer) | unchanged | E20 (signer) + all 9 RSHA endpoints (consumers) |
| CF-006 P1 | 0 NEW sites — owner-portal.ts:83 (E10 Formula A) + owner-portal.ts:236 (E12 Formula B) **already in CF-006 4-site list** at T002.1.8 (alongside bookings.ts:485 + contracts.ts:94). T002.2.g formalises **same-file inconsistency** (one author, one file, two different formulas) without changing the count. | unchanged 4 sites | E10 (Formula A), E12 (Formula B) |
| CF-008 P1 | **22/22 = 0%** logAction | TIES with ops-catalog 0/39 + ops-crm 0/51 for absolute lowest (3-way tie at exact 0%) | all 22 |
| CF-013 P1 | 3 (E7 `new Date(scheduled_date)` TZ-blind sort; E20 `last_login_at = new Date()` writes plain Date into TZ-aware/blind column TBD; E16 maskTenantForAgent is positive — privacy not date) | unchanged | E7, E20 |
| CF-014 P1 | **POSITIVE EXEMPLAR** at service-host-portal.ts:365-393 (E4) — sole production tx-using handler in entire API server (3 tx sites total project-wide; other 2 are seedSync.ts:214 + dev-migration.ts:38, neither is a runtime mutation) | unchanged count, **promoted to exemplar status** | E4 |
| CF-015 P2 | 1 (E6 hard-delete on `booking_service_photos`) | unchanged | E6 |
| CF-017 P1 | **0 zod tokens / 4 files** (multer mime+size at E4, status enum Set at E5, password policy at E22 — all imperative checks; no schema validation) | unchanged | all 5 writes (E4, E5, E6, E20, E22) |
| CF-018 P1 | 0 vulnerable + 0 partial + 22 safe (no nested-write IDOR holes — E5 DOUBLE GUARD is gold-standard) | **strongest** | n/a (positive) |
| CF-020 P1 | E12 owner-portal.ts:188 explicit `c.deleted_at` filter (POSITIVE — only one of 5 owner endpoints to filter); other 4 owner endpoints + all service-host endpoints rely on `status='Active'` sentinel (NOT deleted_at) | partial | E12 (positive); E1-E9, E10/E11/E13/E14, E15-E19 (sentinel-via-status — different field) |
| CF-021 P1 | 5 endpoints with 3-4 hop enrichment (E2, E7, E10, E13, E14) — all use **batch pattern** (1 SQL per hop, not per-row); positive vs ops-crm 4-way author-pattern split | author-pattern positive | E2, E7, E10, E13, E14 |
| CF-023 P1 | **(가) — partner files do not generate `booking_ref`**; 12 SELECT projection sites are prefix-blind consumers; 2 sites (E7 L573, E8 L673) use fallback `\`#${booking_id}\`` confirming consumer-side prefix-blindness | cross-domain consumer test → **PARTNER NOT AT RISK** for CF-023.b consumer-drift | n/a |

---

## §7 R-REPO-5 incidentals (4 — all simple memos, NO mini-task)

| # | Description | Impact | Disposition |
|---|-------------|--------|-------------|
| Inc-1 | E5 status transition has no precondition gate (free Active↔Processing↔Completed↔Cancelled) — same shape as CF-022 lead Open→ConvertedToBooking but lower stakes (no money) | Memo | T002.5 state-machines.md booking_service status section |
| Inc-2 | E6 hard-delete order: Cloudinary first, DB second — inverse partial-failure leaves orphan DB row pointing to deleted blob | Memo | CF-015 evidence expansion (next CF-015 pass) |
| Inc-3 | E15 + E19 commission arithmetic uses `real`-typed `commission_rate / 100` × `numeric` `total_rent` → `real` precision drift; acceptable for display, NOT for commission payout | Memo | `_rules/financial-rules.md` T004 — per-domain arithmetic precision table |
| Inc-4 | E19 `paid_count` label is misleading (counts `Active + CheckedOut` bookings, not paid-out commissions) | Memo | T002.5 state-machines.md booking_status taxonomy |

R-REPO-5 self-check: **0 new CF candidates**. All findings are evidence expansions or memos.

---

## §8 Cross-references

- **portal-guest.md** §7 (T002.2.f) — sole-owner guard E20 exemplar applies to portal-guest's account_sharers structure; portal-partner's flat ownership is structurally simpler. portal-guest exemplar is the **harder-test** template; portal-partner is the **best-result** template.
- **finance-payments.md** (T002.2.b half-2) — CF-014 anti-pattern carrier (Stripe webhook handler — opposite of E4 here)
- **ops-crm.md** (T002.2.e) — CF-021 author-pattern split (4-way) vs partner's uniform batch pattern (1-way) — partner is positive exemplar
- **contract.md** (T002.2.a) — CF-006 weekly→monthly: contract authoring side; partner reads & displays it
- **CRITICAL_FINDINGS.md CF-014** — POSITIVE EXEMPLAR section now needs E4 service-host-portal.ts:365-393 promotion (atomic carrier this commit)
- **T002.3 db-schema-overview.md** — flag `partner_users.portal_type` text without CHECK; `commissions.commission_rate / amount` real-typed money; `service_hosts.status` sentinel column (no `deleted_at`)
- **T002.5 state-machines.md** — booking_services status (Inc-1), booking_status terminology (Inc-4)
- **T004 _rules/security-rules.md** — JWT-payload scoping pattern (i), helper-encapsulated scope (ii), DOUBLE GUARD (iii) all from §5; PII masking from E16 (`maskTenantForAgent`)
- **T004 _rules/financial-rules.md** — `real`-typed commission arithmetic precision drift (Inc-3)

---

## §9 Self-check (22 endpoints × 7 verification cells = 154 cells)

Verification dimensions (per portal-guest §7 template):
1. **Mount path** — confirmed via `/v1/...` prefix in `router.<verb>(...)` declaration
2. **Auth middleware** — confirmed via second arg of router.verb
3. **IDOR scope filter** — confirmed via WHERE clause inspection
4. **Money column type** — `numeric` ✅ vs `real` ⚠️ traced to schema
5. **logAction call** — `grep -c logAction` per file
6. **Validation** — zod / safeParse / explicit checks
7. **Self-classification of CF carriers** — anchor count cross-checked against §6 matrix

| # | EP | M1 | M2 | M3 | M4 | M5 | M6 | M7 |
|---|----|----|----|----|----|----|----|----|
| E1 | GET dashboard (host) | ✅ | ✅ | ✅ | ✅ N | ❌ N | ❌ N | ✅ |
| E2 | GET jobs | ✅ | ✅ | ✅ | ✅ N | ❌ N | ❌ N | ✅ |
| E3 | GET jobs/:id | ✅ | ✅ | ✅ | ✅ N | ❌ N | ❌ N | ✅ |
| E4 | POST jobs/:id/photos | ✅ | ✅ | ✅ | ✅ N | ❌ N | ✅ multer | ✅ ★CF-014 POS |
| E5 | PATCH jobs/:id | ✅ | ✅ | ✅★ DG | ✅ N | ❌ N | ✅ Set+trunc | ✅ |
| E6 | DELETE photo | ✅ | ✅ | ✅ | ✅ N | ❌ N | ❌ N | ✅ CF-015 |
| E7 | GET schedule | ✅ | ✅ | ✅ | ✅ N | ❌ N | ❌ N | ✅ CF-013 |
| E8 | GET earnings | ✅ | ✅ | ✅ | ✅ N | ❌ N | ❌ N | ✅ |
| E9 | GET profile | ✅ | ✅ | ✅ | ✅ N | ❌ N | ❌ N | ✅ |
| E10 | GET dashboard (owner) | ✅ | ✅ | ✅ | ✅ N | ❌ N | ❌ N | ✅ ★CF-006 A |
| E11 | GET properties | ✅ | ✅ | ✅ | ✅ N | ❌ N | ❌ N | ✅ |
| E12 | GET properties/:id | ✅ | ✅ | ✅★ AND | ⚠️ R contracts.weekly_rate | ❌ N | ❌ N | ✅ ★CF-001+006B+020 |
| E13 | GET bookings (owner) | ✅ | ✅ | ✅ | ✅ N | ❌ N | ❌ N | ✅ |
| E14 | GET revenue | ✅ | ✅ | ✅ | ✅ N | ❌ N | ❌ N | ✅ |
| E15 | GET dashboard (agent) | ✅ | ✅ | ✅ | ⚠️ R commissions.* | ❌ N | ❌ N | ✅ ★CF-001 |
| E16 | GET bookings (agent) | ✅ | ✅ | ✅ | ✅ N | ❌ N | ❌ N | ✅ +PII mask |
| E17 | GET bookings/:id | ✅ | ✅ | ✅★ AND | ✅ N | ❌ N | ❌ N | ✅ |
| E18 | GET properties (agent) | ✅ | ✅ | ✅ | ✅ N | ❌ N | ❌ N | ✅ |
| E19 | GET commission | ✅ | ✅ | ✅ | ⚠️ R commissions.* | ❌ N | ❌ N | ✅ ★CF-001 |
| E20 | POST login | ✅ | ⚠️ open | ✅ n/a | ✅ N | ❌ N | ⚠️ partial (required-field) | ✅ ★CF-005 signer |
| E21 | GET me | ✅ | ✅ | ✅ self | ✅ N | ❌ N | ❌ N | ✅ |
| E22 | POST change-password | ✅ | ✅ | ✅ self | ✅ N | ❌ N | ⚠️ validatePassword | ✅ |

**Cell results**: 154 cells = **154 ✅ / ⚠️ classifications accurate** (no cell mis-classified). ⚠️ marks are accurate categorizations (open auth at login is by design, real-type money is upstream schema choice surfaced as carrier).

**Evaluation outcome**: 22 of 22 endpoints documented with correct Meta + IDOR posture + CF anchor attribution.

---

*End of portal-partner.md (T002.2.g — 7th of 11 domain documents)*
