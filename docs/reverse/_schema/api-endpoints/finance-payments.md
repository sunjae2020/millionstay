# Domain: finance-payments

> **Files of origin**: `artifacts/api-server/src/routes/payment-info.ts` (90 lines, 6 endpoints) · `artifacts/api-server/src/routes/commissions.ts` (90 lines, 6 endpoints) · `artifacts/api-server/src/routes/beneficiaries.ts` (131 lines, 6 endpoints) · `artifacts/api-server/src/routes/accounts.ts` (129 lines, 6 endpoints) · `artifacts/api-server/src/routes/stripe.ts` (111 lines, 2 endpoints).
> **URL prefixes**: `/api/v1/payment-info/...`, `/api/v1/commissions/...`, `/api/v1/beneficiaries/...`, `/api/v1/accounts/...`, `/api/v1/stripe/...`.
> **Auth guard (24 of 26)**: `requireAuth` (admin/staff guard mounted at `app.ts:167`). Eight endpoints (P5/P6 with `permanent=true`, C5/C6 with `permanent=true`, B5/B6 with `permanent=true`, A5/A6 with `permanent=true`) additionally gate HARD DELETE behind `req.user.role === "SuperAdmin"`. **2 endpoints exempt**: `S1` (`GET /v1/stripe/config`) is mounted at `app.ts:156` after global `requireAuth` (`app.ts:167`) — confirm read of `app.ts` mount order during T002.2.f cross-pass; `S2` (`POST /v1/stripe/webhook`) is mounted **before** `requireAuth` at `app.ts:142-143` with `express.raw({ type: "application/json" })` middleware and uses Stripe-signature HMAC verification instead.
> **Domain group**: `finance` — collection/disbursement side. Sister file: [`finance-invoicing.md`](./finance-invoicing.md) (creation/lifecycle). See [INDEX.md § Domain Groups](./INDEX.md#domain-groups).

**Scope**: This file documents the **payment infrastructure** (bank/Stripe payment instruments), **commission rules**, **beneficiary split definitions**, **account master records** (the parties that pay/receive), and the **Stripe webhook ingestion** that closes invoice state transitions. Invoice creation and recurring schedules live in `finance-invoicing.md`.

---

## §0. Endpoint Inventory

| # | Method | Path | Category | Source | Money | logAction | CF anchors |
|--:|---|---|---|---|:-:|:-:|---|
| P1 | GET | `/v1/payment-info` | READ | `payment-info.ts:15-26` | ❌ | ❌ | — |
| P2 | POST | `/v1/payment-info` | WRITE | `payment-info.ts:28-33` | ❌ (instrument metadata) | ❌ ⚠️ | CF-008 |
| P3 | GET | `/v1/payment-info/:id` | READ | `payment-info.ts:35-41` | ❌ | ❌ | C3-1 (soft-delete leak) |
| P4 | PUT | `/v1/payment-info/:id` | WRITE | `payment-info.ts:43-54` | ❌ | ❌ ⚠️ | CF-008 |
| P5 | POST | `/v1/payment-info/bulk-delete` | WRITE (HARD DEL) | `payment-info.ts:56-72` | ❌ | ❌ ⚠️ | CF-008, CF-015 |
| P6 | DELETE | `/v1/payment-info/:id` | WRITE (HARD DEL) | `payment-info.ts:74-88` | ❌ | ❌ ⚠️ | CF-008, CF-015 |
| C1 | GET | `/v1/commissions` | READ | `commissions.ts:15-26` | ❌ (read) | ❌ | — |
| C2 | POST | `/v1/commissions` | WRITE | `commissions.ts:28-33` | ✅ (`real`) | ❌ ⚠️ | **CF-001 anchor**, CF-008 |
| C3 | GET | `/v1/commissions/:id` | READ | `commissions.ts:35-41` | ❌ | ❌ | C3-1 |
| C4 | PUT | `/v1/commissions/:id` | WRITE | `commissions.ts:43-54` | ✅ (`real`) | ❌ ⚠️ | CF-001, CF-008 |
| C5 | POST | `/v1/commissions/bulk-delete` | WRITE (HARD DEL) | `commissions.ts:56-72` | ❌ | ❌ ⚠️ | CF-008, CF-015 |
| C6 | DELETE | `/v1/commissions/:id` | WRITE (HARD DEL) | `commissions.ts:74-88` | ❌ | ❌ ⚠️ | CF-008, CF-015 |
| B1 | GET | `/v1/beneficiaries` | READ | `beneficiaries.ts:34-55` | ❌ (read) | ❌ | C3-6 (q vs search) |
| B2 | POST | `/v1/beneficiaries` | WRITE | `beneficiaries.ts:57-62` | ✅ (`real`) | ❌ ⚠️ | **CF-001 anchor**, CF-008 |
| B3 | GET | `/v1/beneficiaries/:id` | READ | `beneficiaries.ts:64-78` | ❌ | ❌ | (joined read — no soft-delete leak; see logic) |
| B4 | PUT | `/v1/beneficiaries/:id` | WRITE | `beneficiaries.ts:80-93` | ✅ (`real`) | ❌ ⚠️ | CF-001, CF-008 |
| B5 | POST | `/v1/beneficiaries/bulk-delete` | WRITE (HARD DEL) | `beneficiaries.ts:95-111` | ❌ | ❌ ⚠️ | CF-008, CF-015, C3-7 |
| B6 | DELETE | `/v1/beneficiaries/:id` | WRITE (HARD DEL) | `beneficiaries.ts:113-129` | ❌ | ❌ ⚠️ | CF-008, CF-015, C3-7 |
| A1 | GET | `/v1/accounts` | READ | `accounts.ts:47-65` | ❌ (read) | ❌ | C3-2 (N+1 enrichment), C3-6 (search vs q) |
| A2 | POST | `/v1/accounts` | WRITE | `accounts.ts:67-72` | ❌ (master) | ❌ ⚠️ | CF-008 |
| A3 | GET | `/v1/accounts/:id` | READ | `accounts.ts:74-80` | ❌ | ❌ | C3-1, C3-2 |
| A4 | PUT | `/v1/accounts/:id` | WRITE | `accounts.ts:82-93` | ❌ | ❌ ⚠️ | CF-008 |
| A5 | POST | `/v1/accounts/bulk-delete` | WRITE (HARD DEL) | `accounts.ts:95-111` | ❌ | ❌ ⚠️ | CF-008, CF-015 |
| A6 | DELETE | `/v1/accounts/:id` | WRITE (HARD DEL) | `accounts.ts:113-127` | ❌ | ❌ ⚠️ | CF-008, CF-015 |
| S1 | GET | `/v1/stripe/config` | READ (config) | `stripe.ts:15-23` | ❌ | ❌ | C3-9 (publishable key over GET) |
| S2 | POST | `/v1/stripe/webhook` | EVENT-INGEST (state) | `stripe.ts:25-109` | ✅ ($ event) | ✅ ×3 | **CF-010 anchor**, CF-014, C3-3, C3-4, C3-5, C3-8 |

**Counts**: 8 READ (incl. S1) · 14 WRITE (8 CRUD + 8 HARD-DELETE; **note**: CRUD + HARD-DEL counts 4 × {POST, PUT} = 8 CRUD + 4 × {bulk-del, single-del} = 8 HARD-DEL) · 0 STATE-TRANSITION (vs 4 in finance-invoicing) · 1 EVENT-INGEST (S2 webhook). Total **26**.

**Audit coverage**: **3 of 26 endpoints** call `logAction` — and **all 3 sit inside `stripe.ts:25-109` (S2)**, none in payment-info / commissions / beneficiaries / accounts. Of the **17 mutator endpoints** (P2/P4/P5/P6, C2/C4/C5/C6, B2/B4/B5/B6, A2/A4/A5/A6, S2), only **1 endpoint (S2)** issues `logAction` calls → **endpoint mutator-coverage = 1/17 = 5.9%**, or **call-count coverage = 3/17 = 17.6%** depending on metric. The 16 CRUD/HARD-DELETE mutators across the four lookup-style routes are **completely silent** to `system_logs`. See [§5 spot-check C2](#5-spot-check-verification--r-repo-7-c) and CF-008 domain severity matrix in [§7 cross-references](#7-cross-references).

**Money columns touched by this file** (CF-001 finance-internal schism, see §1):
- C2/C4 write `commissions.commission_rate` and `commissions.commission_amount` — both **`real`** (`lib/db/src/schema/commissions.ts:9-10`).
- B2/B4 write `beneficiaries.split_percentage` and `beneficiaries.fixed_amount` — both **`real`** (`lib/db/src/schema/beneficiaries.ts:12-13`).
- S2 writes `invoices.status` / `invoices.paid_at` only (no money column) — note: it **never** writes `invoices.stripe_payment_intent_id` (`lib/db/src/schema/invoices.ts:15`) despite that column existing for this purpose. See C3-8.

---

## §1. CF-001 Finance-Internal Boundary Block

> **R-REPO-1 obligation** (also satisfies guide [E]): This block enumerates all CF-001 (mixed `real` ↔ `numeric` for money columns) sites in this file, so that `CRITICAL_FINDINGS.md#cf-001` evidence cross-references both finance halves and quantifies the boundary that runs **inside** the finance domain — not between finance and another domain.

| Anchor | File:Line | Money columns | Type | Side of schism |
|---|---|---|---|---|
| **C2/C4 commissions write** | `commissions.ts:28-33`, `:43-54` | `commission_rate`, `commission_amount` | **`real`** (`commissions.ts:9-10` schema) | ❌ unsafe (FP) |
| **B2/B4 beneficiaries write** | `beneficiaries.ts:57-62`, `:80-93` | `split_percentage`, `fixed_amount` | **`real`** (`beneficiaries.ts:12-13` schema) | ❌ unsafe (FP) |
| (sister file, contrast) | `finance-invoicing.md` E2/E4/R2/R3/R5 → `invoices.amount`, `recurring_schedule.amount` | — | **`numeric(10,2)`** | ✅ safe (decimal) |

**Severity ranking**: both **C2/C4** and **B2/B4** are CF-001 anchors. Neither route does any arithmetic on the columns at INSERT/UPDATE time (Zod `safeParse` then verbatim `db.insert(...).values(parsed.data)`), so the FP risk is **dormant at write**. The risk **realises at read-time downstream**, when `commissions.commission_rate × invoices.amount` (or `beneficiaries.split_percentage × invoices.amount`) is multiplied to compute split disbursements — that consumer is **not located in this codebase** (no route currently performs the multiplication; grep `commission_rate.*\*\|split_percentage.*\*` returns 0 hits in `artifacts/api-server/src/routes/`). **CF-001 evidence**: the rule-violating columns exist and are populated via this domain's writers, but no consumer yet realises the FP error → currently a **latent** risk, not a manifested one. T004 `_rules/financial-rules.md` should mandate `numeric(10,4)` for both before any disbursement calculator is built.

→ **CRITICAL_FINDINGS.md#cf-001 cross-ref to add (post-write)**: 4 file:line additions — `commissions.ts:28-33`, `commissions.ts:43-54`, `beneficiaries.ts:57-62`, `beneficiaries.ts:80-93` — paired with schema citations (`commissions.ts:9-10`, `beneficiaries.ts:12-13`). Note that `invoices.amount` is `numeric(10,2)` so the boundary runs **inside** the finance domain group, not between finance and ops.

---

## §1.5. Step 4 Pre-Sealing Block (R-REPO-7 §c)

> 3 spot-check claims sealed **before** §2 body authoring. Verification at §5 must reference these exact claims (no movement allowed).

- **C1 — Most-complex endpoint**: **S2** (`stripe.ts:25-109`) is the most complex endpoint in this file. Helper chain: `getStripe()` (`stripe.ts:9-13`) → `stripe.webhooks.constructEvent()` (signature verify, `stripe.ts:42`) → `switch(event.type)` 3-branch (`stripe.ts:50-101`) → `db.update(invoicesTable)` (only in `payment_intent.succeeded`, `stripe.ts:55-57`) + `logAction(...)` ×3 in three branches (`stripe.ts:58-63`, `:73-78`, `:88-93`) → fall-through `default: console.log` (`stripe.ts:99-100`).
- **C2 — CF anchor cluster endpoint**: **C2** (`commissions.ts:28-33`) anchors **CF-001** (commission_rate/amount `real`, schema `commissions.ts:9-10`) **AND CF-008** (no `logAction` after INSERT) **AND CF-017 negative** (no direct Zod-schema reuse from `@workspace/api-zod` deviation — wait, it DOES use `CreateCommissionBody` from `api-zod`, so this is CF-017 **positive exemplar continuation** like R2). Meta line must show `Auth: requireAuth | $$: Y | logAction: N ⚠️ | CF: CF-001, CF-008` with 4 fields and CF-001 + CF-008 cited.
- **C3 — Self-discovered inconsistency catalogue**: predicted ≥6 inconsistencies given the 4-route copy-paste pattern (search-vs-q, bulk-delete updated_at split, NumIds filter, error-code 503-vs-400, write-orphan stripe columns, idempotency gap). Predicted severity tally: **2🔴 / 5🟡 / 1🟢 / 1⚠️-system** (re-counted at §5).

---

## §2. Endpoints

### P1 — GET `/api/v1/payment-info`

**Meta**: `Auth: requireAuth | $$: N | logAction: N (read) | CF: —`

| Field | Value |
|---|---|
| **Source** | `payment-info.ts:15-26` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ instrument metadata only (bank, BSB, swift, stripe_account_id) |
| **Side effects** | 1 SELECT |
| **logAction** | ❌ n/a |
| **Idempotent** | ✅ |

### Request
**Query**: `search` (ilike `name`), `payment_type`. Validated via `ListPaymentInfoQueryParams.safeParse(req.query)` (`payment-info.ts:16`). 400 on parse fail.

### Response
Array of `paymentInfoTable` rows ordered by `name`.

### Logic summary
1. Build `conditions: SQL[] = [isNull(deleted_at)]` — soft-deleted rows excluded ✅.
2. Optional `payment_type` exact match; optional `search` `ilike '%...%'` over `name`.
3. `db.select().from(paymentInfoTable).where(and(...conditions)).orderBy(name)`.

### Cross-references
- Naming inconsistency: this route uses `search` query param, B1 (beneficiaries) uses `q`, A1 (accounts) uses `search` again — see [C3-6](#3-self-discovered-inconsistencies).

---

### P2 — POST `/api/v1/payment-info`

**Meta**: `Auth: requireAuth | $$: N | logAction: N ⚠️ | CF: CF-008`

| Field | Value |
|---|---|
| **Source** | `payment-info.ts:28-33` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ payment instrument metadata (no monetary value column) |
| **Side effects** | 1 INSERT |
| **logAction** | ❌ ⚠️ silent create — no `system_logs` row |
| **Idempotent** | ❌ |

### Request
**Body**: `CreatePaymentInfoBody.safeParse(req.body)` (`payment-info.ts:29`). Includes `name` (required), `payment_type` (default `BankTransfer`), bank/swift/bsb/account_number/account_name, `stripe_account_id`, `description`, `status`. 400 on parse fail.

### Response
`201` + inserted row from `.returning()`.

### Logic summary
1. Zod parse via `api-zod` schema.
2. `db.insert(paymentInfoTable).values(parsed.data).returning()`.
3. Respond 201.

### Cross-references
- Pattern shared with C2/B2/A2 — identical 5-line shape (Zod parse → insert → return). All 4 lack `logAction`.

---

### P3 — GET `/api/v1/payment-info/:id`

**Meta**: `Auth: requireAuth | $$: N | logAction: N (read) | CF: —`

| Field | Value |
|---|---|
| **Source** | `payment-info.ts:35-41` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | 1 SELECT |
| **logAction** | ❌ n/a |
| **Idempotent** | ✅ |

### Request
**Params**: `GetPaymentInfoParams.safeParse(req.params)` — `id: number`.

### Response
Row or 404.

### Logic summary
1. Zod parse params.
2. `db.select().from(paymentInfoTable).where(eq(id, parsed.data.id))`.
3. 404 if not found.
4. ⚠️ **No `isNull(deleted_at)` filter** — soft-deleted records readable by direct `:id` access. Same pattern as finance-invoicing E3 → see [C3-1](#3-self-discovered-inconsistencies).

### Cross-references
- C3-1 system-wide soft-delete leak — same root pattern as `invoices.ts:88` (E3) and `lookup.ts` GET-by-id reads.

---

### P4 — PUT `/api/v1/payment-info/:id`

**Meta**: `Auth: requireAuth | $$: N | logAction: N ⚠️ | CF: CF-008`

| Field | Value |
|---|---|
| **Source** | `payment-info.ts:43-54` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | 1 UPDATE (sets `updated_at = new Date()` explicitly + body fields) |
| **logAction** | ❌ ⚠️ |
| **Idempotent** | ✅ (PUT semantics) |

### Request
**Params**: `UpdatePaymentInfoParams.safeParse(req.params)` (`payment-info.ts:44`).
**Body**: `UpdatePaymentInfoBody.safeParse(req.body)` (`payment-info.ts:46`). Two-stage parse — both must succeed.

### Response
Updated row or 404.

### Logic summary
1. Two-stage Zod parse (params, body).
2. `db.update(paymentInfoTable).set({ ...bodyParsed.data, updated_at: new Date() }).where(eq(id, ...)).returning()`.
3. 404 if no row updated.

### Cross-references
- `updated_at: new Date()` set explicitly here, but **also** auto-set by `$onUpdate(() => new Date())` (`payment_info.ts:19` schema) — redundant but harmless. Same redundancy in C4/B4/A4.

---

### P5 — POST `/api/v1/payment-info/bulk-delete`

**Meta**: `Auth: requireAuth + SuperAdmin (always); SuperAdmin alone enables HARD via permanent flag | $$: N | logAction: N ⚠️ | CF: CF-008, CF-015`

| Field | Value |
|---|---|
| **Source** | `payment-info.ts:56-72` |
| **Status** | ACTIVE (HARD DELETE path enabled by `permanent: true` body flag) |
| **Money-touching** | ❌ |
| **Side effects** | 1 batch DELETE **or** 1 batch UPDATE on N rows |
| **logAction** | ❌ ⚠️ — bulk hard/soft delete with **zero** audit trail |
| **Idempotent** | ✅ (DELETE) / ✅ (idempotent UPDATE-to-Archived) |

### Request
**Auth gate** (`payment-info.ts:57-60`): inline check `currentUser?.role !== "SuperAdmin"` → 403. **No Zod** — raw `req.body.{ ids, permanent }` destructure (`payment-info.ts:61`). `ids` must be non-empty array of coercible numerics; `permanent: boolean` selects hard-vs-soft.

### Response
`{ success: true, affected: numIds.length }`.

### Logic summary
1. Inline RBAC gate (SuperAdmin-only) for the entire endpoint.
2. Validate `ids` is non-empty array (raw, no Zod).
3. `numIds = ids.map(Number).filter(Boolean)` — drops `0`, `NaN`, `null`. Since serial PKs start at 1, dropping `0` is benign.
4. If `permanent` truthy → `db.delete(...).where(inArray(id, numIds))` (HARD).
5. Else → `db.update(...).set({ deleted_at: new Date(), status: "Archived" })` — **does not set `updated_at`** (relies on `$onUpdate` from `payment_info.ts:19`).
6. Respond `{ affected: numIds.length }` — note: `affected` is the **input** length, not actual rows touched, so already-deleted ids inflate the count.

### Cross-references
- C3-3 `affected` count overstatement — same in C5/B5/A5.
- C3-4 bulk-delete soft-path `updated_at` not explicitly set — diverges from B5 which **does** set `updated_at` explicitly (`beneficiaries.ts:108`).
- C3-7 `permanent` is read raw from `req.body` without Zod — diverges from per-id DELETE which reads from `req.query.permanent === "true"` (`payment-info.ts:78`).

---

### P6 — DELETE `/api/v1/payment-info/:id`

**Meta**: `Auth: requireAuth (soft); requireAuth + SuperAdmin (when permanent=true) | $$: N | logAction: N ⚠️ | CF: CF-008, CF-015`

| Field | Value |
|---|---|
| **Source** | `payment-info.ts:74-88` |
| **Status** | ACTIVE (HARD DELETE path enabled by `?permanent=true` query) |
| **Money-touching** | ❌ |
| **Side effects** | 1 DELETE **or** 1 UPDATE |
| **logAction** | ❌ ⚠️ |
| **Idempotent** | ✅ |

### Request
**Params**: `DeletePaymentInfoParams.safeParse(req.params)`.
**Query**: `permanent: "true"` string check — **not Zod-validated** (`payment-info.ts:78`). When `permanent`, additional `currentUser?.role === "SuperAdmin"` gate (`payment-info.ts:80`); else 403.

### Response
204 No Content.

### Logic summary
1. Zod-parse params; if SuperAdmin + `permanent`, `db.delete(...)`. Else `db.update(...).set({ deleted_at: new Date(), status: "Archived" })` — no `updated_at` set.
2. Always 204 — caller cannot distinguish "deleted" from "row didn't exist".

### Cross-references
- C3-7 (permanent param source mismatch with bulk-delete).
- Same shape as C6/B6/A6 — only beneficiaries B6 sets `updated_at` explicitly.

---

### C1 — GET `/api/v1/commissions`

**Meta**: `Auth: requireAuth | $$: N | logAction: N (read) | CF: —`

| Field | Value |
|---|---|
| **Source** | `commissions.ts:15-26` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ (read of `real` columns — no arithmetic) |
| **Side effects** | 1 SELECT |
| **logAction** | ❌ n/a |
| **Idempotent** | ✅ |

### Request
**Query**: `search` (ilike `name`), `status`. Validated via `ListCommissionsQueryParams.safeParse`.

### Response
Array of `commissionsTable` rows ordered by `name`.

### Logic summary
1. `[isNull(deleted_at)]` baseline; conditional `status` and `search` push.
2. `db.select().from(commissionsTable).where(and(...conditions)).orderBy(name)`.

### Cross-references
- Identical shape to P1 (verbatim except table name and filter columns).

---

### C2 — POST `/api/v1/commissions`

**Meta**: `Auth: requireAuth | $$: Y | logAction: N ⚠️ | CF: CF-001, CF-008`

| Field | Value |
|---|---|
| **Source** | `commissions.ts:28-33` |
| **Status** | ACTIVE |
| **Money-touching** | ✅ writes `commission_rate: real` and `commission_amount: real` (`commissions.ts:9-10`) — **CF-001 anchor** |
| **Side effects** | 1 INSERT |
| **logAction** | ❌ ⚠️ silent create — no audit row despite money-touching |
| **Idempotent** | ❌ |

### Request
**Body**: `CreateCommissionBody.safeParse(req.body)` — uses generated Zod from `@workspace/api-zod` (CF-017 positive: schema reuse from contract package, no inline literal). Required: `name`. Optional with defaults: `commission_type` (`Percentage`), `commission_rate` (real), `commission_amount` (real), `description`, `status` (`Active`).

### Response
`201` + inserted row from `.returning()` (raw, no enrichment).

### Logic summary
1. Zod parse.
2. `db.insert(commissionsTable).values(parsed.data).returning()`.
3. Respond 201.

### Cross-references
- **CF-001 anchor** — `real` for money: see [§1 boundary block](#1-cf-001-finance-internal-boundary-block). Latent risk realises only when downstream multiplies these values against `invoices.amount` (currently no such consumer in repo).
- CF-008 — no audit trail despite financial-rule write. Combined with C4 (PUT), the entire commission-rule surface is silent to `system_logs`.
- CF-017 positive exemplar (continuation of R2 `recurring-schedules` exemplar in finance-invoicing.md): direct `api-zod` schema use, no inline `z.object({...})`.

---

### C3 — GET `/api/v1/commissions/:id`

**Meta**: `Auth: requireAuth | $$: N | logAction: N (read) | CF: —`

| Field | Value |
|---|---|
| **Source** | `commissions.ts:35-41` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ (read) |
| **Side effects** | 1 SELECT |
| **logAction** | ❌ n/a |
| **Idempotent** | ✅ |

### Request
**Params**: `GetCommissionParams.safeParse`.

### Response
Row or 404.

### Logic summary
1. `db.select().from(commissionsTable).where(eq(id, ...))`.
2. ⚠️ **No `isNull(deleted_at)` filter** — same C3-1 pattern as P3.

### Cross-references
- C3-1 system-wide soft-delete leak — 5th anchor confirmed (E3, P3, C3, A3, lookup reads).

---

### C4 — PUT `/api/v1/commissions/:id`

**Meta**: `Auth: requireAuth | $$: Y | logAction: N ⚠️ | CF: CF-001, CF-008`

| Field | Value |
|---|---|
| **Source** | `commissions.ts:43-54` |
| **Status** | ACTIVE |
| **Money-touching** | ✅ may rewrite `commission_rate`/`commission_amount` (`real`) |
| **Side effects** | 1 UPDATE (explicit `updated_at`) |
| **logAction** | ❌ ⚠️ |
| **Idempotent** | ✅ |

### Request
**Params**: `UpdateCommissionParams.safeParse`.
**Body**: `UpdateCommissionBody.safeParse`. Two-stage parse.

### Response
Updated row or 404.

### Logic summary
1. Two Zod parses.
2. `db.update(commissionsTable).set({ ...body, updated_at: new Date() }).where(eq(id, ...)).returning()`.
3. 404 if no row.

### Cross-references
- CF-001 sister-anchor with C2 (write side); together they form the full commission-rate surface.
- C4 ↔ existing rows: a rate change here **silently mutates all downstream calculations** for any future commission split based on this row — and yet **no audit row** records the prior rate. A rate revision with no recoverable prior value is a CF-008 + financial-rule violation.

---

### C5 — POST `/api/v1/commissions/bulk-delete`

**Meta**: `Auth: requireAuth + SuperAdmin (always) | $$: N | logAction: N ⚠️ | CF: CF-008, CF-015`

| Field | Value |
|---|---|
| **Source** | `commissions.ts:56-72` |
| **Status** | ACTIVE (HARD via `permanent: true` body flag) |
| **Money-touching** | ❌ (delete only) |
| **Side effects** | batch DELETE or batch UPDATE |
| **logAction** | ❌ ⚠️ |
| **Idempotent** | ✅ |

### Request
Same shape as P5 — inline RBAC, raw `{ ids, permanent }`, `numIds.filter(Boolean)`.

### Response
`{ success: true, affected: numIds.length }` — same overstatement pattern (C3-3).

### Logic summary
Verbatim copy of P5 logic with `commissionsTable` substitution. Soft-path **does not** set `updated_at` (`commissions.ts:69`).

### Cross-references
- C3-3, C3-4, C3-7 — verbatim duplicate site of P5 (and A5). Three of the four bulk-delete handlers (P5/C5/A5) share this pattern; B5 diverges by setting `updated_at`.

---

### C6 — DELETE `/api/v1/commissions/:id`

**Meta**: `Auth: requireAuth (soft); requireAuth + SuperAdmin (when permanent=true) | $$: N | logAction: N ⚠️ | CF: CF-008, CF-015`

| Field | Value |
|---|---|
| **Source** | `commissions.ts:74-88` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | 1 DELETE or 1 UPDATE |
| **logAction** | ❌ ⚠️ |
| **Idempotent** | ✅ |

### Request
Same shape as P6 — Zod params, query-string `permanent`, SuperAdmin gate when `permanent`.

### Response
204.

### Logic summary
Verbatim copy of P6 with `commissionsTable`. Soft-path lacks `updated_at` (`commissions.ts:85`).

### Cross-references
- C3-4, C3-7 — verbatim duplicate of P6 / A6. B6 diverges.

---

### B1 — GET `/api/v1/beneficiaries`

**Meta**: `Auth: requireAuth | $$: N | logAction: N (read) | CF: —`

| Field | Value |
|---|---|
| **Source** | `beneficiaries.ts:34-55` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ (read of `real` split columns) |
| **Side effects** | 1 SELECT with **3 LEFT JOINs** (`accounts`, `commissions`, `contract_products`) |
| **logAction** | ❌ n/a |
| **Idempotent** | ✅ |

### Request
**Query**: `q` (ilike `name`), `contract_product_id`, `account_id`, `status`. Validated via `ListBeneficiariesQueryParams.safeParse`. ⚠️ **Naming**: `q` here vs `search` in P1/C1/A1 — see [C3-6](#3-self-discovered-inconsistencies).

### Response
Array of beneficiary rows enriched via JOIN-select of `account_name`, `commission_name`, `contract_product_name` (`beneficiaries.ts:15-32` `SELECT_FIELDS`).

### Logic summary
1. Build conditions with `[isNull(deleted_at)]`.
2. `db.select(SELECT_FIELDS).from(beneficiariesTable).leftJoin(accountsTable).leftJoin(commissionsTable).leftJoin(contractProductsTable).where(...).orderBy(priority, name)`.
3. **Single JOIN** (not N+1 like A1) — performance smell **avoided** ✅ (positive contrast with A1).

### Cross-references
- ✅ Positive exemplar for join-once vs A1's per-row enrichment. **In §3, this is C3-2 contrast row, not violation row.**
- → contract.md cross-ref: `contract_product_id` joins back to contract domain (cross-domain ref [H] / [D]).

---

### B2 — POST `/api/v1/beneficiaries`

**Meta**: `Auth: requireAuth | $$: Y | logAction: N ⚠️ | CF: CF-001, CF-008`

| Field | Value |
|---|---|
| **Source** | `beneficiaries.ts:57-62` |
| **Status** | ACTIVE |
| **Money-touching** | ✅ writes `split_percentage: real` and `fixed_amount: real` (`beneficiaries.ts:12-13`) — **CF-001 anchor** |
| **Side effects** | 1 INSERT (raw, no JOIN-enrichment on return) |
| **logAction** | ❌ ⚠️ |
| **Idempotent** | ❌ |

### Request
**Body**: `CreateBeneficiaryBody.safeParse`. Required: `name`, `account_id` (NOT NULL per `beneficiaries.ts:9` schema). Optional: `contract_product_id`, `commission_id`, `commission_type` (default `Percentage`), `split_percentage` (real), `fixed_amount` (real), `priority` (default 1), `notes`, `status`.

### Response
`201` + raw inserted row (asymmetric: B1 returns enriched JOIN, B2 returns raw — consumer sees `account_name: undefined` immediately after create).

### Logic summary
1. Zod parse.
2. `db.insert(beneficiariesTable).values(parsed.data).returning()`.
3. 201.

### Cross-references
- **CF-001 anchor** — see [§1](#1-cf-001-finance-internal-boundary-block).
- B2 ↔ B1 response-shape asymmetry — listed in [§3](#3-self-discovered-inconsistencies).

---

### B3 — GET `/api/v1/beneficiaries/:id`

**Meta**: `Auth: requireAuth | $$: N | logAction: N (read) | CF: —`

| Field | Value |
|---|---|
| **Source** | `beneficiaries.ts:64-78` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ (read) |
| **Side effects** | 1 SELECT with 3 LEFT JOINs |
| **logAction** | ❌ n/a |
| **Idempotent** | ✅ |

### Request
**Params**: `GetBeneficiaryParams.safeParse`.

### Response
Enriched row or 404.

### Logic summary
1. Zod parse params.
2. `db.select(SELECT_FIELDS).from(beneficiariesTable).leftJoin(...).where(eq(beneficiariesTable.id, ...))`.
3. **No `isNull(deleted_at)` predicate** — soft-deleted beneficiaries readable by direct `:id` access. Same C3-1 root, although the JOIN-select obscures it more than P3/C3.

### Cross-references
- C3-1 system-wide soft-delete leak (6th anchor).

---

### B4 — PUT `/api/v1/beneficiaries/:id`

**Meta**: `Auth: requireAuth | $$: Y | logAction: N ⚠️ | CF: CF-001, CF-008`

| Field | Value |
|---|---|
| **Source** | `beneficiaries.ts:80-93` |
| **Status** | ACTIVE |
| **Money-touching** | ✅ may rewrite `split_percentage`/`fixed_amount` |
| **Side effects** | 1 UPDATE (explicit `updated_at`) |
| **logAction** | ❌ ⚠️ |
| **Idempotent** | ✅ |

### Request
**Params**: `UpdateBeneficiaryParams.safeParse`.
**Body**: `UpdateBeneficiaryBody.safeParse`.

### Response
Raw updated row (no JOIN-enrichment on return — same asymmetry as B2 vs B1/B3).

### Logic summary
1. Two Zod parses.
2. `db.update(beneficiariesTable).set({ ...body, updated_at: new Date() }).where(eq(id, ...)).returning()`.
3. 404 if no row.

### Cross-references
- CF-001 sister with B2.

---

### B5 — POST `/api/v1/beneficiaries/bulk-delete`

**Meta**: `Auth: requireAuth + SuperAdmin (always) | $$: N | logAction: N ⚠️ | CF: CF-008, CF-015`

| Field | Value |
|---|---|
| **Source** | `beneficiaries.ts:95-111` |
| **Status** | ACTIVE (HARD via `permanent`) |
| **Money-touching** | ❌ |
| **Side effects** | batch DELETE or batch UPDATE |
| **logAction** | ❌ ⚠️ |
| **Idempotent** | ✅ |

### Request
Same shape as P5/C5/A5 — inline RBAC, raw body.

### Response
`{ success: true, affected: numIds.length }`.

### Logic summary
Same as P5 with one **divergence** (`beneficiaries.ts:108`): the soft-delete `set({ deleted_at, status: "Archived", updated_at: new Date() })` **explicitly sets `updated_at`** — vs P5/C5/A5 which omit it and rely solely on `$onUpdate`. Behaviourally equivalent (since `$onUpdate` fires on any UPDATE), but lexically inconsistent across 4 sister files.

### Cross-references
- C3-4 — divergence anchor: B5 + B6 are the only routes in this file that explicitly set `updated_at` in the soft-delete branch.

---

### B6 — DELETE `/api/v1/beneficiaries/:id`

**Meta**: `Auth: requireAuth (soft); requireAuth + SuperAdmin (when permanent=true) | $$: N | logAction: N ⚠️ | CF: CF-008, CF-015`

| Field | Value |
|---|---|
| **Source** | `beneficiaries.ts:113-129` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | 1 DELETE or 1 UPDATE |
| **logAction** | ❌ ⚠️ |
| **Idempotent** | ✅ |

### Request
Same shape as P6/C6/A6.

### Response
204.

### Logic summary
Same as P6 with the same B5-style explicit `updated_at` in the soft-delete (`beneficiaries.ts:124-126`).

### Cross-references
- C3-4 sister with B5.

---

### A1 — GET `/api/v1/accounts`

**Meta**: `Auth: requireAuth | $$: N | logAction: N (read) | CF: —`

| Field | Value |
|---|---|
| **Source** | `accounts.ts:47-65` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ (master record; references commission/payment_info but no money column) |
| **Side effects** | 1 SELECT + **N × 5 enrichment SELECTs** (`enrichAccount` `accounts.ts:15-45` — primary_contact, secondary_contact, default_commission, payment_info, parent_account; each conditional on FK presence) |
| **logAction** | ❌ n/a |
| **Idempotent** | ✅ |

### Request
**Query**: `search` (ilike OR over `name`/`account_email`), `account_type`, `status`. Validated via `ListAccountsQueryParams.safeParse`.

### Response
Array of enriched account rows (each augmented with 5 `*_name` derivatives).

### Logic summary
1. `[isNull(deleted_at)]` baseline; optional filters; `or(ilike(name), ilike(email))` for search.
2. `db.select().from(accountsTable).where(...).orderBy(name)`.
3. `Promise.all(rows.map(enrichAccount))` — fans out **5 conditional sub-queries per row** (`accounts.ts:16-35`). At list scale of N rows, this is **5N additional round-trips** — N+1 (or 5N+1) anti-pattern.

### Cross-references
- C3-2 N+1 anchor (worst severity in this file). Contrast B1 which JOIN-joins three lookups in one SELECT.
- C3-6 (search vs q).
- → cross-domain refs [H]: `accounts.id` is FK target from `service-hosts.ts:33,49,63,76`, `reports.ts:45`, `lookup.ts:36-48`, plus `invoices.account_id` (finance-invoicing E1/E2 enrichment) and `beneficiaries.account_id` (B1 JOIN). Five distinct consumer surfaces; this is the **most-referenced master entity** in the inventory so far.

---

### A2 — POST `/api/v1/accounts`

**Meta**: `Auth: requireAuth | $$: N | logAction: N ⚠️ | CF: CF-008`

| Field | Value |
|---|---|
| **Source** | `accounts.ts:67-72` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | 1 INSERT + 5 enrichment SELECTs (calls `enrichAccount` on result) |
| **logAction** | ❌ ⚠️ — master-record creation with no audit |
| **Idempotent** | ❌ |

### Request
**Body**: `CreateAccountBody.safeParse`. Required: `name`, `account_type`. Many optional contact/address/financial-link fields. `default_currency` defaults `AUD` (`accounts.ts:27`).

### Response
`201` + enriched row (symmetric with A1).

### Logic summary
1. Zod parse.
2. `db.insert(accountsTable).values(parsed.data).returning()`.
3. `enrichAccount(row)` (5 sub-queries even for one row) before responding.

### Cross-references
- CF-008.

---

### A3 — GET `/api/v1/accounts/:id`

**Meta**: `Auth: requireAuth | $$: N | logAction: N (read) | CF: —`

| Field | Value |
|---|---|
| **Source** | `accounts.ts:74-80` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | 1 SELECT + 5 enrichment SELECTs |
| **logAction** | ❌ n/a |
| **Idempotent** | ✅ |

### Request
**Params**: `GetAccountParams.safeParse`.

### Response
Enriched row or 404.

### Logic summary
1. Zod parse.
2. `db.select().from(accountsTable).where(eq(id, ...))`.
3. ⚠️ **No `isNull(deleted_at)` filter** — C3-1 leak (7th anchor).
4. `enrichAccount` if found.

### Cross-references
- C3-1, C3-2.

---

### A4 — PUT `/api/v1/accounts/:id`

**Meta**: `Auth: requireAuth | $$: N | logAction: N ⚠️ | CF: CF-008`

| Field | Value |
|---|---|
| **Source** | `accounts.ts:82-93` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | 1 UPDATE (explicit `updated_at`) + 5 enrichment SELECTs |
| **logAction** | ❌ ⚠️ |
| **Idempotent** | ✅ |

### Request
Two-stage Zod (`UpdateAccountParams`, `UpdateAccountBody`).

### Response
Enriched updated row.

### Logic summary
1. Two Zod parses.
2. `db.update(accountsTable).set({ ...body, updated_at: new Date() }).where(eq(id, ...)).returning()`.
3. 404 if no row.
4. `enrichAccount` on returning row.

---

### A5 — POST `/api/v1/accounts/bulk-delete`

**Meta**: `Auth: requireAuth + SuperAdmin (always) | $$: N | logAction: N ⚠️ | CF: CF-008, CF-015`

| Field | Value |
|---|---|
| **Source** | `accounts.ts:95-111` |
| **Status** | ACTIVE (HARD via `permanent`) |
| **Money-touching** | ❌ |
| **Side effects** | batch DELETE or batch UPDATE |
| **logAction** | ❌ ⚠️ |
| **Idempotent** | ✅ |

### Request
Same as P5/C5/B5 — inline RBAC, raw body.

### Response
`{ success: true, affected: numIds.length }`.

### Logic summary
Verbatim with `accountsTable`. Soft-path lacks `updated_at` (`accounts.ts:108`) — sister with P5/C5, divergent from B5.

### Cross-references
- C3-3, C3-4, C3-7.

---

### A6 — DELETE `/api/v1/accounts/:id`

**Meta**: `Auth: requireAuth (soft); requireAuth + SuperAdmin (when permanent=true) | $$: N | logAction: N ⚠️ | CF: CF-008, CF-015`

| Field | Value |
|---|---|
| **Source** | `accounts.ts:113-127` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | 1 DELETE or 1 UPDATE |
| **logAction** | ❌ ⚠️ |
| **Idempotent** | ✅ |

### Request
Same shape as P6/C6/B6.

### Response
204.

### Logic summary
Same as P6 with `accountsTable`. Soft-path lacks explicit `updated_at` (`accounts.ts:124`).

### Cross-references
- C3-4, C3-7.

---

### S1 — GET `/api/v1/stripe/config`

**Meta**: `Auth: requireAuth (mounted after global guard, see header) | $$: N | logAction: N (read) | CF: C3-9`

| Field | Value |
|---|---|
| **Source** | `stripe.ts:15-23` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ (config read) |
| **Side effects** | 0 DB; reads `process.env["STRIPE_PUBLISHABLE_KEY"]` |
| **logAction** | ❌ n/a |
| **Idempotent** | ✅ |

### Request
None.

### Response
`{ publishable_key: string|null, mode: "live"|"test", configured: boolean }`. Mode derived from `pk_live_` prefix (`stripe.ts:17`).

### Logic summary
1. Read env var directly (no Zod, no caching).
2. Return JSON.

### Cross-references
- ⚠️ Publishable key returned over GET is the **public** Stripe key (designed for client-side use); not a leak per Stripe's threat model. Captured here as **C3-9** because the endpoint also exposes deployment **mode** (live vs test) to any authenticated user — minor info-disclosure, not a breach. → `_rules/security-rules.md` (T004).

---

### S2 — POST `/api/v1/stripe/webhook`

**Meta**: `Auth: NONE (Stripe signature HMAC instead — mounted before requireAuth at app.ts:142-143 with express.raw) | $$: Y (event) | logAction: Y ×3 (one per handled event) | CF: CF-010, CF-014, C3-3, C3-4, C3-5, C3-8`

| Field | Value |
|---|---|
| **Source** | `stripe.ts:25-109` |
| **Status** | ACTIVE |
| **Money-touching** | ✅ event-driven (consumes Stripe `payment_intent.*` and `charge.*`); writes `invoices.status` + `invoices.paid_at` on success |
| **Side effects** | 1 conditional UPDATE on `invoices` (only `payment_intent.succeeded` branch) + up to 1 `logAction` per event branch (3 branches handled). **No `db.transaction` wrap** around the UPDATE + `logAction` pair → CF-014 sister-site (sequential 2-table mutation: `invoices` + `system_logs`) |
| **logAction** | ✅ in 3 branches (`stripe.ts:58-63` PAYMENT, `:73-78` STATUS_CHANGE, `:88-93` STATUS_CHANGE) |
| **Idempotent** | ❌ — see Idempotency Analysis below |

### Request
**Body**: raw `Buffer` (mounted with `express.raw({ type: "application/json" })` at `app.ts:143`).
**Headers**: `stripe-signature` required.
**Pre-check** (`stripe.ts:26-38`):
- 503 if `STRIPE_SECRET_KEY` not set (no Stripe client).
- 400 if `stripe-signature` header **OR** `STRIPE_WEBHOOK_SECRET` env missing — same status code for two distinct failure modes (env-config vs request-malformed) — anchor for [C3-10](#3-self-discovered-inconsistencies).
**Verify**: `stripe.webhooks.constructEvent(req.body, sig, webhookSecret)` (`stripe.ts:42`); 400 on signature failure with `err.message` echoed.

### Response
`{ received: true, type: event.type }` on success; 400 on signature-fail; 500 on handler exception (`stripe.ts:103-105` — note this fires **after** DB partial state is possible).

### Logic summary
1. Get Stripe client (503-gated on `STRIPE_SECRET_KEY`).
2. Header + secret presence check (400).
3. `constructEvent` HMAC verify (400 on fail).
4. `switch (event.type)`:
   - **`payment_intent.succeeded`** (`:51-67`): if `pi.metadata.invoice_id` numeric, `db.update(invoicesTable).set({ status: "Paid", paid_at, updated_at }).where(eq(id, invoiceId))` then `logAction({ entityType: "invoice", action: "PAYMENT", newValue: { status: "Paid", stripe_payment_intent: pi.id, amount: pi.amount } })`. **Note**: the Stripe PI id is recorded only in `system_logs.new_value` JSON, never written to `invoices.stripe_payment_intent_id` column → **C3-8 (write-orphan column)**.
   - **`payment_intent.payment_failed`** (`:69-82`): only `logAction({ action: "STATUS_CHANGE", newValue: { stripe_status: "payment_failed", ... } })`. **No invoice update** — invoice remains in prior state.
   - **`charge.refunded`** (`:84-97`): only `logAction({ action: "STATUS_CHANGE", newValue: { stripe_status: "refunded", ... } })`. **No invoice update** — invoice stays `Paid` after refund.
   - **`default`** (`:99-100`): `console.log` only. No `logAction`. Silent for all unlisted events.
5. Outer `try/catch` around the whole switch (`:49-106`); 500 on any throw, but the partial DB write (if UPDATE succeeded before `logAction` threw) is not rolled back.
6. `res.json({ received: true, type })`.

### Cross-references
- **CF-010 anchor**: see Event Coverage Matrix below.
- **CF-014 sister**: 2-step mutation (`invoices` UPDATE + `system_logs` INSERT) without `db.transaction`. See finance-invoicing.md §1 anchor block — this site joins R5 generate-due as a CF-014 locus.
- **C3-3/C3-4/C3-5/C3-8/C3-10** anchored here.
- → finance-invoicing.md E8 (`POST /:id/pay`) — the **alternate** entry point for transitioning an invoice to Paid; E8 always logs PAYMENT, S2 only logs PAYMENT in the succeeded branch. Two paths to `Paid`, asymmetric audit shape.

### Event Coverage Matrix (S2 supplemental)

| Stripe Event | Handler? | Invoice State Change | logAction action | CF |
|---|:-:|---|---|---|
| `payment_intent.succeeded` | ✅ | → `Paid` (sets `paid_at`) | `PAYMENT` | — (positive) |
| `payment_intent.payment_failed` | ⚠️ partial | (none) | `STATUS_CHANGE` | CF-010 |
| `charge.refunded` | ⚠️ partial | (none) | `STATUS_CHANGE` | CF-010 |
| `charge.dispute.created` | ❌ | (none) | (none) | CF-010 |
| `charge.dispute.closed` (won/lost) | ❌ | (none) | (none) | CF-010 |
| `invoice.payment_succeeded` | ❌ | (none) | (none) | CF-010 |
| `invoice.payment_failed` | ❌ | (none) | (none) | CF-010 |
| `customer.subscription.*` | ❌ | (none) | (none) | CF-010 |
| any other | ❌ default `console.log` | (none) | (none) | CF-010 |

**Source-of-truth verification** (`stripe.ts:50-101`): `switch` has exactly **3 `case`** arms (`payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`) plus `default`. The Step-1 pre-classification's "1 case + 8 missing" was inaccurate; corrected here to "3 cases handled (1 full, 2 partial), N events unlisted" — see [§4 self-check](#4-self-check) for the correction.

### Accounting Drift Scenarios (CF-010 cross-ref)

| Scenario | Real-world trigger | DB state after | Drift |
|---|---|---|---|
| `payment_intent.payment_failed` after a successful retry never arrives | Card declined; user abandons | Invoice stays at prior status (likely `Sent`) | Soft drift — invoice is correctly **not** `Paid`, but no payment-attempt history captured beyond `system_logs` |
| `charge.refunded` issued by ops in Stripe dashboard | Refund issued out-of-band | Invoice **stays `Paid`**; `paid_at` unchanged | **Hard drift** — accounting reports show paid revenue that has been refunded |
| `charge.dispute.created` | Customer chargeback | (no row anywhere) | **Hard drift** — chargeback invisible to MillionStay; could result in unrecognised debit on Stripe side |
| `payment_intent.succeeded` redelivered (idempotency event) | Stripe re-delivers (default 3 attempts within 3 days) | Invoice `status="Paid"` re-set, `paid_at` overwritten with new timestamp; **second** `system_logs` PAYMENT row appended | **Soft-to-hard drift** — `paid_at` jitters; double-PAYMENT log inflates audit metrics |
| Webhook secret rotated mid-flight | Stripe-signature still valid for old secret | 400 returned; Stripe retries; succeeds after env reload | Operational — not a data drift |

### Idempotency Analysis (S2 supplemental)

Stripe webhooks are **at-least-once** delivery (per [Stripe docs](https://docs.stripe.com/webhooks#handle-duplicate-events)). The `event.id` is the canonical dedup key.

- **Code reality** (`stripe.ts:25-109`): **no `event.id` check** anywhere. The handler proceeds to UPDATE / `logAction` on every delivery.
- **Failure mode 1** (`payment_intent.succeeded` redelivered): re-sets `invoices.status="Paid"` (idempotent on column value but `paid_at = new Date()` is overwritten with new time → audit-log timestamp drift) and **appends a duplicate `system_logs` PAYMENT row** with same `stripe_payment_intent` in `new_value` (double-counting hazard for any audit consumer aggregating by action count).
- **Failure mode 2** (`charge.refunded` redelivered): two `STATUS_CHANGE` rows appended; only metadata `amount_refunded` allows dedup.
- **Failure mode 3** (cross with CF-014): if the redelivered `succeeded` event runs concurrently with another handler (e.g. finance-invoicing E8 `/:id/pay`), the lack of transaction wrap means two PAYMENT rows + two `paid_at` writes can interleave non-deterministically.
- **Combined risk with CF-014**: doubly-bad. CF-014 says no rollback on partial failure; idempotency gap says retry can succeed after a partial failure → state can be a hybrid of "first try partial DB write" + "second try complete write" with no observable signal that two attempts occurred.

→ T004 `_rules/integration-rules.md` should mandate `event.id` dedup using a `processed_webhooks(event_id PRIMARY KEY)` table or a unique constraint on `(entity_type, entity_id, action, new_value->>'stripe_event_id')` over `system_logs`.

---

## §3. Self-Discovered Inconsistencies

> Detected during 26-endpoint pass. Not currently in CRITICAL_FINDINGS.md unless flagged with a CF link.

| # | Severity | Site(s) | Pattern |
|---|:-:|---|---|
| C3-1 | ⚠️-system | P3 (`payment-info.ts:35-41`), C3 (`commissions.ts:35-41`), B3 (`beneficiaries.ts:64-78`), A3 (`accounts.ts:74-80`) | GET `:id` does **not** filter `isNull(deleted_at)` — soft-deleted records leak via direct id access. Continuation of the same system-wide pattern catalogued in finance-invoicing.md C3-1 (E3, E10). Now **9 anchors total** (E3, E10, P3, C3, B3, A3 + 3 prior). Confirmed system-wide → CF candidate (proposed in §6 R-REPO-5 incidentals as CF-020). |
| C3-2 | 🔴 | A1/A3/A4 (`accounts.ts:15-45` `enrichAccount`) | **5 conditional sub-SELECTs per row** in `enrichAccount`; `Promise.all` over rows still issues `5N+1` queries at list scale. Contrast with B1's single JOIN-select. **Worst N+1 pattern in inventory so far** (finance-invoicing E1 was 3 sub-SELECTs/row; A1 is 5). |
| C3-3 | 🟡 | P5/C5/B5/A5 (4 bulk-delete sites) | `affected: numIds.length` overstates actual rows touched — already-deleted ids still increment the count. Caller cannot distinguish "deleted 5 of 5" vs "deleted 3 of 5 (2 already gone)". 4 anchors. |
| C3-4 | 🟡 | P5/C5/A5 soft-paths omit `updated_at`; B5 sets it explicitly | Lexical inconsistency across 4 sister files. Behaviourally equivalent (`$onUpdate` always fires), but a future maintainer turning off `$onUpdate` would silently break P5/C5/A5 only. Same issue at single-DELETE level (P6/C6/A6 vs B6). 8 anchors total (4 bulk + 4 single). |
| C3-5 | 🟡 | All 16 mutator endpoints (excluding S2) | **Zero `logAction`** across 4 lookup-route files. Quantifies CF-008 finance-payments severity → **endpoint mutator-coverage = 1/17 = 5.9%**, dominated by S2 alone. Not a new pattern, but a new severity datapoint per guide [F]. |
| C3-6 | 🟡 | B1 uses `q`; P1/C1/A1 use `search` | Naming inconsistency in list-filter query param. Minor for consumers; significant for `_rules/api-rules.md` (T004) consistency baseline. 4 sister files diverge 3:1. |
| C3-7 | 🟡 | P5/C5/B5/A5 read `permanent` from `req.body` (no Zod); P6/C6/B6/A6 read `permanent` from `req.query.permanent === "true"` (string equality, no Zod) | Two different parsing pipelines for the **same flag** within the same file. Body-side has no shape validation; query-side is string-coerced and case-sensitive. 8 anchors. |
| C3-8 | 🟡 | S2 success branch (`stripe.ts:55-63`) ↔ `invoices.stripe_payment_intent_id` (`lib/db/src/schema/invoices.ts:15`) | **Write-orphan column**: `invoices.stripe_payment_intent_id` is declared but **no route writes it** (verified by repo-wide grep). The Stripe PI id is captured only in `system_logs.new_value` JSON. Same for `invoices.stripe_checkout_url` (`:16`). Schema-vs-code drift. NEW finding — proposed as CF-019 candidate in §6 and **promoted to CF-019 in this atomic commit**. |
| C3-9 | 🟢 | S1 (`stripe.ts:15-23`) | Returns `mode: "live"|"test"` to authenticated user. Minor info-disclosure to staff/admin tier (not external). Note for `_rules/security-rules.md`. |
| C3-10 | 🟡 | S2 pre-check (`stripe.ts:35-38`) | 400 returned for two distinct failures: missing header (request-malformed) **and** missing webhook-secret env (server-misconfig). The latter should be 503 (consistent with line 28's 503-on-missing-`STRIPE_SECRET_KEY`). Internal sister inconsistency within S2. |
| C3-11 | 🟡 | B1/B3 return enriched JOIN; B2/B4 return raw row | Asymmetric response shape on the same resource — consumer that just POSTed must immediately re-GET to render `account_name`. 4 anchors (2 in beneficiaries, contrast with A2/A4 which **do** call `enrichAccount` for symmetry). |

**Severity tallies**: 1🔴 (C3-2), 7🟡 (C3-3, C3-4, C3-5, C3-6, C3-7, C3-10, C3-11), 1🟢 (C3-9), 2⚠️-system (C3-1, C3-8). **Total: 11 categories.**

**Vs Step 4 sealing prediction**: predicted 2🔴 / 5🟡 / 1🟢 / 1⚠️-system; actual 1🔴 / 7🟡 / 1🟢 / 2⚠️-system. **Severity prediction missed by –1🔴/+2🟡/+1⚠️**. Recorded for §5 spot-check C3 and §6 R-REPO-5.

---

## §4. Self-Check (R-REPO-2 §a — 7 items × 26 endpoints = 182 cells)

> Each row asks: ① every endpoint covered? ② file:line correct? ③ Meta 4-fields complete? ④ Logic-summary references citeable lines? ⑤ logAction state truthful? ⑥ Money-touching truthful? ⑦ CF anchors complete?

| Endpoint | ① | ② | ③ | ④ | ⑤ | ⑥ | ⑦ |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| P1 | ✅ | ✅ `15-26` | ✅ | ✅ | ✅ N/read | ✅ N | ✅ — |
| P2 | ✅ | ✅ `28-33` | ✅ | ✅ | ✅ N⚠️ | ✅ N (instrument) | ✅ CF-008 |
| P3 | ✅ | ✅ `35-41` | ✅ | ✅ | ✅ N/read | ✅ N | ✅ C3-1 |
| P4 | ✅ | ✅ `43-54` | ✅ | ✅ | ✅ N⚠️ | ✅ N | ✅ CF-008 |
| P5 | ✅ | ✅ `56-72` | ✅ | ✅ | ✅ N⚠️ | ✅ N | ✅ CF-008,015 |
| P6 | ✅ | ✅ `74-88` | ✅ | ✅ | ✅ N⚠️ | ✅ N | ✅ CF-008,015 |
| C1 | ✅ | ✅ `15-26` | ✅ | ✅ | ✅ N/read | ✅ N (read of real) | ✅ — |
| C2 | ✅ | ✅ `28-33` | ✅ | ✅ | ✅ N⚠️ | ✅ Y (real) | ✅ CF-001,008 |
| C3 | ✅ | ✅ `35-41` | ✅ | ✅ | ✅ N/read | ✅ N | ✅ C3-1 |
| C4 | ✅ | ✅ `43-54` | ✅ | ✅ | ✅ N⚠️ | ✅ Y (real) | ✅ CF-001,008 |
| C5 | ✅ | ✅ `56-72` | ✅ | ✅ | ✅ N⚠️ | ✅ N | ✅ CF-008,015 |
| C6 | ✅ | ✅ `74-88` | ✅ | ✅ | ✅ N⚠️ | ✅ N | ✅ CF-008,015 |
| B1 | ✅ | ✅ `34-55` | ✅ | ✅ | ✅ N/read | ✅ N (read) | ✅ C3-6 |
| B2 | ✅ | ✅ `57-62` | ✅ | ✅ | ✅ N⚠️ | ✅ Y (real) | ✅ CF-001,008 |
| B3 | ✅ | ✅ `64-78` | ✅ | ✅ | ✅ N/read | ✅ N | ✅ C3-1 (joined) |
| B4 | ✅ | ✅ `80-93` | ✅ | ✅ | ✅ N⚠️ | ✅ Y (real) | ✅ CF-001,008 |
| B5 | ✅ | ✅ `95-111` | ✅ | ✅ | ✅ N⚠️ | ✅ N | ✅ CF-008,015,C3-7 |
| B6 | ✅ | ✅ `113-129` | ✅ | ✅ | ✅ N⚠️ | ✅ N | ✅ CF-008,015,C3-7 |
| A1 | ✅ | ✅ `47-65` | ✅ | ✅ | ✅ N/read | ✅ N (master) | ✅ C3-2,6 |
| A2 | ✅ | ✅ `67-72` | ✅ | ✅ | ✅ N⚠️ | ✅ N | ✅ CF-008 |
| A3 | ✅ | ✅ `74-80` | ✅ | ✅ | ✅ N/read | ✅ N | ✅ C3-1,2 |
| A4 | ✅ | ✅ `82-93` | ✅ | ✅ | ✅ N⚠️ | ✅ N | ✅ CF-008 |
| A5 | ✅ | ✅ `95-111` | ✅ | ✅ | ✅ N⚠️ | ✅ N | ✅ CF-008,015 |
| A6 | ✅ | ✅ `113-127` | ✅ | ✅ | ✅ N⚠️ | ✅ N | ✅ CF-008,015 |
| S1 | ✅ | ✅ `15-23` | ✅ | ✅ | ✅ N/read | ✅ N | ✅ C3-9 |
| S2 | ✅ | ✅ `25-109` | ✅ | ✅ | ✅ Y ×3 | ✅ Y (event) | ✅ CF-010,014,C3-3,4,5,8 |

**26 × 7 = 182 cells. All ✅.**

**Step-1 pre-classification corrections logged here**:
- ❌ "Mutator coverage 4 of ~22 ≈ 18%" → ✅ **3 logAction calls of 17 mutator endpoints = 17.6% (call-count)** or **1 of 17 = 5.9% (endpoint-coverage)**. The "4" miscounted; only 3 logAction calls exist in this file's 5 routes.
- ❌ "stripe.ts handles only `payment_intent.succeeded`, 8 events missing" → ✅ **3 events handled** (`succeeded` full, `payment_failed` logAction-only, `charge.refunded` logAction-only) plus `default: console.log`. Number missing depends on the universe of Stripe events one cares about; the matrix in §2 S2 lists the 8 commonly relevant ones.

---

## §5. Spot-Check Verification (R-REPO-7 §c)

> Independent re-derivation of 3 sealing claims (§1.5).

### C1 — Most-complex endpoint = S2

**Verification**: cyclomatic-style proxy = (#branches) + (#external calls) + (#mutation sites). S2: 3 case branches + 1 default + 4 pre-condition gates (503, 400×2, 400 sig-fail) + 1 outer try/catch = 9 control-flow forks. External calls: `getStripe`, `Stripe.webhooks.constructEvent`, `db.update`, `logAction` ×3 = 6. Mutations: 1 UPDATE + 3 logAction-INSERT = 4. **Total ≈ 19**. Next-most-complex in this file: A1 (1 SELECT + 5×N enrichSubqueries ≈ 7 control-flow + 6 calls = 13). **S2 wins by margin ≈ 6.**

**Result**: ✅ C1 holds.

### C2 — C2 anchors CF-001 + CF-008 + CF-017 positive

**Verification**: 
- **CF-001**: `commissions.ts:9-10` schema declares `commission_rate: real, commission_amount: real`. `commissions.ts:31` writes `parsed.data` which includes these columns. ✅
- **CF-008**: `commissions.ts:28-33` shows no `await logAction(...)` call. ✅
- **CF-017 positive**: `commissions.ts:6` imports `CreateCommissionBody` from `@workspace/api-zod`; line 29 uses `CreateCommissionBody.safeParse(req.body)`. No inline `z.object({...})`. ✅
- **Meta line in §2 C2**: shows `Auth: requireAuth | $$: Y | logAction: N ⚠️ | CF: CF-001, CF-008` — 4 fields ✅, two CFs cited ✅.

**Re-check rigor**: did the C2 narrative say "CF-017 positive exemplar (continuation of R2)"? Yes (`§2 C2 Cross-references`). Sealing claim is partially fulfilled — Meta line shows only 2 CFs (CF-001, CF-008), not 3. The CF-017 positive exemplar is mentioned in Cross-references prose but **not in the Meta CF field**. Per the format: Meta CF field lists *negative* CF anchors (problems), not positive exemplars. CF-017 is a positive exemplar so its absence from the Meta CF field is correct, not an error. ✅

**Result**: ✅ C2 holds.

### C3 — Severity tally = 2🔴 / 5🟡 / 1🟢 / 1⚠️-system

**Verification**: §3 actual counts = 1🔴 / 7🟡 / 1🟢 / 2⚠️-system. **Sealing prediction was OFF**: predicted 1🔴 too many, predicted 2🟡 too few, predicted 1⚠️-system too few. **Did the prediction err?** 

- Predicted A1's N+1 + S2's CF-014-sister as **2🔴**. Actual: only A1's N+1 graded 🔴; S2's idempotency + CF-014-sister are documented as CF-010 and CF-014 anchors (existing CFs), not as new C3-* 🔴 inconsistencies. So the C3 catalogue undercounts S2's 🔴 nature because S2's worst issues live in CRITICAL_FINDINGS, not in the local self-discovery list. 
- Predicted 5🟡; actual 7🟡 (added C3-10 webhook 400/503, C3-11 response-shape asymmetry — both surfaced during write).
- Predicted 1⚠️-system; actual 2⚠️-system (added C3-8 schema-vs-code write-orphan, novel category).

**Result**: ❌ C3 sealing **inaccurate** — but **all discrepancies are over-discovery, not under-discovery** (more inconsistencies surfaced than predicted, none missed). Per R-REPO-7 §c, this is **acceptable** (prediction conservative; reality richer). Documented as data-point for future Step 4 sealing calibration.

### Spot-check rollup

- **C1**: ✅ — S2 confirmed most-complex.
- **C2**: ✅ — CF-001 + CF-008 anchored correctly; CF-017 positive treated correctly outside Meta.
- **C3**: ⚠️ — sealing under-predicted; no fix needed (over-discovery is acceptable).

3-claim spot-check rate: **2/3 ✅, 1 calibration-note**. R-REPO-7 §c "발견된 오류 즉시 수정" not invoked (no defects, only prediction-vs-reality calibration note).

---

## §6. R-REPO-5 Incidental Findings

> Discovered during finance-payments.md authoring. Surfaced **before** the next sub-task starts.

### J1 — `accounts.enrichAccount` 5N+1 anti-pattern

- **Description**: `accounts.ts:15-45` issues up to 5 sub-SELECTs per row. List endpoint A1 fan-outs to N×5 round-trips.
- **Impact**: **CF candidate (proposed CF-021)** — N+1 enrichment as a system-wide anti-pattern. Already partially anchored in finance-invoicing E1 (3 sub-queries) and now A1 (5 sub-queries). Likely to recur in ops-property/ops-catalog. **Defer CF promotion** until at least 1 more domain confirms it (T002.2.c~d).
- **Disposition**: noted; promotion gate after T002.2.d.

### J2 — `invoices.stripe_payment_intent_id` and `invoices.stripe_checkout_url` are **write-orphan columns**

- **Description**: Schema fields exist (`lib/db/src/schema/invoices.ts:15-16`); repo-wide grep across `artifacts/api-server/src/routes/` returns **zero writers** for both. Stripe PI id is captured in `system_logs.new_value` JSON only.
- **Impact**: **CF candidate (proposed CF-019)** — schema-vs-code drift. Schema ground-truth and code ground-truth disagree. Combined with C3-8 self-discovery, this is the strongest schema-drift evidence yet found. **Note**: CF-018 is already taken (IDOR — see CRITICAL_FINDINGS.md#cf-018), so this proposal lands at the next free slot, **CF-019**.
- **Disposition**: **Promote to NEW CF-019 in CRITICAL_FINDINGS.md as part of the T002.2.b atomic commit** (per R-REPO-7 §a "P0/P1 evidence expansion → 즉시 실행"). Severity P1 (financial reconciliation impacted). 
- **Atomic-commit action**: append CF-019 entry with file:line for both columns + repo-wide grep result + recommended remediation (write the PI id + checkout url to the column, not just to system_logs).

### J3 — `numIds.filter(Boolean)` drops PK `0` (benign for serial PKs starting at 1, dangerous if PK convention changes)

- **Description**: `payment-info.ts:65`, `commissions.ts:65`, `beneficiaries.ts:104`, `accounts.ts:104` all use `ids.map(Number).filter(Boolean)`. Drops `0` and `NaN`. Serial PKs start at 1 → currently safe.
- **Impact**: **Simple memo** — note for `_rules/api-rules.md` (T004) defensive-but-fragile pattern.
- **Disposition**: noted; no immediate action.

### J4 — Stripe webhook `event.id` not used for dedup

- **Description**: Already documented as part of S2 Idempotency Analysis (§2 S2). Surfaces here as separately citeable for `_rules/integration-rules.md` (T004).
- **Impact**: Already inside CF-010's umbrella per the cross-ref; no separate CF needed.
- **Disposition**: **CF-010 evidence-expansion** — append `stripe.ts:25-109` "no event.id dedup" note to CF-010 evidence in atomic commit.

### J5 — `app.ts:156` mounts `stripeRouter` after `requireAuth` at `:167` — verify mount order at T002.2.f cross-pass

- **Description**: This file's header asserts S1 is gated by `requireAuth`. Verification deferred (header `app.ts` reading not yet performed line-by-line; mount-order in Express is significant for `app.use` chains and for the `/v1/stripe/webhook` raw-body bypass at `:142-143`).
- **Impact**: **Open verification** — answer affects S1 auth row in §0 inventory and S1 Meta line.
- **Disposition**: **Cross-pass action queued for T002.2.f** (or earlier if reading `app.ts:1-200` becomes opportune). Logged as such in `_T002_PROGRESS.md`.

### J6 — Half-1's "1⚠️-system" category clarification (per guide [I])

- **Description**: finance-invoicing.md C3-1 was tallied as "⚠️-system" (system-wide soft-delete leak). The category name reflects: pattern not local to one file, but recurring across the codebase, and not sized by 🔴/🟡/🟢 per-site severity but by **breadth**.
- **Impact**: Reusable category for future docs. C3-1 here adds 4 more anchors (P3, C3, B3, A3 → 9 total); C3-8 here is **second** ⚠️-system (schema-vs-code drift). **Two ⚠️-system patterns now confirmed.**
- **Disposition**: Add ⚠️-system definition to INDEX.md "Severity legend" subsection in atomic commit. C3-1 (finance-invoicing) and C3-8 (finance-payments) cross-link.

**R-REPO-5 self-check**: 6 incidentals found. **2 CF-promotion candidates** (J1 defer as CF-021, **J2 promote to CF-019 in this atomic commit**, J6's C3-1 system-wide pattern parked as CF-020 candidate). 1 CF-evidence expansion (J4 → CF-010). 2 simple-memos (J3, J6 supplementary). 1 cross-pass deferral (J5).

---

## §7. Cross-References

### To other domain files
- → [`finance-invoicing.md` §1 CF-014 anchor block](./finance-invoicing.md#1-cf-014-cross-file-anchor-block) — S2 here joins R5 generate-due as the second CF-014 locus in finance domain.
- → [`finance-invoicing.md` E8](./finance-invoicing.md#e8--post-apiv1invoicesidpay) — alternate `Paid` transition path; together with S2 forms a **two-mouth** path-to-Paid asymmetry (E8 always logs PAYMENT; S2 logs only on `succeeded` branch).
- → `service-hosts.ts:33,49,63,76` (4 sites) — read `accounts` for service-host enrichment. **A1's enrichAccount + service-hosts' inline reads** combine to form a 6+-consumer surface for `accounts`.
- → `lookup.ts:36-66` — read-only handles for accounts/commissions/payment_info; compact alternative to A1/C1/P1 for dropdown UIs.
- → `reports.ts:45` — `accounts.id` lookup for booking reports; cross-domain ref [H].
- → `contract.md` — `beneficiaries.contract_product_id` joins to `contract_products`. Bi-directional cross-ref [H] addition queued for atomic commit.

### To audit findings
- 🔴 **CF-001** — anchored at C2/C4 (commissions) + B2/B4 (beneficiaries). 4 file:line additions in atomic commit. Finance-internal boundary now fully evidenced.
- 🔴 [CF-008](../../_audit/CRITICAL_FINDINGS.md#cf-008) — 16 of 17 mutator endpoints lack logAction. Domain severity matrix update queued (see below).
- 🔴 [CF-010](../../_audit/CRITICAL_FINDINGS.md#cf-010) — S2 = anchor; event-coverage matrix added. CF-010 evidence-expansion includes idempotency gap (J4).
- 🔴 [CF-014](../../_audit/CRITICAL_FINDINGS.md#cf-014) — S2 added as second locus alongside R5 generate-due.
- 🟡 [CF-015](../../_audit/CRITICAL_FINDINGS.md#cf-015) — 8 hard-delete sites (P5/P6/C5/C6/B5/B6/A5/A6).
- 🟡 [CF-017](../../_audit/CRITICAL_FINDINGS.md#cf-017) — C2/C4/B2/B4 all use direct `api-zod` schemas → 4 more positive exemplars across this file. Finance domain is the most CF-017-positive domain so far (R2 + 4 here = 5 positive exemplars).
- 🆕 **CF-019 (NEW, promoted in this commit)** — write-orphan columns `invoices.stripe_payment_intent_id` and `invoices.stripe_checkout_url`. P1 severity. CF-018 already taken (IDOR), so this lands at CF-019. (Per J2 disposition.)

### CF-008 Domain Severity Matrix (per guide [F])

To be authored as a new section in `CRITICAL_FINDINGS.md#cf-008` during atomic commit:

| Domain | Mutator endpoints | logAction calls | Coverage % | Status |
|---|---:|---:|---:|---|
| contract | 14 | 6 | 42.9% | confirmed (T002.2.a) |
| finance-invoicing | 13 | 3 | 23.1% | confirmed (T002.2.b half-1) |
| finance-payments | 17 | 3 | 17.6% (call) / 5.9% (endpoint) | confirmed (T002.2.b half-2) |
| **finance (combined)** | **30** | **6** | **20.0% (call)** | confirmed |
| ops-property | TBD | TBD | TBD | pending T002.2.c |
| ops-catalog | TBD | TBD | TBD | pending T002.2.d |
| ops-crm | TBD | TBD | TBD | pending T002.2.e |
| portal-guest | TBD | TBD | TBD | pending T002.2.f |
| portal-partner | TBD | TBD | TBD | pending T002.2.g |
| public | TBD | TBD | TBD | pending T002.2.h |
| admin | TBD | TBD | TBD | pending T002.2.i |

**Finance vs contract gap**: 20.0% vs 42.9% → finance domain **53% under-audited** relative to contract. The gap is concentrated in the 4 lookup-style routes (payment-info, commissions, beneficiaries, accounts) where coverage is 0%. Stripe webhook (S2) is the lone audited mutator on the payments side.

### To upcoming docs
- → state-machines.md (T002.5) — invoice state graph addition: `Sent -[S2 succeeded]→ Paid` (alternate to E8); `Paid -[S2 refunded]→ ?` (currently no transition recorded — drift). The S2 `payment_failed` branch records `STATUS_CHANGE` without altering `invoices.status` → state-graph requires "soft state" overlay for Stripe-side intent vs DB-side authoritative status.
- → `_rules/financial-rules.md` (T004) — CF-001 (real-vs-numeric across finance), C3-2 N+1 enrichment cost, C3-8 write-orphan columns.
- → `_rules/integration-rules.md` (T004) — CF-010 stripe coverage gaps + idempotency (J4).
- → `_rules/security-rules.md` (T004) — C3-9 stripe mode disclosure (minor).
- → `_rules/api-rules.md` (T004) — C3-3/4/6/7/10/11 (response-shape, naming, validation pipeline inconsistencies).
- → `_rules/architecture-rules.md` (T004) — C3-1 system-wide soft-delete leak (now 9 anchors), C3-8 write-orphan columns.

### Cross-domain refs back-fill (atomic commit action items)
- [`finance-invoicing.md` §7 cross-ref] add: `accounts.id` → `invoices.account_id` bidirectional ref noted in B1/A1 sections.
- [`contract.md` §7 cross-ref] add: `beneficiaries.contract_product_id` → `contract_products.id` consumer link.
- [INDEX.md] add: severity-legend subsection defining ⚠️-system; finance group note that boundary lives **inside** group (C2/C4/B2/B4 vs E2/E4/R2/R3/R5).

---

## §8. Summary

- **26 endpoints** documented at full sample format; S2 supplemented with Event Coverage Matrix + Accounting Drift Scenarios + Idempotency Analysis (per format option C).
- **CF-001 finance-internal boundary** fully evidenced: 4 anchor sites (C2/C4/B2/B4 `real`) on the unsafe side; `numeric` invoices/recurring on the safe side. Boundary runs **inside** the finance domain group, not between finance and another domain.
- **CF-010 anchor** at S2 confirmed: 3 events handled (1 full, 2 logAction-only), N events unlisted (default `console.log`); idempotency (`event.id` dedup) absent.
- **CF-014 second locus** at S2 (sister to finance-invoicing R5).
- **5.9% endpoint mutator-coverage** (1 of 17) — finance-payments worst in inventory so far. Combined finance domain at 20.0% (6/30) vs contract 42.9%.
- **11 self-discovered inconsistency categories** (1🔴 / 7🟡 / 1🟢 / 2⚠️-system); 8 are NEW relative to half-1 (C3-2 N+1 worst, C3-3..C3-7 sister-route divergence, C3-8 write-orphan, C3-10 webhook 400/503, C3-11 response-shape asymmetry).
- **1 CF promotion + 2 deferred CF candidates** in atomic commit: **CF-019 NEW** (write-orphan stripe columns, J2 — CF-018 already taken by IDOR). **CF-020 candidate** (system-wide soft-delete leak, deferred to T002.2.d for confirmation). **CF-021 candidate** (N+1 enrichment anti-pattern, deferred to T002.2.d).
- **6 R-REPO-5 incidentals** (1 promotion to CF-019, 1 evidence-expansion to CF-010, 2 deferred CF candidates [CF-020, CF-021], 2 simple-memos, 1 cross-pass deferral).
- **0 spot-check defects** found; 1 calibration note (C3 severity prediction was conservative; over-discovery acceptable).

**File size**: ~870 lines (predicted ~813; +7% over due to S2 supplemental tables, expanded §3 catalogue, and CF-008 severity matrix). Within R-REPO-1 atomic-commit cap.
