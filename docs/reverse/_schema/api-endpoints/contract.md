# Domain: contract

> **Files of origin**: `artifacts/api-server/src/routes/contracts.ts` (628 lines, 21 endpoints) · `artifacts/api-server/src/routes/contract-types.ts` (107 lines, 7 endpoints).
> **URL prefixes**: `/api/v1/contracts/...`, `/api/v1/contract-types/...`, `/api/v1/lookup/contracts`.
> **Auth guard (all 28)**: `requireAuth` (admin/staff guard mounted at `app.ts:167`). Two endpoints additionally gate `permanent=true` HARD DELETE behind `req.user.role === "SuperAdmin"` (see C3 below).
> **Risk**: 🔴 P0. Triggering findings: [CF-001](../../_audit/CRITICAL_FINDINGS.md#cf-001) (`contracts.weekly_rate / total_rent / bond_amount / advance_amount` are all `real`), [CF-002](../../_audit/CRITICAL_FINDINGS.md#cf-002) (this domain is the **receiving side** of the booking→contract precision-loss write), [CF-003](../../_audit/CRITICAL_FINDINGS.md#cf-003) (zero `references()` FK, every join is application-level), [CF-008](../../_audit/CRITICAL_FINDINGS.md#cf-008) (8 of 28 mutators emit no `logAction`), [CF-014](../../_audit/CRITICAL_FINDINGS.md#cf-014) (`activate` handler + its `generateContractInvoicesAndSchedules` helper run 5+ writes outside any `db.transaction`), [CF-015](../../_audit/CRITICAL_FINDINGS.md#cf-015) (4 endpoints hard-delete via `permanent=true` flag despite `deleted_at` columns), [CF-016](../../_audit/CRITICAL_FINDINGS.md#cf-016) (`contract_products` lives in mis-named `products.ts` schema file).
> **Cross-domain effects**: this file is the **target** of `booking.md` S2 (`PATCH /v1/bookings/:id/confirm` auto-creates a `contracts` row + N `contract_line_items` rows, see S2 cross-ref). The `activate` handler in turn auto-generates `invoices` rows and `recurring_schedules` rows, so it is the primary upstream of the **finance group** — see [`finance-invoicing.md`](./finance-invoicing.md) (R5 generate-due loop is the CF-014 sister site to this file's `generateContractInvoicesAndSchedules` helper at L55-237).
> **Status**: ✅ **COMPLETE — 28 of 28 endpoints documented.**

---

## ⚓ T002.2.a Anchor Block (sealed before writing — verified at file end)

> Per protocol, the 3 spot-check claims below are pre-selected and verified in the **Spot-check Log** at the end of the file. They are intentionally chosen from the highest-uncertainty parts of the catalogue, not the most-confident.

| # | Claim | Endpoint | Verification target |
|---|---|---|---|
| **C1** | The most complex handler's `file:line` and helper chain are accurate. | E9 `POST /v1/contracts/:id/activate` | 4 direct DB writes + helper `generateContractInvoicesAndSchedules` (5+ writes internal) + `enrichContracts` post-process |
| **C2** | All endpoints carrying CF-002 or CF-014 anchor have a correct 4-field Meta header (`Auth | $$ | logAction | CF`). | E2 `POST`, E4 `PUT`, E9 `POST :id/activate` | each Meta line literal-checked against the source |
| **C3** | Self-discovered inconsistency surfaced (or "none, n=28" stated). | (whole file) | 4 candidate categories pre-listed: deleted_at filter omission · logAction omission · hard-delete flag · Zod absence |

**R-REPO-5 pre-warning (escalation candidates expected during writing):**

- `contracts.ts:92-94` carries the `parseFloat((weeklyRate * (52 / 12)).toFixed(2))` formula. This is the same pattern that `bookings.ts:485` already cites against [CF-006](../../_audit/CRITICAL_FINDINGS.md#cf-006). If confirmed, this is **CF-006 evidence expansion** (extra cite-line, no severity change) → mini-task proposal.
- The `generateContractInvoicesAndSchedules` helper (`contracts.ts:55-237`) executes ≥5 mutations in a loop with no `db.transaction` wrapper. CF-014's current evidence cites only `contracts.ts:429` (the entry handler). The helper's interior is a **deeper, larger** instance of the same anti-pattern → potential CF-014 evidence expansion mini-task.

---

## 📑 Section A — `contracts.ts` (21 endpoints)

---

### E1 — GET `/api/v1/contracts`

**Meta**: `Auth: requireAuth | $$: N | logAction: N (read) | CF: CF-003`

| Field | Value |
|---|---|
| **Source** | `contracts.ts:297-311` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ read-only |
| **Side effects** | None (1 SELECT against `contracts` + N enrichment SELECTs in `enrichContracts`, `contracts.ts:249-295`) |
| **logAction** | ❌ n/a (read) |
| **Idempotent** | ✅ |

### Request
**Query**: `q` (free-text on `contract_ref`), `status`, `tenant_account_id`, `space_id`, `booking_id`, `account_id` (alias of `tenant_account_id`). All optional, no Zod schema.
**Body**: (none)

### Response (success)
Array of contract rows enriched by `enrichContracts` — each row gains `tenant_name`, `landlord_name`, `space_name`, `product_name`, `contract_product_name`, `booking_ref` (`contracts.ts:285-294`).

### Logic summary
1. Always filters `isNull(contractsTable.deleted_at)` (`contracts.ts:299`) — soft-deleted excluded.
2. Conditionally `eq` filters on the 5 query params; `q` uses `ilike(contract_ref, "%q%")`.
3. After fetch, calls `enrichContracts(rows)` which performs **5 separate batched SELECTs** (accounts, spaces, contract_products, accommodation_catalog, bookings) using `inArray` on de-duplicated id sets (`contracts.ts:264-283`).

### Cross-references
- 🔴 [CF-003](../../_audit/CRITICAL_FINDINGS.md#cf-003) — the 5-fan-out enrichment in `enrichContracts` is the canonical "no DB FK ⇒ application-level join" footprint for this domain. Same structural pattern as `buildBookingResponse` (`bookings.ts:35-58`).
- → `db-schema-overview.md` (T002.3) for the `contracts` column list.

---

### E2 — POST `/api/v1/contracts`

**Meta**: `Auth: requireAuth | $$: Y | logAction: N ⚠️ | CF: CF-001, CF-002, CF-008, CF-011`

| Field | Value |
|---|---|
| **Source** | `contracts.ts:313-338` |
| **Status** | ACTIVE |
| **Money-touching** | ✅ writes 4 `real`-typed money columns: `weekly_rate` (`contracts.ts:326`), `total_rent` (`:327`), `bond_amount` (`:328`), `advance_amount` (`:329`). **CF-002 receiving side** — when invoked from `bookings.ts:449-465`, the values arrive as floats already cast from `numeric` strings. When invoked directly via this endpoint, the body fields are stored as-is with no validation. |
| **Side effects** | (1) `nextContractRef()` SELECTs the entire `contracts` table filtered by `MS-C-<year>-%` and uses `rows.length + 1` as the new sequence number (`contracts.ts:241-247`) — **CF-011 race**. (2) Single `db.insert(contractsTable).returning()`. (3) `enrichContracts([row])` for response shaping. |
| **logAction** | ❌ ⚠️ **Missing — CF-008 footprint.** A new contract row is created with `status = "Draft"` and the only audit trail is `created_at`. |
| **Idempotent** | ❌ — every POST mints a new `contract_ref` and inserts. No client-supplied idempotency key. |

### Request
**Body** (no Zod schema — fields read directly from `req.body`):
```ts
{
  booking_id?: number,
  product_id?: number,                  // accommodation_catalog FK (no DB-level FK — CF-003)
  contract_product_id?: number,         // legacy contract_products FK
  tenant_account_id?: number,
  landlord_account_id?: number,
  space_id?: number,
  start_date?: string,                  // YYYY-MM-DD
  end_date?: string,
  weekly_rate?: number | string,        // stored as `real` (CF-001)
  total_rent?: number | string,
  bond_amount?: number | string,
  advance_amount?: number | string,
  currency?: string,                    // defaults to "AUD"
  document_url?: string,
  terms_text?: string,
  notes?: string,
}
```

### Response (success)
HTTP `201` + the inserted row enriched by `enrichContracts`. `status` is forced to `"Draft"` regardless of body (`contracts.ts:331`).

### Response (error)
None explicit — any DB error becomes an unhandled rejection (no try/catch). ⚠️ This contrasts with `contract-types.ts` which wraps every handler in try/catch (T3-T7).

### Logic summary
1. `nextContractRef()` SELECTs all `contracts` rows where `contract_ref ilike "MS-C-<year>-%"`, then returns `MS-C-<year>-<count+1>` zero-padded to 5 digits (`contracts.ts:241-247`). **Two concurrent POSTs in the same year will produce identical refs — CF-011 anchor.**
2. Inserts the row with all 17 columns from body (with null fallbacks) plus the freshly minted `contract_ref` and forced `status = "Draft"`.
3. Calls `enrichContracts([row])` and responds with the enriched single row.

### Cross-references
- 🔴 [CF-001](../../_audit/CRITICAL_FINDINGS.md#cf-001) — all 4 money columns are `real`.
- 🔴 [CF-002](../../_audit/CRITICAL_FINDINGS.md#cf-002) — receiving side of the booking→contract precision-loss write. The booking-side write is at `bookings.ts:449-465`; this endpoint is the direct-API equivalent.
- 🟡 [CF-008](../../_audit/CRITICAL_FINDINGS.md#cf-008) — no `logAction` despite creating a financially significant row.
- 🟢 [CF-011](../../_audit/CRITICAL_FINDINGS.md#cf-011) — `nextContractRef()` row-count race.
- → `MONEY_AUDIT.md` §1.1 (real-typed money columns) and §2.1 (numeric→real coercion sites).
- ← `bookings.md` S2 (`PATCH /v1/bookings/:id/confirm`) — alternate entry point that creates the same row with derived money values.

---

### E3 — GET `/api/v1/contracts/:id`

**Meta**: `Auth: requireAuth | $$: N | logAction: N (read) | CF: —`

| Field | Value |
|---|---|
| **Source** | `contracts.ts:340-346` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ read-only |
| **Side effects** | 1 SELECT + N enrichment SELECTs (via `enrichContracts`). |
| **logAction** | ❌ n/a |
| **Idempotent** | ✅ |

### Request
**Path**: `:id` cast via `Number(req.params.id)` — **no Zod schema** (cf. `bookings.ts:284` which uses `GetBookingParams`).
**Query/Body**: (none)

### Response (success)
Single enriched contract row.

### Response (error)
- `404` `{ error: "NOT_FOUND" }` (`contracts.ts:343`)

### Logic summary
1. `db.select().from(contractsTable).where(eq(contractsTable.id, id))` — **note: no `isNull(deleted_at)` filter**. Soft-deleted contracts ARE returned by this endpoint, in contrast to E1 (list) which filters them out. ⚠️ Same behaviour as `bookings.ts:283-289` per S1.
2. `enrichContracts([row])` and respond.

### Cross-references
- ⚠️ Cross-handler inconsistency: list (E1) excludes soft-deleted; single-read (E3) returns them. This pattern recurs across the codebase — see C3 self-discovered inconsistencies.

---

### E4 — PUT `/api/v1/contracts/:id`

**Meta**: `Auth: requireAuth | $$: Y | logAction: N ⚠️ | CF: CF-001, CF-002, CF-008`

| Field | Value |
|---|---|
| **Source** | `contracts.ts:348-372` |
| **Status** | ACTIVE |
| **Money-touching** | ✅ rewrites the same 4 `real` money columns as E2: `weekly_rate` (`:360`), `total_rent` (`:361`), `bond_amount` (`:362`), `advance_amount` (`:363`). |
| **Side effects** | Single `UPDATE` + post-update enrichment SELECTs. |
| **logAction** | ❌ ⚠️ **Missing — CF-008 footprint.** Money values can be edited with no audit trail. |
| **Idempotent** | ✅ (write semantically replaces) — but a partial update is impossible because every nullable field defaults to `null` if absent from body (`?? null` on `:352-367`). Sending only `{ "notes": "x" }` will null out every other column. |

### Request
**Body**: identical 17-column shape as E2, except `contract_ref` is not modifiable here. `status` and `created_at` are also not in the update set.

### Response (success)
The updated row, enriched.

### Response (error)
- `404` `{ error: "NOT_FOUND" }` (`contracts.ts:369`)

### Logic summary
1. UPDATE all 17 columns to body values (or `null`).
2. Enrich and return.

⚠️ **Behavioural caveat**: this is a **destructive** PUT — sending a partial body silently nulls absent fields because the handler does not gate `set({...})` by `key in body`. Distinct from E14 / E19 which use spread guards.

### Cross-references
- 🔴 [CF-001](../../_audit/CRITICAL_FINDINGS.md#cf-001), [CF-002](../../_audit/CRITICAL_FINDINGS.md#cf-002), 🟡 [CF-008](../../_audit/CRITICAL_FINDINGS.md#cf-008).

---

### E5 — POST `/api/v1/contracts/bulk-delete`

**Meta**: `Auth: requireAuth + role="SuperAdmin" gate | $$: N | logAction: N ⚠️ | CF: CF-008, CF-015`

| Field | Value |
|---|---|
| **Source** | `contracts.ts:374-390` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | Either `db.update(...).set({ deleted_at, status: "Archived" })` (default, soft) or `db.delete(...)` (when `body.permanent === true`, hard — irreversible). Operates on `inArray(id, numIds)`. |
| **logAction** | ❌ ⚠️ **Missing — CF-008.** Bulk hard-deletes leave no audit trail. |
| **Idempotent** | ✅ for soft path; ✅ for hard path (no-op on second call). |

### Request
**Body**: `{ ids: number[], permanent?: boolean }`. No Zod; manual checks: `Array.isArray(ids)` and length>0 (`:380-382`).

### Response
- `200` `{ success: true, affected: <count> }` regardless of soft/hard branch.
- `403` `{ error: "Only SuperAdmin can perform bulk delete" }` if role check fails (`:376-378`).
- `400` `{ error: "ids must be a non-empty array" }` (`:380-382`).

### Cross-references
- 🟡 [CF-008](../../_audit/CRITICAL_FINDINGS.md#cf-008), [CF-015](../../_audit/CRITICAL_FINDINGS.md#cf-015) — hard-delete branch (`permanent=true`) is one of the **4 contract-domain hard-delete flags** documented in C3 below. Each fully erases an entity that has a `deleted_at` column intended for soft-delete.

---

### E6 — DELETE `/api/v1/contracts/:id`

**Meta**: `Auth: requireAuth + role gate on permanent=true | $$: N | logAction: N ⚠️ | CF: CF-008, CF-015`

| Field | Value |
|---|---|
| **Source** | `contracts.ts:392-405` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | Soft-delete (`deleted_at = now, status = "Archived"`) by default; hard `db.delete(...)` if `req.query.permanent === "true"` AND user is SuperAdmin. |
| **logAction** | ❌ ⚠️ **Missing — CF-008.** |
| **Idempotent** | ✅ |

### Request
**Query**: `permanent=true` triggers hard delete. Anything else → soft.

### Response
- `204` empty (`contracts.ts:404`)
- `403` if hard requested by non-SuperAdmin (`:397-399`).

### Cross-references
- 🟡 [CF-008](../../_audit/CRITICAL_FINDINGS.md#cf-008), [CF-015](../../_audit/CRITICAL_FINDINGS.md#cf-015) — second of the 4 hard-delete flags in this domain.

---

### E7 — POST `/api/v1/contracts/:id/send`

**Meta**: `Auth: requireAuth | $$: N | logAction: Y (1) | CF: —`

| Field | Value |
|---|---|
| **Source** | `contracts.ts:407-416` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ (status + sent_at only) |
| **Side effects** | UPDATE `status="Sent", sent_at=now()` + 1 logAction (`STATUS_CHANGE`). |
| **logAction** | ✅ at `contracts.ts:413` (action `STATUS_CHANGE`, newValue `{status:"Sent"}`). |
| **Idempotent** | ✅ (subsequent calls re-stamp `sent_at`). |

### Request
**Body**: (none)

### Response
- `200` enriched updated row.
- `404` `{ error: "NOT_FOUND" }`.

### Logic summary
State transition `Draft → Sent`. No precondition guard — calling on `Active`/`Terminated`/`Expired` will silently flip status backward. ⚠️ Worth noting against the formal state machine (T002.5).

### Cross-references
- → `state-machines.md` (T002.5) for the contract-status transition catalogue.

---

### E8 — POST `/api/v1/contracts/:id/sign`

**Meta**: `Auth: requireAuth | $$: N | logAction: Y (1) | CF: —`

| Field | Value |
|---|---|
| **Source** | `contracts.ts:418-428` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | UPDATE `status="Signed", signed_at=now(), document_url=body.document_url ?? null` + 1 logAction. |
| **logAction** | ✅ `contracts.ts:425`. |
| **Idempotent** | ✅ (re-sign overwrites timestamps + url). |

### Request
**Body**: `{ document_url?: string }` — optional URL of the signed PDF.

### Response
- `200` enriched updated row.
- `404` `{ error: "NOT_FOUND" }`.

### Logic summary
State transition `Sent → Signed`. Same lack of precondition as E7. ⚠️ The endpoint allows `document_url` to be `null`-ed by sending an empty body — this likely wipes a previously-signed contract's URL. No guard.

---

### E9 — POST `/api/v1/contracts/:id/activate` ⚠️ HOTSPOT

**Meta**: `Auth: requireAuth | $$: Y (downstream) | logAction: Y (1) | CF: CF-001, CF-002, CF-008, CF-014, CF-015`

| Field | Value |
|---|---|
| **Source** | `contracts.ts:430-453` (handler), helper `generateContractInvoicesAndSchedules` at `:55-237` (183 lines), helper `enrichContracts` at `:249-295`. |
| **Status** | ACTIVE |
| **Money-touching** | ✅ **indirectly massive**: the helper inserts N `invoices` (with `numeric` amount) and N `recurring_schedules` (with `numeric` amount) using `weekly_rate` (read from the contract — `real`) as the source of truth. The `parseFloat(contract.weekly_rate ?? "0")` at `:62` is a `real → number` cast — already at this point precision is at-most ~7 significant digits. |
| **Side effects** | (1) UPDATE `contracts SET status="Active", effective_date=today` (`:432-434`). (2) `generateContractInvoicesAndSchedules(id)` (`:438`) — see decomposition below. (3) Conditionally UPDATE `bookings SET booking_status="Active"` if `row.booking_id` (`:441-445`). (4) 1 logAction (`:447-450`). (5) `enrichContracts([row])` for response. **All run sequentially with no `db.transaction(...)` wrapper. CF-014 anchor.** |
| **logAction** | ✅ 1 call at `:447`, recording `{status:"Active", invoices_generated, schedules_generated}`. **The booking-status mutation on `:442-444` is not separately audited** — a hidden side-effect on a different domain. ⚠️ |
| **Idempotent** | ❌ — running twice will: (a) re-stamp `effective_date`, (b) the helper deletes all unpaid existing invoices/schedules (`contracts.ts:117, 121-123`) and re-creates them, (c) the booking-status update runs again. The second call's `_generated` counts will reflect the re-creation, not the cumulative state. |

### Helper decomposition — `generateContractInvoicesAndSchedules` (`contracts.ts:55-237`)

Per loop iteration over `contractLineItemsTable` rows (active only):

| Step | DB op | File:line | Notes |
|---|---|---|---|
| 1 | SELECT contract row | `:56` | Read parent contract for `weekly_rate`, `currency`, `start/end_date`, `space_id`, `booking_id`, `tenant_account_id`. |
| 2 | (cond.) SELECT space → SELECT property | `:67-72` | For `locationLabel` denormalisation in invoice description. |
| 3 | SELECT `contract_line_items` (active) | `:78-79` | Source of truth for billing. |
| 4 | (fallback) SELECT `accommodation_catalog` OR `contract_products` | `:86-91` | Used to choose `billing_frequency` when no line items exist. |
| 5 | (fallback) INSERT `contract_line_items` (1 virtual Rent line) | `:100-112` | Computed `rentAmount` uses **`weeklyRate * (52/12)` for monthly billing** (`:94`). **🔍 Same formula as `bookings.ts:485` — CF-006 evidence expansion candidate.** |
| 6 | DELETE `recurring_schedules` (all for this contract) | `:117` | Wipe before regenerating. |
| 7 | SELECT `invoices` (this contract) | `:118-119` | To distinguish Paid (kept) from non-Paid (re-deleted). |
| 8 | DELETE `invoices` (each unpaid) | `:121-123` | N deletes in a loop. |
| 9 | (per recurring line, per period) INSERT `invoices` | `:162-172` | Inside a `while` loop bounded by `safety < 500` and `current < end_date`. **`amount` written as JS `number` into a `numeric` column** — driver should serialize but worth verifying in T002.3. |
| 10 | (per recurring line, per period) INSERT `recurring_schedules` | `:176-189` | Same loop. |
| 11 | (per one-time line) INSERT `invoices` + `recurring_schedules` | `:203-232` | Single iteration each. |

**Mutation count for a typical 12-month contract with 1 Rent line**: 1 contract UPDATE + 1 line-items INSERT (fallback) + 1 schedule DELETE + N invoice DELETEs + 12 invoice INSERTs + 12 schedule INSERTs + 1 booking UPDATE = **27+ mutations** in one HTTP call, no transaction.

### Request
**Body**: (none)

### Response (success)
```ts
{
  ...enrichedContract,
  _generated: { invoices: <count>, schedules: <count> }
}
```

### Response (error)
- `404` `{ error: "NOT_FOUND" }` if contract id absent (`:435`). **Note: if contract found but `start_date`/`end_date` absent, helper silently returns `{0,0}` (`:57`) and the response is "success" with 0 generated. ⚠️**

### Cross-references
- 🔴 [CF-001](../../_audit/CRITICAL_FINDINGS.md#cf-001) — `weekly_rate` source is `real`.
- 🔴 [CF-002](../../_audit/CRITICAL_FINDINGS.md#cf-002) — `parseFloat(contract.weekly_rate)` at `:62` is the precision-loss site for downstream invoice/schedule amounts.
- 🟡 [CF-008](../../_audit/CRITICAL_FINDINGS.md#cf-008) — booking-status side-effect at `:442-444` not audited.
- 🟡 [CF-014](../../_audit/CRITICAL_FINDINGS.md#cf-014) — **canonical anchor**, current evidence in CF-014 cites this `:429` entry only; the helper interior multiplies the violation. *Evidence-expansion candidate (R-REPO-5).*
- 🟡 [CF-015](../../_audit/CRITICAL_FINDINGS.md#cf-015) — `:117` `db.delete(recurring_schedules)` and `:121-123` `db.delete(invoices)` are HARD deletes against tables that have `deleted_at` columns. Same anti-pattern as the bulk-delete flag.
- → `MONEY_AUDIT.md` §3 (cross-table money flow), §5 TC-M02 (line-items rollup invariant — this helper is the producer side).
- → `bookings.md` S2 — sets `booking_status="Confirmed"`; this handler later flips it to `"Active"`.
- → [`finance-invoicing.md`](./finance-invoicing.md) — invoices/recurring_schedules are this domain's primary writers; sister CF-014 anchor at R5 generate-due.

---

### E10 — POST `/api/v1/contracts/:id/terminate`

**Meta**: `Auth: requireAuth | $$: N | logAction: Y (1) | CF: —`

| Field | Value |
|---|---|
| **Source** | `contracts.ts:455-465` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ (status + reason only — does NOT cancel future invoices ⚠️) |
| **Side effects** | UPDATE `status="Terminated", termination_reason=body.termination_reason` + 1 logAction. |
| **logAction** | ✅ at `:462`. |
| **Idempotent** | ✅ |

### Request
**Body**: `{ termination_reason: string }` — destructured directly, no validation; will be `undefined` if absent → DB stores literal `undefined` as null.

### Response
- `200` enriched row.
- `404`.

### Cross-references
- ⚠️ **Cross-handler inconsistency**: terminating a contract does NOT cancel/void downstream invoices nor deactivate `recurring_schedules`. The user must hit [`finance-invoicing.md`](./finance-invoicing.md) endpoints separately (E9 void, R4 deactivate). To be cross-referenced from `state-machines.md` (T002.5) once written.

---

### E11 — POST `/api/v1/contracts/:id/expire`

**Meta**: `Auth: requireAuth | $$: N | logAction: Y (1) | CF: —`

| Field | Value |
|---|---|
| **Source** | `contracts.ts:467-476` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ (status + expiry_date only) |
| **Side effects** | UPDATE `status="Expired", expiry_date=today` + 1 logAction. |
| **logAction** | ✅ at `:473`. |
| **Idempotent** | ✅ |

### Request
**Body**: (none)

### Response
- `200` enriched row.
- `404`.

### Logic summary
State transition `Active → Expired`. Same lack of precondition as E7/E8/E10. The `expiry_date` field is overwritten with `now()` on every call, even if a future date was already set.

---

### E12 — GET `/api/v1/contracts/:id/payment-schedule`

**Meta**: `Auth: requireAuth | $$: N | logAction: N (read) | CF: —`

| Field | Value |
|---|---|
| **Source** | `contracts.ts:479-483` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ read-only (returns rows whose `amount` is `numeric`) |
| **Side effects** | 1 SELECT |
| **logAction** | ❌ n/a |
| **Idempotent** | ✅ |

### Request / Response
Returns `{ data: rows, meta: { total: rows.length } }` — all schedules with `contract_id == id` (no `is_active` or `deleted_at` filter).

---

### E13 — POST `/api/v1/contracts/:id/payment-schedule`

**Meta**: `Auth: requireAuth | $$: Y | logAction: Y (1) | CF: —`

| Field | Value |
|---|---|
| **Source** | `contracts.ts:486-507` |
| **Status** | ACTIVE |
| **Money-touching** | ✅ writes `recurring_schedules.amount` (`numeric`). |
| **Side effects** | (1) SELECT contract for booking_id/tenant fallback. (2) INSERT schedule. (3) logAction. |
| **logAction** | ✅ at `:505` (`SCHEDULE_ADD`). |
| **Idempotent** | ❌ — repeated POSTs create duplicates. |

### Request
**Body**: `{ schedule_type, frequency, amount, currency, start_date, end_date?, next_due_date?, is_active?, gst_included? }` — destructured, no Zod. `amount` cast via `String(amount ?? "0")`.

### Response
- `201` inserted row.
- `404` if contract id not found (`:489`).

---

### E14 — PATCH `/api/v1/contracts/:id/payment-schedule/:schedId`

**Meta**: `Auth: requireAuth | $$: Y | logAction: Y (1) | CF: —`

| Field | Value |
|---|---|
| **Source** | `contracts.ts:510-530` |
| **Status** | ACTIVE |
| **Money-touching** | ✅ if body contains `amount` (`numeric`). |
| **Side effects** | UPDATE schedule + logAction. |
| **logAction** | ✅ at `:528` (`SCHEDULE_UPDATE`). |
| **Idempotent** | ✅ (sparse update — guarded by `if (key !== undefined)` per field). |

### Request
**Body**: optional partial — `{ schedule_type?, frequency?, amount?, currency?, start_date?, end_date?, next_due_date?, is_active?, gst_included? }`.

### Response
- `200` updated row.
- `404` if `(schedId, contract_id)` pair not matched (`:527`).

---

### E15 — DELETE `/api/v1/contracts/:id/payment-schedule/:schedId`

**Meta**: `Auth: requireAuth | $$: N | logAction: Y (1) | CF: CF-015`

| Field | Value |
|---|---|
| **Source** | `contracts.ts:533-542` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | `db.delete(recurring_schedules).where(id == schedId AND contract_id == :id)` — **HARD DELETE.** + logAction. |
| **logAction** | ✅ at `:540` (`SCHEDULE_DELETE`). |
| **Idempotent** | ✅ |

### Cross-references
- 🟡 [CF-015](../../_audit/CRITICAL_FINDINGS.md#cf-015) — **third of the 4 hard-delete flags** in this domain. Schedules are removed permanently with no soft-delete column on the table; deletion of unpaid schedules during `activate` (E9) reuses the same call signature.

---

### E16 — GET `/api/v1/contracts/:id/services`

**Meta**: `Auth: requireAuth | $$: N | logAction: N (read) | CF: —`

| Field | Value |
|---|---|
| **Source** | `contracts.ts:545-552` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | (1) SELECT contract (`booking_id` only). (2) SELECT `booking_services` filtered by booking_id + `status = "Active"`. |
| **logAction** | ❌ n/a |
| **Idempotent** | ✅ |

### Logic summary
This is **a pass-through to the booking domain's services list**, not a contract-owned resource. If the contract has no `booking_id`, the response is `{data: [], meta: {total: 0}}`. Worth noting in the data model: `contract_services` does not exist as a table — services are only attached at the booking layer.

---

### E17 — GET `/api/v1/contracts/:id/line-items`

**Meta**: `Auth: requireAuth | $$: N | logAction: N (read) | CF: —`

| Field | Value |
|---|---|
| **Source** | `contracts.ts:556-562` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ read (returns `numeric` amounts) |
| **Side effects** | 1 SELECT filtered by `contract_id` and `status = "Active"`. |
| **logAction** | ❌ n/a |
| **Idempotent** | ✅ |

---

### E18 — POST `/api/v1/contracts/:id/line-items`

**Meta**: `Auth: requireAuth | $$: Y | logAction: N ⚠️ | CF: CF-008`

| Field | Value |
|---|---|
| **Source** | `contracts.ts:564-587` |
| **Status** | ACTIVE |
| **Money-touching** | ✅ writes `unit_price`, `quantity`, `total_price` to `contract_line_items` (`numeric`). |
| **Side effects** | INSERT line item. |
| **logAction** | ❌ ⚠️ **Missing — CF-008.** |
| **Idempotent** | ❌ |

### Request
**Body**: `{ item_type, name, billing_trigger?, billing_frequency?, unit_price?, quantity?, currency?, gst_included?, service_id?, notes? }`. Manual checks: `name && item_type` else 400 (`:567`).

### Response
- `200` inserted row (note: not `201` — minor inconsistency vs E2 / E13).
- `400` `{ success: false, error: { message: "name and item_type are required" } }`.

---

### E19 — PATCH `/api/v1/contracts/:id/line-items/:lineId`

**Meta**: `Auth: requireAuth | $$: Y | logAction: N ⚠️ | CF: CF-008`

| Field | Value |
|---|---|
| **Source** | `contracts.ts:589-608` |
| **Status** | ACTIVE |
| **Money-touching** | ✅ if `unit_price` in body — also recomputes `total_price = price × qty` (`:594`). |
| **Side effects** | UPDATE line item. |
| **logAction** | ❌ ⚠️ **Missing — CF-008.** |
| **Idempotent** | ✅ (sparse update via `...(field !== undefined && {field})` guards). |

⚠️ **Cross-handler inconsistency**: this PATCH does NOT verify that `lineId` actually belongs to `:id` — only `eq(contractLineItemsTable.id, lineId)` is in the WHERE clause (`:605`). A user with access to the route can PATCH any line item id regardless of contract ownership. Compare E14 (payment-schedule PATCH) which does check `(schedId AND contract_id)`. **Potential authorization gap — flagged in C3.**

---

### E20 — DELETE `/api/v1/contracts/:id/line-items/:lineId`

**Meta**: `Auth: requireAuth | $$: N | logAction: N ⚠️ | CF: CF-008`

| Field | Value |
|---|---|
| **Source** | `contracts.ts:610-614` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | UPDATE `status="Deleted", updated_at=now()` — **soft delete via status enum** (NOT a `deleted_at` column on this table). |
| **logAction** | ❌ ⚠️ |
| **Idempotent** | ✅ |

Note: this is the only domain mutation that is **soft by status enum rather than soft by `deleted_at` column**. Schema-level reconciliation pending T002.3. Same authorization gap as E19 — `lineId` not joined to `contract_id`.

---

### E21 — GET `/api/v1/lookup/contracts`

**Meta**: `Auth: requireAuth | $$: N | logAction: N (read) | CF: —`

| Field | Value |
|---|---|
| **Source** | `contracts.ts:616-625` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | 1 SELECT, `LIMIT 20`, ordered by `id` ASC. |
| **logAction** | ❌ n/a |
| **Idempotent** | ✅ |

### Logic
Typeahead helper. Returns `{id, display: "<contract_ref> (<status>)"}` for the first 20 matches (no offset/pagination). **Returns soft-deleted rows** — no `isNull(deleted_at)` filter (`:618-622`).

---

## 📑 Section B — `contract-types.ts` (7 endpoints)

> All 7 handlers wrap their bodies in `try/catch` and return `500 { error: "..." }` on any exception — **a noticeably different style** from `contracts.ts` (no try/catch anywhere). Worth noting for a future code-style consolidation.

### T1 — GET `/api/v1/contract-types`

**Meta**: `Auth: requireAuth | $$: N | logAction: N (read) | CF: —`

| Field | Value |
|---|---|
| **Source** | `contract-types.ts:7-25` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | 1 SELECT, filters: `isNull(deleted_at)` always; conditionally `is_active=true/false` and `ilike(name, "%q%")`. |
| **logAction** | ❌ n/a |
| **Idempotent** | ✅ |

### Response
`{ success: true, data: rows, meta: { total: rows.length } }` — note the `success` envelope, also distinct from `contracts.ts` E1 which returns a bare array.

---

### T2 — GET `/api/v1/contract-types/:id`

**Meta**: `Auth: requireAuth | $$: N | logAction: N (read) | CF: —`

| Field | Value |
|---|---|
| **Source** | `contract-types.ts:27-35` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | 1 SELECT — **no `isNull(deleted_at)` filter**. ⚠️ Same pattern as E3. |
| **logAction** | ❌ n/a |
| **Idempotent** | ✅ |

### Response
- `200` raw row.
- `404 { error: "Not found" }`.

---

### T3 — POST `/api/v1/contract-types`

**Meta**: `Auth: requireAuth | $$: N | logAction: N ⚠️ | CF: CF-008`

| Field | Value |
|---|---|
| **Source** | `contract-types.ts:37-49` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | INSERT row. |
| **logAction** | ❌ ⚠️ |
| **Idempotent** | ❌ |

### Request
**Body**: `{ name (required), description?, contract_security?, require_passport?, require_visa?, require_enrollment? }`. Manual check: `if (!name) → 400` (`:40`).

### Response
- `201` inserted row.
- `400 { error: "name is required" }`.
- `500 { error: "Failed to create contract type" }` on any DB error.

---

### T4 — PUT `/api/v1/contract-types/:id`

**Meta**: `Auth: requireAuth | $$: N | logAction: N ⚠️ | CF: CF-008`

| Field | Value |
|---|---|
| **Source** | `contract-types.ts:51-61` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | UPDATE — uses `{ id: _id, created_at, ...updates }` destructure to spread body (`:54`). Whitelist by exclusion only — any unknown body key is forwarded to the SET clause and may either succeed or be silently dropped by Drizzle. |
| **logAction** | ❌ ⚠️ |
| **Idempotent** | ✅ (true sparse update) |

### Response
- `200` updated row.
- `404`.

---

### T5 — PATCH `/api/v1/contract-types/:id/deactivate`

**Meta**: `Auth: requireAuth | $$: N | logAction: N ⚠️ | CF: CF-008`

| Field | Value |
|---|---|
| **Source** | `contract-types.ts:63-71` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | UPDATE `is_active=false`. There is **no symmetric `/activate` endpoint** — re-activation must go through T4 (PUT) by including `is_active: true` in the body. ⚠️ Asymmetric API. |
| **logAction** | ❌ ⚠️ |
| **Idempotent** | ✅ |

### Response
- `200` updated row.
- `404`.

---

### T6 — POST `/api/v1/contract-types/bulk-delete`

**Meta**: `Auth: requireAuth + role="SuperAdmin" gate | $$: N | logAction: N ⚠️ | CF: CF-008, CF-015`

| Field | Value |
|---|---|
| **Source** | `contract-types.ts:73-89` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | Soft (default) or hard (`permanent=true`) delete via `inArray(id, numIds)`. **Note: soft path sets `deleted_at` only** — does NOT also update `status` (in contrast to E5 which sets `deleted_at + status="Archived"`). Inconsistency. ⚠️ |
| **logAction** | ❌ ⚠️ |
| **Idempotent** | ✅ |

### Cross-references
- 🟡 [CF-015](../../_audit/CRITICAL_FINDINGS.md#cf-015) — **fourth of the 4 hard-delete flags**.

---

### T7 — DELETE `/api/v1/contract-types/:id`

**Meta**: `Auth: requireAuth + role gate on permanent=true | $$: N | logAction: N ⚠️ | CF: CF-008, CF-015`

| Field | Value |
|---|---|
| **Source** | `contract-types.ts:91-104` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ |
| **Side effects** | Hard if `query.permanent === "true"` AND SuperAdmin; soft via `deleted_at` only otherwise. |
| **logAction** | ❌ ⚠️ |
| **Idempotent** | ✅ |

### Response
- `204` on success.
- `403` if hard requested by non-SuperAdmin.

---

## ⚙️ 28-Endpoint Self-Check (T002.1 directive [C], booking.md format mirror)

7 dimensions × 28 rows. `✅` means the dimension is satisfied / cited; `❌` means absent (and intentionally so for read endpoints in audit/money columns); `⚠️` means present but with a flagged inconsistency.

| # | file:line | DB writes | logAction | money write | CF cross-ref | audit gap noted | Zod present |
|---|---|---|---|---|---|---|---|
| **E1** GET / | ✅ 297-311 | n/a (read) | ❌ n/a | ❌ | ✅ CF-003 | n/a | ❌ (no Zod) |
| **E2** POST / | ✅ 313-338 | ✅ contracts | ❌ ⚠️ | ✅ 4 cols | ✅ CF-001/002/008/011 | ✅ stated | ❌ |
| **E3** GET /:id | ✅ 340-346 | n/a | ❌ n/a | ❌ | ✅ deleted_at note | ⚠️ no soft-del filter | ❌ |
| **E4** PUT /:id | ✅ 348-372 | ✅ contracts | ❌ ⚠️ | ✅ 4 cols | ✅ CF-001/002/008 | ✅ stated | ❌ |
| **E5** POST /bulk-delete | ✅ 374-390 | ✅ contracts (hard or soft) | ❌ ⚠️ | ❌ | ✅ CF-008/015 | ✅ stated | ❌ |
| **E6** DELETE /:id | ✅ 392-405 | ✅ contracts (hard or soft) | ❌ ⚠️ | ❌ | ✅ CF-008/015 | ✅ stated | ❌ |
| **E7** POST /:id/send | ✅ 407-416 | ✅ contracts | ✅ 1 | ❌ | — (state) | n/a | ❌ |
| **E8** POST /:id/sign | ✅ 418-428 | ✅ contracts | ✅ 1 | ❌ | — (state) | n/a | ❌ |
| **E9** POST /:id/activate | ✅ 430-453 + helper 55-237 | ✅ contracts + bookings + N invoices + N schedules + (fb) line-items | ✅ 1 (booking side-effect not audited) | ✅ indirect (invoice/schedule amounts) | ✅ CF-001/002/008/014/015 | ✅ stated | ❌ |
| **E10** POST /:id/terminate | ✅ 455-465 | ✅ contracts | ✅ 1 | ❌ | ⚠️ no downstream cancel | n/a | ❌ |
| **E11** POST /:id/expire | ✅ 467-476 | ✅ contracts | ✅ 1 | ❌ | — (state) | n/a | ❌ |
| **E12** GET /:id/payment-schedule | ✅ 479-483 | n/a | ❌ n/a | ❌ | — | n/a | ❌ |
| **E13** POST /:id/payment-schedule | ✅ 486-507 | ✅ recurring_schedules | ✅ 1 | ✅ amount | — | n/a | ❌ |
| **E14** PATCH /:id/payment-schedule/:schedId | ✅ 510-530 | ✅ recurring_schedules | ✅ 1 | ✅ if amount in body | — | n/a | ❌ |
| **E15** DELETE /:id/payment-schedule/:schedId | ✅ 533-542 | ✅ recurring_schedules (HARD) | ✅ 1 | ❌ | ✅ CF-015 | ✅ stated | ❌ |
| **E16** GET /:id/services | ✅ 545-552 | n/a | ❌ n/a | ❌ | — | n/a | ❌ |
| **E17** GET /:id/line-items | ✅ 556-562 | n/a | ❌ n/a | ❌ | — | n/a | ❌ |
| **E18** POST /:id/line-items | ✅ 564-587 | ✅ contract_line_items | ❌ ⚠️ | ✅ 3 cols | ✅ CF-008 | ✅ stated | ❌ |
| **E19** PATCH /:id/line-items/:lineId | ✅ 589-608 | ✅ contract_line_items | ❌ ⚠️ | ✅ if unit_price | ✅ CF-008 + auth-gap note | ✅ stated | ❌ |
| **E20** DELETE /:id/line-items/:lineId | ✅ 610-614 | ✅ contract_line_items (status soft) | ❌ ⚠️ | ❌ | ✅ CF-008 + auth-gap | ✅ stated | ❌ |
| **E21** GET /lookup/contracts | ✅ 616-625 | n/a | ❌ n/a | ❌ | ⚠️ no soft-del filter | ✅ stated | ❌ |
| **T1** GET / | ✅ 7-25 | n/a | ❌ n/a | ❌ | — | n/a | ❌ |
| **T2** GET /:id | ✅ 27-35 | n/a | ❌ n/a | ❌ | ⚠️ no soft-del filter | ✅ stated | ❌ |
| **T3** POST / | ✅ 37-49 | ✅ contract_types | ❌ ⚠️ | ❌ | ✅ CF-008 | ✅ stated | ❌ |
| **T4** PUT /:id | ✅ 51-61 | ✅ contract_types | ❌ ⚠️ | ❌ | ✅ CF-008 + whitelist note | ✅ stated | ❌ |
| **T5** PATCH /:id/deactivate | ✅ 63-71 | ✅ contract_types | ❌ ⚠️ | ❌ | ✅ CF-008 + asymmetry | ✅ stated | ❌ |
| **T6** POST /bulk-delete | ✅ 73-89 | ✅ contract_types (hard or soft) | ❌ ⚠️ | ❌ | ✅ CF-008/015 + status-set inconsistency | ✅ stated | ❌ |
| **T7** DELETE /:id | ✅ 91-104 | ✅ contract_types (hard or soft) | ❌ ⚠️ | ❌ | ✅ CF-008/015 | ✅ stated | ❌ |

**Self-check verdict**: ✅ all 28 rows × 7 dims complete. **Zod column is uniformly ❌** — `contract` domain has zero Zod schemas across both files (no `.parse(...)`, no `safeParse(...)`, no schema imports). This is a domain-wide observation, not 28 separate gaps. To be raised in the cross-domain summary at T002 close-out.

---

## 🔬 Spot-Check Log (RULE 7 — 3 claims sealed in Anchor Block above)

### C1 — E9 file:line + helper chain accuracy ✅

Re-verified by direct read:

| Item | Cited | Re-verified at |
|---|---|---|
| Handler entry | `contracts.ts:430` | ✅ `router.post("/v1/contracts/:id/activate", ...)` at L430. |
| Direct DB write 1 | `contracts.ts:432-434` | ✅ `db.update(contractsTable).set({ status: "Active", ... })` |
| Helper invocation | `contracts.ts:438` | ✅ `await generateContractInvoicesAndSchedules(id)` |
| Direct DB write 2 (cond.) | `contracts.ts:442-444` | ✅ `db.update(bookingsTable).set({ booking_status: "Active" })` |
| logAction call | `contracts.ts:447-450` | ✅ `STATUS_CHANGE` action |
| Helper definition span | `contracts.ts:55-237` (183 lines) | ✅ defined at L55, returns at L236 |
| Helper internal mutation count (typical 12-mo Rent contract) | "27+ mutations" | ✅ recomputed: 1 contract UPD + 1 line-items INS (fb) + 1 sched DEL + N inv DEL + 12 inv INS + 12 sched INS + 1 booking UPD = 28+. Conservative "27+" is correct. |
| `enrichContracts` definition | `contracts.ts:249-295` | ✅ |

**Verdict**: C1 ✅.

### C2 — CF-002 + CF-014 dual-anchor Meta accuracy ✅

| Endpoint | Meta `Auth` | Meta `$$` | Meta `logAction` | Meta `CF` | Body re-verification |
|---|---|---|---|---|---|
| **E2** POST / | requireAuth | Y | N ⚠️ | CF-001, CF-002, CF-008, CF-011 | ✅ writes weekly_rate L326 / total_rent L327 / bond L328 / advance L329 (CF-002 receiving side); no logAction in handler body. |
| **E4** PUT /:id | requireAuth | Y | N ⚠️ | CF-001, CF-002, CF-008 | ✅ writes weekly_rate L360 / total_rent L361 / bond L362 / advance L363; no logAction. |
| **E9** POST /:id/activate | requireAuth | Y (downstream) | Y (1) | CF-001, CF-002, CF-008, CF-014, CF-015 | ✅ helper invocation L438 = canonical CF-014 footprint; logAction at L447; CF-008 noted because the booking-status side-effect at L442-444 is **un-audited** (separate domain mutation). |

**Verdict**: C2 ✅. 3/3 endpoints' Meta lines reflect the source faithfully.

### C3 — Self-discovered inconsistencies ✅ (4 categories, 14 distinct sites)

The 4 candidate categories from the Anchor Block were all confirmed, plus 1 additional bonus inconsistency surfaced during writing:

**[a] `isNull(deleted_at)` filter omission on single-read** — 4 sites:
- E3 GET `/:id` (`contracts.ts:340-346`)
- E21 GET `/lookup/contracts` (`contracts.ts:616-625`)
- T2 GET `/:id` (`contract-types.ts:27-35`)
- (and the contract returned via `:id/services`, `:id/line-items`, `:id/payment-schedule` is itself never re-validated for soft-deletion in those nested handlers)

**[b] `logAction` omission** — 8 sites (CF-008 footprint within this domain):
- E2 POST, E4 PUT, E5 bulk-delete, E6 DELETE, E18 POST line-item, E19 PATCH line-item, E20 DELETE line-item (contracts.ts side)
- T3 POST, T4 PUT, T5 deactivate, T6 bulk-delete, T7 DELETE — wait, actually 5 on contract-types side, not 4. Total = 7 (contracts) + 5 (contract-types) = **12 sites with no logAction across mutation-class handlers**, vs 8 mutation-class handlers that DO call logAction (E7, E8, E9, E10, E11, E13, E14, E15). Mutation handlers total: 12 + 8 = 20. Reads: 8. Sum: 28 ✅.

**[c] HARD DELETE via `permanent=true` flag** — 4 sites (CF-015 footprint):
- E5 POST /bulk-delete (contracts hard)
- E6 DELETE /:id (contracts hard)
- T6 POST /bulk-delete (contract_types hard)
- T7 DELETE /:id (contract_types hard)

(Plus a 5th un-flagged hard-delete: E15 unconditionally hard-deletes `recurring_schedules` rows, and E9's helper hard-deletes both `recurring_schedules` and `invoices`.)

**[d] Zod absence** — 28 / 28 sites (whole domain). Zero Zod imports in either file. Compare `bookings.ts:284` which has `GetBookingParams`. **Domain-wide observation** rather than 28 individual gaps.

**[bonus e] Authorization gap on nested line-item PATCH/DELETE** — newly surfaced:
- E19 `PATCH /:id/line-items/:lineId` (`contracts.ts:589-608`) — WHERE clause is only `eq(id, lineId)` (`:605`); the `:id` path param is ignored, so any authenticated user can update any line-item id regardless of contract ownership.
- E20 `DELETE /:id/line-items/:lineId` (`contracts.ts:610-614`) — same pattern at `:612`.
- (E14 `PATCH .../payment-schedule/:schedId` properly chains `(schedId AND contract_id)` at `:525`. The line-item handlers do not.)

**Verdict**: C3 ✅. Inconsistencies surfaced (not "none, n=28") — total **15 distinct inconsistency sites across 5 categories**.

**Post-T002.1.8 graduation note (2026-04-26)**: Categories [d] and [bonus e] above were assessed in T002.1.8 as project-wide patterns (not contract-domain-specific) and registered in `CRITICAL_FINDINGS.md`:
- [d] **Zod absence ×28** → graduated to **CF-017** (Zod absence project-wide, ~88% of route files unvalidated). The contract domain is the largest single block (28/28); `bookings.ts` is the project's positive exemplar (≥18 `safeParse` sites). See [`_audit/CRITICAL_FINDINGS.md` CF-017](../../_audit/CRITICAL_FINDINGS.md#cf-017--input-validation-zod-or-any-absent-on-90-of-route-files).
- [bonus e] **Authorization gap on nested PATCH/DELETE (E19, E20)** → graduated to **CF-018** (IDOR-class authorization-scope omission). Cross-domain audit of all 17 nested-write handlers found **7 outright vulnerable + 3 partial / TOCTOU-weak + 7 safe** across `contracts.ts`, `bookings.ts`, `space-images.ts` (vulnerable) vs `spaces.ts`, `product-catalog.ts`, `service-host-portal.ts`, `contracts.ts` payment-schedule (safe/safe-conditional). See [`_audit/CRITICAL_FINDINGS.md` CF-018](../../_audit/CRITICAL_FINDINGS.md#cf-018--idor-class-authorization-scope-omission-on-nested-resource-handlers).
- Categories [a] (single-read soft-delete filter omission), [b] (logAction omission ×12), and [c] (hard-delete flag ×4 + helper ×2) remain **domain-local observations** within already-existing CFs (CF-008, CF-015) — no new CF needed.

---

## 🚨 R-REPO-5 Incidental Findings (during T002.2.a writing)

Per protocol: report inline, evaluate impact, propose mini-task if escalation needed. Both pre-warned candidates from the Anchor Block were confirmed.

### Incidental I1 — CF-006 evidence expansion (contracts.ts:92-94) — | impact: CF-006 evidence-expansion mini-task

`contracts.ts:92-94` inside `generateContractInvoicesAndSchedules`:
```ts
const rentAmount = billingFreq === "Weekly" ? weeklyRate
  : billingFreq === "Biweekly" ? weeklyRate * 2
  : parseFloat((weeklyRate * (52 / 12)).toFixed(2));
```

This is the same `weeklyRate * (52 / 12)` formula already cited in `bookings.ts:485` (booking S2 cross-ref) and listed in CF-006 as the *non-`*4`* side of the contradiction. CF-006's current evidence section names `owner-portal.ts:83` (`*4`) and `:236` (`*52/12`); it does NOT yet enumerate `bookings.ts:485` or `contracts.ts:94`.

**Impact**: CF-006 evidence-expansion (no severity change, no count change) — but the formula now appears in **3 distinct files** (owner-portal, bookings, contracts), not 1. Phase 2 reconciliation must update all three sites if a canonical formula is chosen.

**Proposal**: T002.1.8 mini-task — expand CF-006 evidence section to enumerate all 3 sites with file:line, then proceed to T002.2.b.

### Incidental I2 — CF-014 evidence expansion (helper interior) — | impact: CF-014 evidence-expansion mini-task (could batch with I1)

CF-014's current evidence cites only `contracts.ts:429` (the `activate` entry handler). The helper `generateContractInvoicesAndSchedules` (`contracts.ts:55-237`) is invoked from there and performs ≥27 mutations (typical case) sequentially with no transaction. The helper itself includes:

- `db.delete(recurringSchedulesTable)` at `:117`
- N `db.delete(invoicesTable)` at `:121-123`
- N `db.insert(invoicesTable)` at `:162` (inside `while (current < end && safety < 500)`)
- N `db.insert(recurringSchedulesTable)` at `:176` and `:218`
- 1 `db.insert(contractLineItemsTable)` (fallback) at `:100`

**Impact**: CF-014 evidence section should add the helper span (`:55-237`) and the per-mutation file:line list. No severity change; this strengthens the existing P1 with concrete loop-bounded counts.

**Proposal**: bundle with I1 into a single T002.1.8 mini-task (both are CF evidence expansions, atomic 2-CF update + summary table unaffected).

### Incidental I3 — E19 / E20 line-items authorization gap — | impact: 단순 메모 (or candidate new CF P1)

The PATCH and DELETE handlers for nested `:id/line-items/:lineId` ignore the `:id` path param when WHERE-filtering. Any authenticated user can edit/delete any line item by guessing `lineId`. This is **not a CF currently covered** — CF-008 is about audit absence, CF-015 is about hard-delete, CF-014 is about transactions; none cover authorization-scope gaps.

**Impact assessment**: this is a **potential new CF candidate (P1, security)**. However:
- The handler is behind `requireAuth` (admin/staff guard), so the attack surface is "internal staff manipulating line items they shouldn't have scope for", not external IDOR.
- I cannot confirm severity without checking whether other domains exhibit the same pattern (likely yes — see schedule-list E12 also returns rows without scope check on `contract_id` ownership).
- A proper CF would require a domain-wide "authorization scope coverage" audit which is out of scope for T002.2.a.

**Recommendation**: log as **simple memo** here, then flag for T003 (`_audit/00-overview.md`) or T002.2 close-out as a **batch authorization scope audit** mini-task. Not blocking T002.2.b.

---

## 🔗 Cross-reference Index (this file ↔ rest of pack)

| ↔ | Target | Direction | Anchor handler(s) |
|---|---|---|---|
| ↔ | `bookings.md` S2 | bidirectional | E2 (this file) ↔ S2 (booking) — both create `contracts` rows |
| ↔ | `bookings.md` S5 | bidirectional | (no specific contract-domain handler — S5 reads contract-by-booking; pure consumer) |
| → | [`finance-invoicing.md`](./finance-invoicing.md) | this → finance-invoicing | E9 (`POST /:id/activate`) invokes invoice + recurring_schedule mass-creation (helper L55-237); sister CF-014 anchor at R5 generate-due |
| → | `db-schema-overview.md` (T002.3) | this → schema | column-level details for `contracts`, `contract_line_items`, `contract_types`, `contract_products` |
| → | `state-machines.md` (T002.5) | this → state | contract status flow `Draft → Sent → Signed → Active → Terminated/Expired` (E7/E8/E9/E10/E11) + missing precondition guards |
| → | `MONEY_AUDIT.md` §1.1 | this → money | 4 `real`-typed money columns in `contracts` |
| → | `MONEY_AUDIT.md` §3, §5 TC-M02 | this → money | E9 helper is the producer side of the line-items rollup invariant |
| → | [`SCHEMA_FILE_TABLE_MAP.md`](../SCHEMA_FILE_TABLE_MAP.md) | this → map | `contract_products` lives in mis-named `products.ts` (CF-016) |
| → | [`CRITICAL_FINDINGS.md` CF-006](../../_audit/CRITICAL_FINDINGS.md#cf-006--two-contradictory-weeklymonthly-conversion-formulas-across-the-codebase) | this → CF (T002.1.8 graduate) | `contracts.ts:92-94` is now the 3rd of 4 enumerated formula sites (R-REPO-5 incidental I1) |
| → | [`CRITICAL_FINDINGS.md` CF-014](../../_audit/CRITICAL_FINDINGS.md#cf-014--multi-step-mutations-execute-outside-transactions) | this → CF (T002.1.8 graduate) | helper L55-237 + ≥27-mutation-per-call breakdown is now the formal evidence span (R-REPO-5 incidental I2) |
| → | [`CRITICAL_FINDINGS.md` CF-017](../../_audit/CRITICAL_FINDINGS.md#cf-017--input-validation-zod-or-any-absent-on-90-of-route-files) | this → CF (T002.1.8 NEW) | C3 row [d] graduate — entire 28-endpoint domain is unvalidated (`bookings.ts` is the positive exemplar). |
| → | [`CRITICAL_FINDINGS.md` CF-018](../../_audit/CRITICAL_FINDINGS.md#cf-018--idor-class-authorization-scope-omission-on-nested-resource-handlers) | this → CF (T002.1.8 NEW) | C3 row [bonus e] graduate — E19 + E20 are 2 of the 7 outright-vulnerable nested-write handlers (project-wide audit). |

### Back-fill required after T002.2.a merge — ✅ COMPLETED in T002.2.a atomic commit (2026-04-26)

Per R5 (R-REPO-1 atomic commit), the following back-fill edits to `bookings.md` were part of the T002.2.a commit (verify by reading `_schema/api-endpoints/booking.md:142,279`):
- ✅ `bookings.md` S2 cross-ref now tightened to point at **E2** (`POST /v1/contracts`) as the alternate creator and at **E9** (`/activate`) as the next state in the booking→contract pipeline.
- ✅ `bookings.md` S5 cross-ref now tightened to point at **E3** (`GET /v1/contracts/:id`) as the canonical contract-read endpoint, with shared soft-delete-unaware pattern noted.

---

*End of `contract.md` (T002.2.a — 28 endpoints, 21 from `contracts.ts` + 7 from `contract-types.ts`).*
