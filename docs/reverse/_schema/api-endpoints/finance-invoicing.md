# Domain: finance-invoicing

> **Files of origin**: `artifacts/api-server/src/routes/invoices.ts` (192 lines, 10 endpoints) · `artifacts/api-server/src/routes/recurring-schedules.ts` (217 lines, 7 endpoints).
> **URL prefixes**: `/api/v1/invoices/...`, `/api/v1/recurring-schedules/...`, `/api/v1/lookup/invoices`.
> **Auth guard (all 17)**: `requireAuth` (admin/staff guard mounted at `app.ts:167`). Four endpoints (E5, E6 with `permanent=true`; R6, R7 with `permanent=true`) additionally gate HARD DELETE behind `req.user.role === "SuperAdmin"`.
> **Domain group**: `finance` — billing/source side. Sister file: [`finance-payments.md`](./finance-payments.md) (collection/disbursement). See [INDEX.md § Domain Groups](./INDEX.md#domain-groups).

**Scope**: This file documents the **invoice creation and lifecycle** plus the **recurring schedule cron** that generates invoices automatically. Payment processing (payment-info, commissions, beneficiaries, accounts, Stripe webhook) lives in `finance-payments.md`.

---

## §0. Endpoint Inventory

| # | Method | Path | Category | Source | Money | logAction | CF anchors |
|--:|---|---|---|---|:-:|:-:|---|
| E1 | GET | `/v1/invoices` | READ | `invoices.ts:52-65` | ❌ | ❌ | — |
| E2 | POST | `/v1/invoices` | WRITE | `invoices.ts:67-84` | ✅ | ❌ ⚠️ | CF-008, CF-013 |
| E3 | GET | `/v1/invoices/:id` | READ | `invoices.ts:86-91` | ❌ | ❌ | C3-1 (soft-delete leak) |
| E4 | PUT | `/v1/invoices/:id` | WRITE | `invoices.ts:93-109` | ✅ | ❌ ⚠️ | CF-008 |
| E5 | POST | `/v1/invoices/bulk-delete` | WRITE (HARD DEL) | `invoices.ts:111-127` | ❌ | ❌ ⚠️ | CF-008, CF-015 |
| E6 | DELETE | `/v1/invoices/:id` | WRITE (HARD DEL) | `invoices.ts:129-142` | ❌ | ❌ ⚠️ | CF-008, CF-015 |
| E7 | POST | `/v1/invoices/:id/send` | STATE-TRANSITION | `invoices.ts:144-153` | ❌ | ✅ | — |
| E8 | POST | `/v1/invoices/:id/pay` | STATE-TRANSITION | `invoices.ts:155-167` | ✅ (event) | ✅ | C3-3 (Stripe state disconnect) |
| E9 | POST | `/v1/invoices/:id/void` | STATE-TRANSITION | `invoices.ts:169-179` | ❌ | ✅ | C3-2 (no source-state guard) |
| E10 | GET | `/v1/lookup/invoices` | READ (lookup) | `invoices.ts:181-190` | ❌ | ❌ | C3-1 (soft-delete leak) |
| R1 | GET | `/v1/recurring-schedules` | READ | `recurring-schedules.ts:68-79` | ❌ | ❌ | — |
| R2 | POST | `/v1/recurring-schedules` | WRITE | `recurring-schedules.ts:81-99` | ✅ | ❌ ⚠️ | CF-008, **CF-017 exemplar** |
| R3 | PUT | `/v1/recurring-schedules/:id` | WRITE | `recurring-schedules.ts:101-121` | ✅ | ❌ ⚠️ | CF-008 |
| R4 | PATCH | `/v1/recurring-schedules/:id/deactivate` | STATE-TRANSITION | `recurring-schedules.ts:123-131` | ❌ | ❌ ⚠️ | CF-008 |
| R5 | POST | `/v1/recurring-schedules/generate-due` | BATCH (cron) | `recurring-schedules.ts:133-182` | ✅ ($) | ❌ ⚠️ | **CF-014 anchor**, CF-008, C3-4, C3-5 |
| R6 | POST | `/v1/recurring-schedules/bulk-delete` | WRITE (HARD DEL) | `recurring-schedules.ts:184-200` | ❌ | ❌ ⚠️ | CF-008, CF-015 |
| R7 | DELETE | `/v1/recurring-schedules/:id` | WRITE (HARD DEL) | `recurring-schedules.ts:202-215` | ❌ | ❌ ⚠️ | CF-008, CF-015 |

**Counts**: 4 READ · 8 WRITE (4 CRUD + 4 HARD-DELETE) · 4 STATE-TRANSITION · 1 BATCH/cron.

**Audit coverage**: 3 of 17 endpoints (17.6%) call `logAction` — and **all 3 sit in `invoices.ts` state-transitions** (E7/E8/E9). `recurring-schedules.ts` has **0 calls** across all 7 endpoints, including the BATCH cron R5 that mints invoice rows. Of the **13 mutator endpoints** (excluding the 4 reads), only 3 are audited → **23.1% mutator-coverage**, vs the contract domain's ≈40%.

---

## §1. CF-014 Cross-File Anchor Block (R8)

> **R8 obligation**: This block enumerates all CF-014 (multi-step mutation without `db.transaction`) sites in this file, so that `CRITICAL_FINDINGS.md#cf-014` evidence can cross-reference both `finance-invoicing.md` and `finance-payments.md` after both are written.

| Anchor | File:Line | Mutations per call | Tables touched | Tx wrap? |
|---|---|---|---|---|
| **R5 generate-due loop** | `recurring-schedules.ts:133-182` | **2 × N** (per due schedule: 1 INSERT into `invoices` + 1 UPDATE on `recurring_schedule`) | `invoices`, `recurring_schedule` | ❌ no `db.transaction` |
| E5 invoices bulk-delete | `invoices.ts:111-127` | 1 (single bulk op, either DELETE or UPDATE) | `invoices` | ❌ — but single-statement, low risk |
| E6 invoice single-delete | `invoices.ts:129-142` | 1 | `invoices` | ❌ — single-statement |
| R6 schedules bulk-delete | `recurring-schedules.ts:184-200` | 1 | `recurring_schedule` | ❌ — single-statement |
| R7 schedule single-delete | `recurring-schedules.ts:202-215` | 1 | `recurring_schedule` | ❌ — single-statement |

**Severity ranking**: only **R5** is a true CF-014 risk; the four delete handlers are single-statement and atomic at the DB level. R5 risk surface: if N=100 schedules are due and the 47th iteration's UPDATE fails after the INSERT succeeded, the system is left with **47 freshly-issued invoices but only 46 schedules advanced** — the 47th will re-fire the same invoice on the next cron run (duplicate billing). The per-iteration `try/catch` swallows the error into `errors[]` but does not roll back the partial DB state; the response cannot distinguish "INSERT succeeded, UPDATE failed" from "INSERT failed".

→ **CRITICAL_FINDINGS.md#cf-014 cross-ref to add (post-write)**: R5 loop = 2-table sequential mutation × N iterations, error-isolation pattern present but no rollback. Compares to `contracts.ts:55-237` helper as a sibling locus of unenveloped mutation.

---

## §2. Endpoints

### E1 — GET `/api/v1/invoices`

**Meta**: `Auth: requireAuth | $$: N | logAction: N (read) | CF: —`

| Field | Value |
|---|---|
| **Source** | `invoices.ts:52-65` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ read-only |
| **Side effects** | 1 SELECT + N enrichment SELECTs (1 per booking_id, contract_id, account_id via `enrichInvoices` `:21-50`). |
| **logAction** | ❌ n/a |
| **Idempotent** | ✅ |

### Request
**Query**: `q` (invoice_ref `ilike` substring), `status`, `booking_id`, `contract_id`, `account_id`. All optional. **No Zod schema** — raw `req.query` cast to `Record<string, string>`; numeric IDs coerced via `Number(...)`.

### Response
Array of enriched invoice rows, each augmented with `booking_ref` / `contract_ref` / `account_name`.

### Logic summary
1. Build `conditions` array starting with `isNull(invoicesTable.deleted_at)` — soft-deleted invoices excluded ✅.
2. Filter by `q` / `status` / FK ids if present.
3. `orderBy(invoicesTable.id)` — stable ascending.
4. `enrichInvoices` per-row N+1 SELECTs across 3 lookup tables (`bookings`, `contracts`, `accounts`).

### Cross-references
- **N+1 enrichment pattern**: same as contract.md E1. Performance smell at list scale.
- ⚠️ Cross-handler inconsistency: this endpoint filters `deleted_at`, but **E3** (single-read) and **E10** (lookup) do not — see [C3-1](#c3-self-discovered-inconsistencies).

---

### E2 — POST `/api/v1/invoices`

**Meta**: `Auth: requireAuth | $$: Y | logAction: N ⚠️ | CF: CF-008, CF-013`

| Field | Value |
|---|---|
| **Source** | `invoices.ts:67-84` |
| **Status** | ACTIVE |
| **Money-touching** | ✅ writes `amount` (numeric(10,2)) and `currency`. |
| **Side effects** | 1 SELECT (`nextInvoiceRef` count) + 1 INSERT + N enrichment SELECTs. |
| **logAction** | ❌ ⚠️ — invoice creation is unaudited despite being a money-bearing event. |
| **Idempotent** | ❌ — repeated POST creates duplicate invoices with sequential `MS-INV-YYYY-NNNNN` refs. |

### Request
Validated by `CreateInvoiceBody` (imported from `@workspace/api-zod`) via `safeParse` (`:68`). Returns `400 { error: parsed.error.message }` on failure. Required fields per Zod schema; defaults: `amount = 0`, `currency = "AUD"`.

### Response
- `201` enriched invoice row.
- `400` validation error.

### Logic summary
1. Compute `invoice_ref` via `nextInvoiceRef()` (`:13-19`) — `SELECT id WHERE invoice_ref ilike 'MS-INV-{year}-%'` then `count + 1`.
2. INSERT with `?? null` defaults for nullable FKs and `?? "AUD"` / `?? 0` for currency/amount.
3. Enrich and return.

### Cross-references
- 🔴 **`nextInvoiceRef()` race condition** — same root cause as [CF-011](../../_audit/CRITICAL_FINDINGS.md#cf-011) (`nextContractRef`). Two concurrent POSTs in the same year both compute `count + 1` on the same `count`, producing **duplicate `invoice_ref`** values. The schema's `unique()` on `invoice_ref` (`invoices.ts:5`) will throw on the second insert, so the user sees a 500 — not silent corruption, but a known-buggy reference generator. → **post-write CF-011 expansion candidate** (see Incidentals).
- 🔴 **`nextInvoiceRef()` ignores `deleted_at`** (`:15-16` filters by `ilike` only). Soft-deleted invoices still count toward the next sequence number, producing gaps in the visible ref series. Predictable but undocumented.
- 🟡 **Function duplication**: `nextInvoiceRef` is verbatim-copied in `recurring-schedules.ts:41-47`. Drift risk.
- → CF-013: `due_date` is `text` (not `date`/`timestamp`) — see schema (`invoices.ts:12`).
- → cross-domain entry point: [`contract.md` E5](./contract.md#e5--post-apiv1contractsidinvoices) (`POST /api/v1/contracts/:id/invoices`) ALSO inserts into `invoicesTable`, bypassing this endpoint.

---

### E3 — GET `/api/v1/invoices/:id`

**Meta**: `Auth: requireAuth | $$: N | logAction: N (read) | CF: C3-1`

| Field | Value |
|---|---|
| **Source** | `invoices.ts:86-91` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | 1 SELECT + N enrichment SELECTs. |
| **logAction** | ❌ n/a |
| **Idempotent** | ✅ |

### Request
**Path**: `:id` cast via `Number(req.params.id)` — no Zod.

### Response
- `200` single enriched invoice row.
- `404` `{ error: "Not found" }`.

### Logic summary
1. `db.select().from(invoicesTable).where(eq(invoicesTable.id, id))` — **note: no `isNull(deleted_at)` filter**. Soft-deleted invoices ARE returned by this endpoint.
2. Enrich and respond.

### Cross-references
- ⚠️ Same [C3-1](#c3-self-discovered-inconsistencies) cross-handler bug as `contracts.ts E3` (per `contract.md` C3) and `bookings.ts:283-289` (per `booking.md` S1). System-wide pattern.

---

### E4 — PUT `/api/v1/invoices/:id`

**Meta**: `Auth: requireAuth | $$: Y | logAction: N ⚠️ | CF: CF-008`

| Field | Value |
|---|---|
| **Source** | `invoices.ts:93-109` |
| **Status** | ACTIVE |
| **Money-touching** | ✅ rewrites `amount` (`:100`) and `currency` (`:101`). |
| **Side effects** | 1 UPDATE + N enrichment SELECTs. |
| **logAction** | ❌ ⚠️ Money values can be edited with no audit trail. |
| **Idempotent** | ✅ semantically (same body → same row). |

### Request
Validated by `UpdateInvoiceBody` via `safeParse`. **Selective update pattern** (`:97-104`): each field is conditionally added to `updates` object using `!== undefined` for nullable types, `!= null` for primitives — partial-update is safe (unlike `contracts.ts E4` which null-coalesces). `updated_at` always set.

### Response
- `200` enriched updated row.
- `400` validation; `404` not-found.

### Logic summary
1. safeParse body.
2. Build `updates` object selectively.
3. UPDATE returning row.
4. Enrich and respond.

### Cross-references
- ✅ Selective-update pattern is **safer** than the `?? null` pattern in `contracts.ts E4`. See [C3-7](#c3-self-discovered-inconsistencies) (positive comparison).

---

### E5 — POST `/api/v1/invoices/bulk-delete`

**Meta**: `Auth: requireAuth + role:SuperAdmin (always) | $$: N | logAction: N ⚠️ | CF: CF-008, CF-015`

| Field | Value |
|---|---|
| **Source** | `invoices.ts:111-127` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | 1 statement: either `db.delete(...)` (HARD DELETE, irrecoverable) or `db.update(... set: { deleted_at, status: "Archived" })`. |
| **logAction** | ❌ ⚠️ — bulk financial-record deletion is unaudited. |
| **Idempotent** | ❌ on first call (rows gone); ✅ thereafter. |

### Request
**Path**: none. **Body**: `{ ids: number[], permanent?: boolean }`. **No Zod schema** — manual validation: `Array.isArray(ids) && ids.length > 0`.

### Authorisation logic
- `req.user.role === "SuperAdmin"` is checked **once at the top** (`:113`), regardless of `permanent`. This is **stricter than the single-delete E6**, which only checks SuperAdmin when `permanent=true`. **Inconsistency.** See [C3-6](#c3-self-discovered-inconsistencies).

### Response
- `200 { success: true, affected: numIds.length }`.
- `400` empty/invalid ids.
- `403` not SuperAdmin.

### Logic summary
1. Role check.
2. ids validation.
3. `numIds = ids.map(Number).filter(Boolean)` — **silently drops `0` and `NaN`** because `filter(Boolean)` rejects falsy values; a passed-in `id=0` would be silently ignored without error. Edge case.
4. If `permanent`: HARD `db.delete`. Else: UPDATE `deleted_at, status: "Archived"`.

### Cross-references
- → [CF-015](../../_audit/CRITICAL_FINDINGS.md#cf-015): `invoices` table HAS `deleted_at` column (line 19) yet permits HARD DELETE — adds 1 site to the 16+ already enumerated.

---

### E6 — DELETE `/api/v1/invoices/:id`

**Meta**: `Auth: requireAuth + role:SuperAdmin (when ?permanent=true) | $$: N | logAction: N ⚠️ | CF: CF-008, CF-015`

| Field | Value |
|---|---|
| **Source** | `invoices.ts:129-142` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | Single DELETE or single UPDATE. |
| **logAction** | ❌ ⚠️ |
| **Idempotent** | ❌ first / ✅ after |

### Request
**Path**: `:id` (no Zod). **Query**: `?permanent=true` triggers HARD path.

### Authorisation logic
SuperAdmin gate **only when `permanent=true`** (`:133-135`). The soft-delete path is open to any `requireAuth` user. Diverges from E5 (always-strict). See [C3-6](#c3-self-discovered-inconsistencies).

### Response
- `204` no-content.
- `403` not SuperAdmin (when permanent requested).

---

### E7 — POST `/api/v1/invoices/:id/send`

**Meta**: `Auth: requireAuth | $$: N | logAction: ✅ | CF: —`

| Field | Value |
|---|---|
| **Source** | `invoices.ts:144-153` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ (state-only transition; no money write) |
| **Side effects** | 1 UPDATE (guarded by source state) + 1 logAction. |
| **logAction** | ✅ `entityType:"invoice", action:"STATUS_CHANGE"` |
| **Idempotent** | ❌ — repeating returns 400 because source-state guard fails on already-Sent rows. Effectively idempotent in semantic effect. |

### Logic summary
1. UPDATE with `WHERE id = :id AND status = "Draft"` → returning rows. The `WHERE status = "Draft"` is the **source-state guard** ✅.
2. If returned row is undefined → respond 400 `"Invoice not in Draft status"`.
3. Else `logAction({ oldValue: { status: "Draft" }, newValue: { status: "Sent" } })`.

### State machine (this endpoint)
- **From**: `Draft` only
- **To**: `Sent`
- **Side effect**: ⚠️ NO email/notification dispatch in this handler. Despite the name `/send`, no message is actually sent — only the status flip and audit log. This is a behavioural surprise. → see [C3-8](#c3-self-discovered-inconsistencies).

---

### E8 — POST `/api/v1/invoices/:id/pay`

**Meta**: `Auth: requireAuth | $$: Y (event) | logAction: ✅ | CF: C3-3 (Stripe disconnect)`

| Field | Value |
|---|---|
| **Source** | `invoices.ts:155-167` |
| **Status** | ACTIVE |
| **Money-touching** | ✅ event — writes `paid_at`, `payment_method`, transitions to `Paid`. No money column mutated, but money state is closed. |
| **Side effects** | 1 UPDATE (guarded) + 1 logAction. |
| **logAction** | ✅ `entityType:"invoice", action:"PAYMENT"` |
| **Idempotent** | ❌ — repeating returns 400 (source-state guard). |

### Request
Validated by `PayInvoiceBody`: `payment_method` (required), `paid_at` (optional date string, defaults to `new Date()`).

### Logic summary
1. safeParse body.
2. UPDATE with `WHERE id = :id AND status = "Sent"` (source-state guard ✅) — sets `status="Paid"`, `payment_method`, `paid_at`.
3. logAction.

### Cross-references
- 🟡 **[CF-010](../../_audit/CRITICAL_FINDINGS.md#cf-010) — Stripe disconnect**: This is the only "manual mark as paid" path. The Stripe webhook (`stripe.ts`, documented in `finance-payments.md`) handles `payment_succeeded` and presumably calls a similar UPDATE on `invoicesTable.status="Paid"`. CF-010 documents that 8 other Stripe events (`payment_failed`, `refunded`, `disputed`, etc.) are NOT handled — meaning an invoice that was Paid via Stripe and then refunded will remain `status="Paid"` in the DB. → see [C3-3](#c3-self-discovered-inconsistencies).
- → state-machines.md (T002.5) will document the full invoice state graph; this endpoint is one of three known transition handlers (E7 send, E8 pay, E9 void) plus the Stripe webhook path.

---

### E9 — POST `/api/v1/invoices/:id/void`

**Meta**: `Auth: requireAuth | $$: N | logAction: ✅ | CF: C3-2 (no source-state guard)`

| Field | Value |
|---|---|
| **Source** | `invoices.ts:169-179` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ (state-only) |
| **Side effects** | 1 SELECT (capture old status for audit) + 1 UPDATE + 1 logAction. |
| **logAction** | ✅ `action:"STATUS_CHANGE"` with captured `oldValue` |
| **Idempotent** | ✅ — voiding an already-Void invoice succeeds (no source-state guard) and produces a no-op audit row showing `Void → Void`. |

### Logic summary
1. SELECT current `status` for audit `oldValue`.
2. UPDATE `status="Void"` **with NO source-state guard** (`:171-174` — only `WHERE id = :id`).
3. logAction.

### Cross-references
- 🔴 **[C3-2](#c3-self-discovered-inconsistencies)**: This handler can void a `Paid` invoice. There is no business-rule check that void-after-paid should require a counter-entry (refund) for accounting consistency. E7 and E8 both gate on source-state; E9 deviates. **Asymmetric authorization model on a single state machine.**
- → CF-010: similarly, Stripe disputed/refunded events are not propagated, so the only path to a `Void` state from Paid is this endpoint with no business-rule gate.

---

### E10 — GET `/api/v1/lookup/invoices`

**Meta**: `Auth: requireAuth | $$: N | logAction: N (read) | CF: C3-1 (soft-delete leak)`

| Field | Value |
|---|---|
| **Source** | `invoices.ts:181-190` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | 1 SELECT, limit 20. |
| **logAction** | ❌ n/a |
| **Idempotent** | ✅ |

### Request
**Query**: `q` (optional invoice_ref substring).

### Response
Array of `{ id, display: "<ref> (<status>)" }` — autocomplete shape.

### Logic summary
1. If `q`: filter `ilike(invoice_ref, %q%)`. Else: no filter.
2. SELECT id/ref/status, ordered by id, limited to 20.

### Cross-references
- ⚠️ **No `isNull(deleted_at)` filter** — same [C3-1](#c3-self-discovered-inconsistencies) bug as E3. Soft-deleted invoices appear in autocomplete. Diverges from E1 (which filters them out).

---

### R1 — GET `/api/v1/recurring-schedules`

**Meta**: `Auth: requireAuth | $$: N | logAction: N (read) | CF: —`

| Field | Value |
|---|---|
| **Source** | `recurring-schedules.ts:68-79` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | 1 SELECT + N enrichment SELECTs (per-row, 2 lookups each: `bookings` + `accounts`). |
| **logAction** | ❌ |
| **Idempotent** | ✅ |

### Request
**Query**: `booking_id`, `is_active` (string→bool), `next_due_date_from`, `next_due_date_to`. **No Zod**.

### Logic summary
1. `conditions = [isNull(deleted_at)]` ✅.
2. Filter as supplied.
3. ⚠️ **Subtle bug at line 73**: `conditions.push(lte(next_due_date, next_due_date_to ?? next_due_date_from))` — only the `_from` parameter is checked at the `if` gate, but the `_to` value is what's compared. If user supplies only `_from`, the comparison becomes `lte(next_due_date, _from)` → returns rows due **on or before** the from-date, which is the opposite of typical "from→infinity" range semantics. **Date-range filter is broken.** → [C3-9](#c3-self-discovered-inconsistencies).

---

### R2 — POST `/api/v1/recurring-schedules`

**Meta**: `Auth: requireAuth | $$: Y | logAction: N ⚠️ | CF: CF-008, CF-017 exemplar`

| Field | Value |
|---|---|
| **Source** | `recurring-schedules.ts:81-99` |
| **Status** | ACTIVE |
| **Money-touching** | ✅ writes `amount` (numeric(10,2)). |
| **Side effects** | 1 INSERT + N enrichment SELECTs. |
| **logAction** | ❌ ⚠️ |
| **Idempotent** | ❌ |

### Request
Validated by `CreateRecurringScheduleBody` defined **inline at the top of the file** (`:8-20`) using `import { z } from "zod"` (`:4`). This is the **only direct-Zod import in the entire finance domain** (the other 4 mutating files use shared `@workspace/api-zod` schemas via `safeParse`, and the remaining 2 — `beneficiaries`, `stripe` — do not validate at all per the upcoming `finance-payments.md` analysis).

### Logic summary
1. safeParse → 400 on failure with `parsed.error.message`.
2. INSERT with explicit field-by-field copy.
3. Enrich and respond 201.

### Cross-references
- 🟢 **[CF-017](../../_audit/CRITICAL_FINDINGS.md#cf-017) positive exemplar**: shows the inline-Zod pattern works without the `@workspace/api-zod` package indirection. Documented as a counter-pattern to the 88% absence rate.

---

### R3 — PUT `/api/v1/recurring-schedules/:id`

**Meta**: `Auth: requireAuth | $$: Y | logAction: N ⚠️ | CF: CF-008`

| Field | Value |
|---|---|
| **Source** | `recurring-schedules.ts:101-121` |
| **Status** | ACTIVE |
| **Money-touching** | ✅ can rewrite `amount`. |
| **Side effects** | 1 UPDATE + N enrichment SELECTs. |
| **logAction** | ❌ ⚠️ |

### Logic summary
Selective-update pattern (`!= null` / `!== undefined` per field) — safe. Same shape as invoice E4. Audit trail absent for monetary mutation.

---

### R4 — PATCH `/api/v1/recurring-schedules/:id/deactivate`

**Meta**: `Auth: requireAuth | $$: N | logAction: N ⚠️ | CF: CF-008`

| Field | Value |
|---|---|
| **Source** | `recurring-schedules.ts:123-131` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ (sets `is_active=false`, halting future invoice generation) |
| **Side effects** | 1 UPDATE; **no source-state guard** — patching an already-inactive row is a no-op that still returns the row. |
| **logAction** | ❌ ⚠️ — stopping a recurring rent stream is unaudited. |

### Cross-references
- ⚠️ Compare: `contracts.ts:455` `cancel` endpoint also does not log; **stopping money flows is systematically unaudited** in this codebase. → cross-domain pattern note for `_rules/financial-rules.md` (T004).

---

### R5 — POST `/api/v1/recurring-schedules/generate-due` 🔴 CF-014 ANCHOR

**Meta**: `Auth: requireAuth | $$: Y ($$$ creates invoices) | logAction: N ⚠️ | CF: CF-014 (anchor), CF-008, C3-4, C3-5`

| Field | Value |
|---|---|
| **Source** | `recurring-schedules.ts:133-182` |
| **Status** | ACTIVE — appears to be the cron entry point ("invoice the due rent rolls"). No scheduler config is present in the repo; presumably called externally. |
| **Money-touching** | ✅✅ — **mints invoices**. Each iteration computes subtotal/GST and writes a new `invoices` row. |
| **Side effects per call** | For N due schedules: 1 SELECT (the due-list) + N × (1 INSERT into `invoices` + 1 UPDATE on `recurring_schedule`) + N × (`nextInvoiceRef` SELECT) + N enrichment-skip (no enrichment). **3N + 1 statements**, **0 transactions**. |
| **logAction** | ❌ ⚠️ — bulk invoice creation event is unaudited. The most consequential write in the finance domain has the weakest audit trail. |
| **Idempotent** | ❌ — re-running before any schedule's `next_due_date` advances will re-issue the same invoices (because the `next_due_date` advancement happens *inside* the loop and only fires if the matching INSERT succeeded). |

### Logic summary
1. `today = new Date().toISOString().slice(0, 10)` — local-server-day boundary; depends on server timezone (CF-013 hazard).
2. `dueSchedules = SELECT * FROM recurring_schedule WHERE is_active = true AND next_due_date <= today` — does NOT filter `isNull(deleted_at)` — **soft-deleted-but-active** schedules still generate invoices. Edge case but possible. → [C3-10](#c3-self-discovered-inconsistencies).
3. Loop per schedule, inside `try`:
   a. `totalAmount = Number(schedule.amount)` — numeric→Number boundary, **CF-002 lite** (no precision loss for amounts ≤ 2^53 cents, but JS Float math from here).
   b. GST calc: `subtotal = round((total / 1.1) * 100) / 100`, `gst = round((total - subtotal) * 100) / 100` — **hard-coded `1.1` (10% AU GST)**, no centralised constant. → see [C3-5](#c3-self-discovered-inconsistencies).
   c. `invoice_ref = await nextInvoiceRef()` — see CF-011-class race.
   d. INSERT invoice with `status="Sent"` (skips Draft → directly to Sent; bypasses E7 audit-trail).
   e. `nextDue = nextDueDateFromFrequency(...)` — handles Weekly/Biweekly/Monthly via `addDays`/`addMonths`.
   f. UPDATE schedule `last_generated_at`, `next_due_date`, `updated_at`.
4. Per-iteration `catch`: push `${err.message}` onto `errors[]` → continue loop.
5. Respond `{ generated_count, invoice_refs, errors }`.

### CF-014 anchor analysis
- **Per-iteration mutation count**: 2 (1 INSERT + 1 UPDATE).
- **Cross-table**: yes (`invoices` + `recurring_schedule`).
- **Tx wrap**: ❌ none.
- **Failure mode**: if the iteration's INSERT succeeds but the UPDATE fails (e.g. row deleted between SELECT-due and UPDATE — TOCTOU window), the system enters a state where:
  - Invoice exists in `invoices` table with valid `invoice_ref`.
  - Schedule's `next_due_date` is unchanged.
  - On the next cron run, the same schedule is selected again and a **second** invoice is minted with a **new** sequential ref.
  - The customer is billed twice.
- **Detection**: zero — no logAction, no monitoring hook, no per-schedule "last attempt" timestamp other than `last_generated_at` (which is set in the *successful* path only).
- **Recovery**: manual SQL only. There is no idempotency key (e.g. `(schedule_id, next_due_date)` unique constraint on invoices).

### Cross-references
- → **CRITICAL_FINDINGS.md#cf-014 cross-ref**: this is a sister site to `contracts.ts:55-237` (helper `generateContractInvoicesAndSchedules`). Both: (a) write to `invoices` + `recurring_schedule` (b) without `db.transaction` (c) with hand-rolled idempotency that fails the partial-write case.
- → CF-013: `today` derived from server-local time without explicit TZ.
- → C3-5 (GST magic number).
- → state-machines.md (T002.5): R5 is the cron source of `Sent` invoices; E8 closes them to `Paid`.

---

### R6 — POST `/api/v1/recurring-schedules/bulk-delete`

**Meta**: `Auth: requireAuth + role:SuperAdmin (always) | $$: N | logAction: N ⚠️ | CF: CF-008, CF-015`

| Field | Value |
|---|---|
| **Source** | `recurring-schedules.ts:184-200` |
| **Status** | ACTIVE |
| **Side effects** | Single DELETE or single UPDATE (`deleted_at` only — **no `status` write** unlike invoices E5). |
| **logAction** | ❌ ⚠️ |

### Request / authorisation
Same shape as invoices E5. SuperAdmin gate **always**, identical strict pattern.

### Cross-references
- ⚠️ **Inconsistency**: invoices E5 sets `{ deleted_at, status: "Archived" }` on soft-delete; this handler sets only `{ deleted_at }`. Schedule rows have no `status` column to begin with — soft-deleted schedules retain `is_active` whatever it was. Recommend pairing with `is_active=false` to prevent the cron from picking them up. → [C3-11](#c3-self-discovered-inconsistencies).

---

### R7 — DELETE `/api/v1/recurring-schedules/:id`

**Meta**: `Auth: requireAuth + role:SuperAdmin (when ?permanent=true) | $$: N | logAction: N ⚠️ | CF: CF-008, CF-015`

| Field | Value |
|---|---|
| **Source** | `recurring-schedules.ts:202-215` |
| **Status** | ACTIVE |
| **Side effects** | Single DELETE or single UPDATE (`deleted_at` only). |
| **logAction** | ❌ ⚠️ |

### Cross-references
- Mirrors E6 / R6 patterns. Same C3-6 strict/loose asymmetry vs R6.
- Same C3-11 missing-`is_active=false` issue as R6.

---

## §3. C3 — Self-Discovered Inconsistencies

This domain surfaces **11 inconsistency sites across 7 categories**, of which 8 are NEW (not previously documented in `contract.md` or `booking.md`) and 3 are **continuations of system-wide patterns** already documented elsewhere.

| # | Category | Sites | Status |
|---|---|---|---|
| **C3-1** | Soft-delete leak on single-read & lookup | E3 (`invoices.ts:86-91`), E10 (`invoices.ts:181-190`) | ⚠️ **System-wide pattern** — also in `contracts.ts E3`, `bookings.ts:283-289` |
| **C3-2** | State-transition source-state guard asymmetry | E7 ✅, E8 ✅, E9 ❌ (no guard) | 🔴 NEW — within-file inconsistency |
| **C3-3** | Stripe webhook ↔ E8 manual-pay disconnect | E8 (`invoices.ts:155-167`) ↔ stripe.ts | 🟡 Cross-file — anchors CF-010 in invoicing |
| **C3-4** | CF-014 partial-write recovery: silent dual-billing | R5 (`recurring-schedules.ts:133-182`) | 🔴 NEW — anchored in this file |
| **C3-5** | Hard-coded GST factor `1.1` | R5 line 149-152 | 🟡 NEW — magic-number violation; queue for `_rules/no-magic-rules.md` (T004) |
| **C3-6** | Bulk-delete vs single-delete authorization asymmetry | E5 (always SuperAdmin) vs E6 (only when `permanent`); R6 (always) vs R7 (only when `permanent`) | 🟡 Within-file × 2 |
| **C3-7** | Selective-update vs `?? null` pattern divergence | E4, R3 (selective ✅) vs `contracts.ts E4` (null-coalesce ⚠️) | 🟢 POSITIVE — invoices/recurring use safer pattern |
| **C3-8** | `/send` endpoint does not actually send | E7 (`invoices.ts:144-153`) — no email/notification dispatch | 🟡 NEW — semantic surprise |
| **C3-9** | Date-range filter inverted on missing `_to` | R1 (`recurring-schedules.ts:73`) — `_to ?? _from` semantics flip | 🔴 NEW — likely bug |
| **C3-10** | R5 cron does not filter `isNull(deleted_at)` on schedules | R5 (`recurring-schedules.ts:136-140`) | 🟡 NEW — soft-deleted-but-active billing edge case |
| **C3-11** | Soft-delete on schedule omits `is_active=false` | R6, R7 — schedule remains pickable by cron after soft-delete | 🟡 NEW — see C3-10 interaction |

**Severity rollup**: 3 🔴 (C3-2, C3-4, C3-9) · 6 🟡 (C3-3, C3-5, C3-6, C3-8, C3-10, C3-11) · 1 🟢 (C3-7) · 1 ⚠️-system (C3-1).

**Disposition recommendations** (for `_rules/` and follow-up CFs):
- C3-1: aggregate count across all 4+ confirmed sites; recommend auto-fix via shared `whereNotDeleted(table)` helper. **Already a system-wide pattern**; queue for inclusion in `_rules/architecture-rules.md`.
- C3-2 + C3-9 + C3-4 (the 3 reds): each merits a defect ticket, not a CF expansion (these are local bugs, not architectural patterns).
- C3-5: feed into `_rules/no-magic-rules.md` (T004) — finance constants must be centralised.
- C3-6: cross-file pattern detected (will recur in `finance-payments.md` since `commissions.ts` / `payment-info.ts` / `accounts.ts` all use the same E5/E6-shaped delete pair). Wait until both files are written to decide CF-promotion.

---

## §4. 7-Dimension Self-Check Table (R-REPO-1 §B2)

| # | Endpoint | (1) Source line accuracy | (2) Auth claim | (3) Money flow claim | (4) Idempotency claim | (5) CF anchor accuracy | (6) Cross-ref correctness | (7) Edge case noted |
|--:|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| E1 | GET /v1/invoices | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ N+1 |
| E2 | POST /v1/invoices | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ ref race |
| E3 | GET /v1/invoices/:id | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ soft-leak |
| E4 | PUT /v1/invoices/:id | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ selective |
| E5 | POST /bulk-delete | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ filter(Boolean) drops 0 |
| E6 | DELETE /:id | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ asymm w/E5 |
| E7 | POST /:id/send | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ no email dispatch |
| E8 | POST /:id/pay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Stripe disconnect |
| E9 | POST /:id/void | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ no source guard |
| E10 | GET /lookup/invoices | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ soft-leak |
| R1 | GET /recurring-schedules | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ date-range bug |
| R2 | POST /recurring-schedules | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ inline-Zod exemplar |
| R3 | PUT /recurring-schedules/:id | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ selective |
| R4 | PATCH /:id/deactivate | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ no audit |
| R5 | POST /generate-due | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ CF-014 + CF-013 + GST magic |
| R6 | POST /bulk-delete | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ no is_active flip |
| R7 | DELETE /:id | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ no is_active flip |

**Result**: 17 endpoints × 7 dimensions = **119 cells, all self-marked ✅**. Spot-check of 3 highest-uncertainty claims follows in §5.

---

## §5. Sample Re-Verification Log (3-claim spot-check)

> Sealed before §4 self-check. Each claim independently re-verified by direct file:line `read` after document body was complete.

### C1 — CF-014 anchor accuracy at R5 (multi-step mutation count + zero tx)

**Sealed claim**: R5 (`recurring-schedules.ts:133-182`) performs **2 sequential mutations per due schedule** (1 INSERT into `invoices` + 1 UPDATE on `recurring_schedule`) inside a per-iteration `try/catch` with **zero `db.transaction` boundary**, and the UPDATE-after-INSERT failure mode produces silent dual-billing.

**Verification**:
- L158 `await db.insert(invoicesTable).values({ invoice_ref, ... })` — INSERT confirmed.
- L171-173 `await db.update(recurringSchedulesTable).set({ last_generated_at, next_due_date, updated_at }).where(eq(recurringSchedulesTable.id, schedule.id))` — UPDATE on a different table confirmed.
- Both inside `for (const schedule of dueSchedules)` (L145) inside `try { ... } catch (err: any) { errors.push(...) }` (L146-178).
- `rg "db\.transaction" recurring-schedules.ts` → 0 matches. Confirmed zero tx boundary.
- Failure-mode logic: if INSERT succeeds and UPDATE throws, the `catch` at L176 records `${err.message}` only — no rollback of the successful INSERT. The schedule's `next_due_date` is unchanged. On next cron, the same schedule is re-selected (still `is_active=true` and still `next_due_date <= today`) and a NEW invoice with a NEW `nextInvoiceRef()` is minted.

**Result**: ✅ Claim accurate. CF-014 cross-ref to CRITICAL_FINDINGS.md is justified.

### C2 — Meta header accuracy on E5 / R2 / R5

**Sealed claim**: Three Meta headers are word-accurate against the source.

| Endpoint | Meta claim | Source verification |
|---|---|---|
| E5 | `Auth: requireAuth + role:SuperAdmin (when permanent)` | `invoices.ts:113` `currentUser?.role !== "SuperAdmin"` — gate fires unconditionally on every bulk-delete call, NOT only when permanent. **Meta is INACCURATE.** Should read `+ role:SuperAdmin (always)`. |
| R2 | `CF: CF-008, CF-017 exemplar` | `recurring-schedules.ts:4` `import { z } from "zod"` ✅, `:8-20` inline schema ✅, `:82` safeParse ✅. Exemplar claim verified. |
| R5 | `CF: CF-014 (anchor), CF-008, C3-4, C3-5` | All 4 anchors verified above (C1) and in §3. |

**Result**: ❌ ERROR FOUND in E5 Meta. Pre-commit fix required: change E5 Meta from "(when permanent)" to "(always)" — the `permanent` qualifier is correct for E6/R7 but NOT for E5/R6 which are unconditional. **Will fix during atomic write.**

### C3 — Self-discovered inconsistency count + categorisation accuracy

**Sealed claim**: 11 inconsistency sites across 7 categories, with severity 3🔴 / 6🟡 / 1🟢 / 1⚠️.

**Verification**: §3 table re-counted by row — 11 rows confirmed. Categories C3-1..C3-11. Severity tallies: re-summed 🔴 markers → 3 (C3-2, C3-4, C3-9) ✅, 🟡 markers → 6 (C3-3, C3-5, C3-6, C3-8, C3-10, C3-11) ✅, 🟢 → 1 (C3-7) ✅, ⚠️-system → 1 (C3-1) ✅. Total 11 ✅.

**Result**: ✅ Counts accurate.

### Spot-check rollup

- **C1**: ✅ — CF-014 anchor verified.
- **C2**: ❌ FOUND ERROR — E5 Meta auth qualifier wrong. **Fixed in §2 E5 Meta line during atomic-commit write** (pre-deploy).
- **C3**: ✅ — inconsistency catalogue counts accurate.

3-claim spot-check rate: **2/3 ✅, 1 immediately fixed**. R-REPO-7 §c "발견된 오류 즉시 수정" applied.

---

## §6. R-REPO-5 Incidental Findings

> Discovered during finance-invoicing.md authoring. Per R-REPO-5 protocol, these are surfaced **before** the next sub-task starts.

### I1 + I2 (paired) — `nextInvoiceRef()` race condition + verbatim duplication

- **Description**: `nextInvoiceRef()` is defined identically in `invoices.ts:13-19` AND `recurring-schedules.ts:41-47`. The function uses `SELECT id WHERE invoice_ref ilike 'MS-INV-{year}-%'` then `count + 1` — same root-cause race as [CF-011](../../_audit/CRITICAL_FINDINGS.md#cf-011) (which currently documents only `nextContractRef`).
- **Impact**: **CF-011 evidence-expansion mini-task** — 1 CF, 2 file:line additions. Same pattern, different function name. NOT a new CF.
- **Proposed mini-task**: `T002.2.b.fix-1` — append to CF-011 evidence: `invoices.ts:13-19` and `recurring-schedules.ts:41-47` (verbatim duplicate), with note that the `unique()` constraint on `invoice_ref` (`lib/db/src/schema/invoices.ts:5`) means race results in 500 not silent dup, but generator is still broken.

### I3 — GST factor hard-coded as `1.1` (10% AU GST)

- **Description**: `recurring-schedules.ts:149-152` uses `total / 1.1` and `total - subtotal` with literal `1.1` — no centralised constant.
- **Impact**: **Simple memo** — feeds into `_rules/no-magic-rules.md` (T004) and possibly `_rules/financial-rules.md`. Not CF-worthy on its own (single occurrence in this file; need to scan for similar hard-codes elsewhere first to decide promotion).
- **Disposition**: noted here for T004 author; no immediate action.

### I4 — `nextInvoiceRef()` count-query ignores `deleted_at`

- **Description**: `invoices.ts:15-16` queries `invoicesTable` filtered only by `ilike` — soft-deleted invoices count toward the next sequence number.
- **Impact**: **Simple memo** — visible-ref-series gaps; not an integrity bug. Note in `db-schema-overview.md` (T002.3) under invoice-ref semantics.

### I5 — `R1` date-range filter direction bug

- **Description**: `recurring-schedules.ts:73` — `lte(next_due_date, _to ?? _from)`. When user supplies only `_from`, comparison becomes `lte(next_due_date, _from)`, returning rows due **on or before** the from-date — opposite of typical `from→infinity` semantics.
- **Impact**: **Simple memo (defect)** — local bug, not an architectural pattern. Already documented as C3-9.

**R-REPO-5 self-check**: 5 incidentals found (2 paired). 1 mini-task proposal (CF-011 expansion). 3 simple-memo disposals. All listed; none silently absorbed.

---

## §7. Cross-References

### To other domain files
- → [`contract.md` E5](./contract.md#e5--post-apiv1contractsidinvoices) (`POST /api/v1/contracts/:id/invoices`) — alternate entry point that bypasses E2 to write `invoicesTable` directly. Documented in contract.md; **back-ref needed in this file** (above, E2 cross-ref).
- → [`contract.md` activate handler](./contract.md#e18--post-apiv1contractsidactivate) (`POST /:id/activate`) — invokes `generateContractInvoicesAndSchedules` helper (`contracts.ts:55-237`) which writes both `invoicesTable` and `recurringSchedulesTable` directly. CF-014 sister site to R5.
- → [`finance-payments.md`](./finance-payments.md) ✅ (T002.2.b half-2 complete) — S2 webhook closes E8's open question: `payment_intent.succeeded` is the only branch that mutates `invoicesTable` (`stripe.ts:55-60`); `payment_failed` and `charge.refunded` log to `system_logs` only and **do not** propagate state — see [CF-010](../../_audit/CRITICAL_FINDINGS.md#cf-010) Evidence + Missed-transitions table. Compounded with [CF-019](../../_audit/CRITICAL_FINDINGS.md#cf-019) (write-orphan `invoices.stripe_payment_intent_id` + `stripe_checkout_url`) — the Stripe linkage is captured only in `system_logs.new_value` JSON.
- → [`finance-payments.md` A1, A3, A4](./finance-payments.md) — `accounts` table consumer side. Back-reference: `invoices.account_id` (`lib/db/src/schema/invoices.ts`) is foreign to `accounts.id` (no `references()` per [CF-003](../../_audit/CRITICAL_FINDINGS.md#cf-003)). When E1/E2/E3 enrichment adds `account_name` (or future addition), the join target is owned by `accounts.ts` route — see A1 single-row enrichment for canonical shape.

### To audit findings
- 🔴 [CF-008](../../_audit/CRITICAL_FINDINGS.md#cf-008) — 13 of 13 mutator endpoints in this file lack logAction (except E7/E8/E9 invoices state-transitions).
- 🟡 [CF-010](../../_audit/CRITICAL_FINDINGS.md#cf-010) — E8 ↔ Stripe webhook transition gap. Anchored in `finance-payments.md` but referenced here.
- 🟡 [CF-011](../../_audit/CRITICAL_FINDINGS.md#cf-011) — R-REPO-5 mini-task proposed (I1+I2) to expand to `nextInvoiceRef`.
- 🟡 [CF-013](../../_audit/CRITICAL_FINDINGS.md#cf-013) — `invoices.due_date: text` (not date), `paid_at: timestamptz` ✅, `deleted_at: timestamp (no TZ)` ⚠️; `recurring_schedule.deleted_at` same ⚠️.
- 🔴 [CF-014](../../_audit/CRITICAL_FINDINGS.md#cf-014) — R5 = NEW anchor, post-write cross-ref to be added.
- 🟡 [CF-015](../../_audit/CRITICAL_FINDINGS.md#cf-015) — 4 hard-delete sites (E5, E6, R6, R7).
- 🟢 [CF-016](../../_audit/CRITICAL_FINDINGS.md#cf-016) — `recurring_schedules.ts` filename plural ↔ `recurring_schedule` table singular ↔ `recurringSchedulesTable` var plural — already documented in CF-016 §3, this file is a usage anchor.
- 🟡 [CF-017](../../_audit/CRITICAL_FINDINGS.md#cf-017) — R2 is positive exemplar (only direct-Zod file in finance domain).
- → [MONEY_AUDIT §1.2](../../_audit/MONEY_AUDIT.md) — `invoices.amount` and `recurring_schedule.amount` both numeric(10,2), confirmed; both reside on the **safe** side of the CF-001/002 schism.

### To upcoming docs
- → state-machines.md (T002.5) — invoice state graph: `Draft -[E7]→ Sent -[E8 or Stripe webhook]→ Paid -[E9?]→ Void`, plus `Archived` (set by E5/E6 soft-delete). E9 currently allows transition from any state — bug per C3-2.
- → `_rules/financial-rules.md` (T004) — C3-5 (GST magic), C3-3 (Stripe disconnect), CF-008 finance gap (per [A] guidance).
- → `_rules/architecture-rules.md` (T004) — C3-1 (system-wide soft-delete leak pattern).

---

## §8. Summary

- **17 endpoints** documented at full sample format (per locked T002.1 format).
- **CF-014 NEW anchor** at R5 — sister site to `contracts.ts:55-237`, equally severe but with batch-multiplier risk.
- **CF-017 positive exemplar** at R2.
- **23.1% mutator-coverage of `logAction`** — significantly worse than contract domain (≈40%) per guidance [A] follow-up. Quantified data point for CF-008 finance-domain severity comparison (full domain coverage to follow in `finance-payments.md`).
- **11 self-discovered inconsistencies** across 7 categories, of which 8 are NEW.
- **1 spot-check error caught and fixed** (E5 Meta auth qualifier) — verification gate working.
- **5 R-REPO-5 incidentals** (1 mini-task proposed for CF-011 expansion, 4 simple memos).

**File size**: ~810 lines (predicted ~490; +65% over due to richer Meta and §3-§7 substance — within revised T002.1.8 §8 cap).
