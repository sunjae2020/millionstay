# Portal — Guest API

> **Domain**: Guest-facing portal (게스트가 자신의 booking/invoice/profile/CS ticket 조회·관리, 결제 진행, GDPR/APP 12 personal data export)
>
> **Files surveyed (3)**:
> - `artifacts/api-server/src/routes/guest-portal.ts` (1244 LOC, 18 endpoints)
> - `artifacts/api-server/src/routes/guest-cs.ts` (257 LOC, 8 endpoints)
> - `artifacts/api-server/src/routes/guest-auth.ts` (229 LOC, 3 endpoints)
>
> **Middleware**: `artifacts/api-server/src/middlewares/requireGuestAuth.ts` (47 LOC)
>
> **Endpoint count**: 29 endpoints (3 auth · 18 portal · 8 CS)
>
> **Auth model**: 3 unauthenticated (register, login, **POST `/v1/cs/upload-image`** with per-route `requireGuestAuth`) + 26 require guest-JWT (24 via global `router.use`, 2 via redundant per-route guard)
>
> **logAction coverage**: 1 of 29 (3.4%) — only `POST /v1/guest/payment/invoice-confirm` (`guest-portal.ts:993-998`). 결제 confirm/create-intent · 모든 CS 작성/회신 · profile/bank-detail mutation 모두 audit 누락.
>
> **Money writes**: 4 endpoints — `POST /bookings` (no $$ direct, but creates row that downstream amount references), `POST /payment/confirm` (creates/updates `invoices`), `POST /payment/create-intent` (Stripe metadata only, no DB mutation), `POST /payment/invoice-confirm` (status flip on `invoices`).
>
> **CF anchors**: CF-001 (auth boundary), **CF-023.b** (NEW sub-pattern — fake booking_ref + real INSERT), CF-011 (invoice_ref count+1 race), CF-014 (no transaction; multi-table mutation), CF-017 (input validation absent on bank/PII fields), CF-018 (IDOR — overall safe in this domain except 1 dead-code site), CF-013 (DOB free-text), CF-005 (incidental — double-applied middleware).

---

## §1 — Auth model & middleware

### 1.1 `requireGuestAuth.ts` middleware (`requireGuestAuth.ts:28-47`)

```ts
export function requireGuestAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    try {
      const payload = verifyGuestJWT(token);
      if (payload.role !== "guest") throw new Error("Not a guest token");
      (req as any).guest = payload;
      next();
      return;
    } catch { /* fall through */ }
  }
  res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Guest authentication required" } });
}
```

| Aspect | Code | Notes |
|---|---|---|
| Secret | `GUEST_JWT_SECRET ?? BASE_SECRET + "_guest"` (`requireGuestAuth.ts:11`) | Falls back to `JWT_SECRET ?? SESSION_SECRET` + literal `"_guest"` suffix — **secret derivation pattern**, not separate env. |
| Hard fail at startup | `if (!BASE_SECRET) throw new Error(...)` (`requireGuestAuth.ts:5-10`) | ✅ No hardcoded dev secret fallback. |
| Token TTL | `expiresIn: "7d"` (`requireGuestAuth.ts:21`) | 7-day session for guests. |
| Role discriminator | `if (payload.role !== "guest")` (`requireGuestAuth.ts:34`) | Cross-token reuse blocked (admin/partner/service-host token cannot be replayed as guest). |
| Failure path | `res.status(401)` with no `next()` after catch | ✅ Correctly terminates. |

### 1.2 Mount strategy (`guest-portal.ts:40`)

```ts
router.use("/v1/guest", requireGuestAuth);
```

Global path-prefix mount applied at `guest-portal.ts:40` — all `/v1/guest/*` routes in **this file** are guarded. However:

- `POST /v1/guest/payment/create-intent` (`guest-portal.ts:834`), `POST /v1/guest/payment/invoice-confirm` (`guest-portal.ts:918`), `GET /v1/guest/documents` (`guest-portal.ts:1227`) **redundantly** add `requireGuestAuth` as per-route arg → **double-applied middleware** on these 3 routes (incidental, harmless but wasteful — JWT verified twice per request).
- `guest-cs.ts` does **NOT** mount globally; instead applies `requireGuestAuth` per-route on every endpoint (`guest-cs.ts:25,39,64,107,142,184,212,231` — 8 of 8 routes). Different pattern from `guest-portal.ts`.
- `guest-auth.ts:14,149` (register, login) intentionally unauthenticated; only `GET /v1/auth/guest/me` (`guest-auth.ts:202`) is guarded.

**Incidental / R-REPO-5**: middleware-mount style inconsistency between `guest-portal.ts` (global prefix) and `guest-cs.ts` (per-route × 8) is a code-smell, not a defect. Filed as memo for `architecture-rules.md` (T004) under "auth-mount conventions". `Impact: 단순 메모`.

---

## §2 — Endpoint inventory (29)

| # | Method | Path | File:Line | Auth | $$ | logAction | Risk |
|---|---|---|---|---|---|---|---|
| 1 | POST | `/v1/auth/guest/register` | `guest-auth.ts:14` | none | — | — | 🟡 marketing-consent fail-silent |
| 2 | POST | `/v1/auth/guest/login` | `guest-auth.ts:149` | none | — | — | ✅ |
| 3 | GET | `/v1/auth/guest/me` | `guest-auth.ts:202` | guest | — | — | ✅ |
| 4 | GET | `/v1/guest/bookings` | `guest-portal.ts:45` | guest (global) | read | — | ✅ |
| 5 | POST | `/v1/guest/bookings` | `guest-portal.ts:85` | guest | indirect | — | 🟡 **CF-023.b** fake `booking_ref` + real INSERT; CF-017 no validation |
| 6 | GET | `/v1/guest/bookings/:id` | `guest-portal.ts:200` | guest | read | — | ✅ IDOR-safe via `account_id` AND |
| 7 | GET | `/v1/guest/invoices` | `guest-portal.ts:323` | guest | read | — | ✅ |
| 8 | GET | `/v1/guest/invoices/:id` | `guest-portal.ts:357` | guest | read | — | ✅ |
| 9 | GET | `/v1/guest/profile` | `guest-portal.ts:416` | guest | read | — | 🟡 returns BSB + bank_account_number plaintext |
| 10 | PUT | `/v1/guest/profile` | `guest-portal.ts:463` | guest | — | — | 🔴 CF-017 — bank/BSB/PII no validation, no audit |
| 11 | POST | `/v1/guest/profile/avatar` | `guest-portal.ts:516` | guest | — | — | ✅ Cloudinary upload + 5MB cap |
| 12 | DELETE | `/v1/guest/profile/avatar` | `guest-portal.ts:561` | guest | — | — | ✅ |
| 13 | GET | `/v1/guest/emergency-contacts` | `guest-portal.ts:585` | guest | — | — | ✅ |
| 14 | POST | `/v1/guest/emergency-contacts` | `guest-portal.ts:598` | guest | — | — | 🟡 CF-017 no email/phone format validation |
| 15 | PUT | `/v1/guest/emergency-contacts/:id` | `guest-portal.ts:635` | guest | — | — | ✅ |
| 16 | DELETE | `/v1/guest/emergency-contacts/:id` | `guest-portal.ts:683` | guest | — | — | ✅ |
| 17 | POST | `/v1/guest/payment/confirm` | `guest-portal.ts:706` | guest | **WRITE** | — | 🔴 CF-011 invoice_ref race · CF-014 no tx · CF-017 no validation · L802 dead-branch · audit miss |
| 18 | POST | `/v1/guest/payment/create-intent` | `guest-portal.ts:834` | guest×2 | Stripe-only | — | 🟡 audit miss; ownership check L862-877 ✅ |
| 19 | POST | `/v1/guest/payment/invoice-confirm` | `guest-portal.ts:918` | guest×2 | **WRITE** | ✅ L993 | ✅ Sole audited write in domain |
| 20 | GET | `/v1/guest/me/data` | `guest-portal.ts:1030` | guest | read | — | ✅ Sole-owner guard L1086-1092 — positive pattern |
| 21 | GET | `/v1/guest/documents` | `guest-portal.ts:1227` | guest×2 | read | — | 🟢 **dead code** — always returns `data:[]`; `guestBookings` query result unused |
| 22 | POST | `/v1/cs/upload-image` | `guest-cs.ts:25` | guest | — | — | ✅ 10MB cap |
| 23 | GET | `/v1/guest/cs-tickets` | `guest-cs.ts:39` | guest | — | — | 🟡 N+1 — `Promise.all` per-row count query |
| 24 | POST | `/v1/guest/cs-tickets` | `guest-cs.ts:64` | guest | — | — | 🟡 CF-014 ticket+message no tx; CF-017 `booking_id` not ownership-checked |
| 25 | GET | `/v1/guest/cs-tickets/:id` | `guest-cs.ts:107` | guest | — | — | ✅ IDOR-safe |
| 26 | POST | `/v1/guest/cs-tickets/:id/messages` | `guest-cs.ts:142` | guest | — | — | 🟡 CF-014 message+ticket update no tx |
| 27 | GET | `/v1/guest/announcements` | `guest-cs.ts:184` | guest | — | — | ✅ |
| 28 | GET | `/v1/guest/direct-messages` | `guest-cs.ts:212` | guest | — | — | ✅ |
| 29 | PATCH | `/v1/guest/direct-messages/:id/read` | `guest-cs.ts:231` | guest | — | — | ✅ IDOR-safe |

**Severity tally**: 🔴 P0/critical = 2 (rows 10, 17) · 🟡 P1/material = 9 · 🟢 dead code = 1 · ✅ clean = 17.

---

## §3 — Detailed endpoints (critical-mass only)

### 3.1 [E5] POST `/v1/guest/bookings` — guest-initiated booking inquiry → **CF-023.b sub-pattern carrier**

**Source**: `guest-portal.ts:85-195` (110 LOC).

**Meta**: `Auth: guest (global mount L40) | $$: indirect (creates bookings row, no amount yet) | logAction: ❌ | CF: 023.b · 017 · 014`

**Behavior**:
1. Read `space_id, check_in_date, check_out_date, num_guests, customer_notes, special_requests` from `req.body` (L89-103). Coalesce `notes = customer_notes ?? special_requests ?? null` (L104).
2. 3-field presence check (L106-109) — only `space_id/check_in/check_out` required. `num_guests` defaults `1` (L158); no enum/type/range check on any field.
3. `SELECT spaces JOIN properties WHERE id=:space_id AND status='Active' LIMIT 1` (L112-124).
4. `SELECT guest_users WHERE account_id=:guest.account_id LIMIT 1` to fetch name/email for confirmation email (L132-136).
5. **Generate `booking_ref`** (L138-141):
   ```ts
   const timestamp = Date.now().toString(36).toUpperCase();
   const random = Math.random().toString(36).substring(2, 5).toUpperCase();
   const booking_ref = `GBK-${timestamp}-${random}`;
   ```
6. Compute `stayWeeks` = `Math.max(1, Math.round((checkOut-checkIn)/msPerWeek))` (L144-146).
7. **INSERT bookings** (L149-171): `{booking_ref, account_id, space_id, dates, stay_weeks, num_guests, customer_notes:notes, booking_status:"Pending", booking_source:"Guest Portal", status:"Active"}`. RETURNING 6 columns.
8. Fire-and-forget `sendBookingConfirmation(...)` with `.catch(()=>{})` (L177-188).
9. `res.status(201).json({success:true, data:newBooking})` (L190).

**🔴 CF-023.b — fake-ref pattern with real INSERT (NEW sub-pattern, distinct from CF-023.a in `leads.ts:175-204`)**

| Aspect | This endpoint (`guest-portal.ts:85`) | CF-023.a in `leads.ts:175-204` | Proper helper `bookings.ts:60` |
|---|---|---|---|
| Generation | `GBK-${Date.now()36}-${Math.random()36×3}` (L139-141) | `BK-${year}-${Math.random()×5}` (`leads.ts:188-189`) | `MS-${year}-${seq:5}` via `COUNT(*) WHERE EXTRACT(YEAR)` |
| Collision space | ~46 656 (3-char base36) per timestamp ms | ~60 466 176 (5-char base36) per year | sequential, DB-validated |
| Side effect | **Real `bookings` INSERT (L149-171)** | **NO `bookings` INSERT — orphan reference** | Real `bookings` INSERT |
| Unique constraint check | None (drizzle does not declare unique on `booking_ref`) | None | None |
| Severity | 🟡 P1 (low collision risk, but inconsistent ref scheme + no audit) | 🔴 P1 (lying — `lead.converted_booking_id` permanently NULL) | ✅ exemplar |

**CF-023 split rationale**: The two sub-patterns share the same root cause ("ad-hoc `booking_ref` generation outside the canonical helper") but differ in blast radius — `.b` is a presentation/data-quality concern (two ref schemes coexist: `MS-YYYY-NNNNN` from `bookings.ts:60` vs `GBK-…-…` from this endpoint), `.a` is an integrity violation (ref points to nothing). `state-machines.md` (T002.5) must enumerate **two spawn-paths for `bookings.booking_ref`** and document downstream consumers' assumption of `MS-…` prefix (search/filter UIs in admin dashboard may not match `GBK-…` rows).

**Other findings on this handler**:
- **CF-014**: bookings INSERT (L149) + email send (L177) are not bundled in tx. Email failure is `.catch()`-swallowed → acceptable. But there is no second DB write that would benefit from tx; CF-014 is **N/A here**, listed in tally only because the helper structurally lacks tx wrapper.
- **CF-017**: zero validation — `space_id` could be a string, `check_in_date` could be `"yesterday"`, `num_guests` could be `-3` or `999999`. `Number(req.params.id)` not used (it's body-param), so even type coercion via `Number()` is absent.
- **logAction missing**: a guest creating a booking is a high-value business event; the lone audit call in this domain is at L993 (invoice payment), not here.

---

### 3.2 [E17] POST `/v1/guest/payment/confirm` — manual bank-transfer / non-Stripe payment

**Source**: `guest-portal.ts:706-828` (123 LOC).

**Meta**: `Auth: guest (global mount L40 only — NO per-route guard) | $$: WRITE (creates or updates invoices) | logAction: ❌ | CF: 011 · 014 · 017 · L802 dead-branch`

**Behavior** (in order):
1. Read `{booking_id, amount?, payment_method = "bank_transfer"}` from body (L708-712). Single presence check on `booking_id` (L714).
2. **Ownership query** (L721-740): `SELECT bookings WHERE id=:booking_id AND account_id=:guest.account_id`. ✅ IDOR-safe via AND.
3. Reject `Cancelled` (L747-750).
4. **Existing-invoice check** (L754-757): `SELECT invoices WHERE booking_id=:booking_id`. Only `id` projected. → If `length === 0`, branch into **CREATE**:
   - **🔴 CF-011 invoice_ref race** (L762-764):
     ```ts
     const allInvRows = await db.select({ id: invoicesTable.id }).from(invoicesTable);
     const invCount = allInvRows.length + 1;
     const invoice_ref = `MS-INV-${year}-${String(invCount).padStart(5, "0")}`;
     ```
     Full-table `COUNT(*)` proxy via row-fetch (memory blow-up at scale) + `count+1` race window. Two concurrent `POST /payment/confirm` requests will both compute the same `invCount`, both try `INSERT` with same `invoice_ref` (no DB UNIQUE constraint asserted on `invoice_ref`). Same defect pattern as `contracts.ts` documented under CF-011.
   - INSERT invoices (L767-780) with `status: payment_method==="bank_transfer" ? "Sent" : "Paid"` and `paid_at: ... ? null : new Date()`.
5. Else (existing invoice path, L782-798): if `payment_method !== "bank_transfer"` → UPDATE invoice → `Paid + paid_at=now`. Else SELECT existing for response. **Re-fetch happens twice**: L754 (count) + L792 (full row) — incidental N+1, single-handler scale.
6. **L801-806 — dead-branch bug**:
   ```ts
   const newStatus = payment_method === "bank_transfer" ? "PendingApproval" : "PendingApproval";
   await db.update(bookingsTable).set({ booking_status: newStatus }).where(eq(bookingsTable.id, booking_id));
   ```
   Both branches return the literal `"PendingApproval"`. The conditional is **structurally dead** — either ternary author intended different statuses (e.g. `Confirmed` for paid card vs `PendingApproval` for bank-transfer) and both arms collapsed to one value during a refactor, or the conditional is vestigial. Live impact: **card payments do NOT auto-confirm bookings** — ops must manually progress them, which is inconsistent with payment success. State-machine documentation (T002.5) must surface this.
7. **CF-014**: invoice INSERT/UPDATE (L767/L785) + booking status UPDATE (L803) are 2 sequential writes on different tables, no `db.transaction(...)` wrapper. Partial failure leaves inconsistent state (paid invoice without booking status flip, or vice versa). Same etiology documented in T002.2.b carrier under `stripe.ts` (webhook).
8. **logAction**: ❌ — bank-transfer payment intent is unaudited. Compare to L993 (`invoice-confirm`) which does call `logAction`. Inconsistent within same file.
9. **CF-017**: `amount?: number` not validated — guest could submit `amount: -1000` or `amount: 1e20`; coerced via `Number(amount ?? booking.total_rent)` and inserted directly. No range/positivity check.

**Severity decomposition**: dead-branch L802 (functional bug, P1) + CF-011 (race + scan, P0) + CF-014 (no tx, P1) + CF-017 (amount unbounded, P1). This is the single highest-risk handler in the domain.

---

### 3.3 [E19] POST `/v1/guest/payment/invoice-confirm` — invoice-scoped bank-transfer / paid status flip

**Source**: `guest-portal.ts:918-1019` (102 LOC).

**Meta**: `Auth: guest (×2 — global L40 + per-route L918) | $$: WRITE (status + paid_at + payment_method) | logAction: ✅ L993-998 | CF: 014 (no tx, but only 1 write)`

**Behavior**:
1. Read `{invoice_id, payment_method = "bank_transfer"}`, presence-check `invoice_id` (L920-928).
2. **Compound ownership check** (L932-974) — 2-stage IDOR defense:
   - Stage 1: `invoice.account_id === guest.account_id` (L957) → `hasAccess = true`.
   - Stage 2 (fallback for invoices missing `account_id`): `SELECT bookings WHERE id=:invoice.booking_id` then compare `booking.account_id === guest.account_id` (L961-968).
   - Else 403 (L971-974). ✅ IDOR-safe even when `invoices.account_id` is NULL.
3. Reject `Paid` (L976-978) — idempotency guard.
4. UPDATE invoices (L982-991): `status: payment_method !== "bank_transfer" ? "Paid" : "Sent"`, `paid_at`, `payment_method`, `updated_at`. Single write.
5. **logAction** (L993-998): `entityType:"invoice", action:"PAYMENT", newValue:{status, payment_method, note:"Guest portal payment confirmation"}`. ✅ — sole audit call in entire 29-endpoint domain.
6. JSON response (L1000-1014). Structurally cleaner than `/payment/confirm`: scoped to invoice (not booking), single write, audited, IDOR-fortified.

**Note**: This endpoint **does not flip booking_status** — distinct from `/payment/confirm` (L803). A guest paying via this path leaves `bookings.booking_status` untouched — by design (invoice-only) or by oversight? The two endpoints overlap in purpose (`/payment/confirm` for booking-scoped, `/payment/invoice-confirm` for invoice-scoped). T002.5 (state-machines) must document the dual entry-point.

---

### 3.4 [E18] POST `/v1/guest/payment/create-intent` — Stripe payment intent

**Source**: `guest-portal.ts:834-912` (79 LOC).

**Meta**: `Auth: guest×2 | $$: Stripe-only (no DB write) | logAction: ❌ | CF: none direct`

**Behavior**:
1. Pull `STRIPE_SECRET_KEY` from `process.env`; `503` if missing (L838-842). Late env-binding (per-request) — no startup hardfail.
2. Same 2-stage ownership check as `/payment/invoice-confirm` (L862-877). ✅ IDOR-safe.
3. Reject `Paid` (L879-882).
4. Construct `Stripe` client per-request (L884) — **incidental**: client should be module-scoped singleton; per-request construction is a perf nit, not a defect. `Impact: 단순 메모 → architecture-rules.md (T004) under "external-client lifecycle"`.
5. `paymentIntents.create({amount: Math.round(Number(invoice.amount)*100), currency: ..., metadata: {invoice_id, invoice_ref, account_id}, receipt_email: guest.email})` (L887-897). No DB write — DB row is updated later by Stripe webhook (`stripe.ts`, see `finance-payments.md` §Stripe webhook).
6. Returns `{client_secret, amount, currency, invoice_ref}` (L899-907).

**Audit gap**: `payment_intent.created` is a money-touching event (even read-only on DB). For PCI/audit completeness, this SHOULD log; cross-ref CF-008 (audit-trail completeness).

---

### 3.5 [E20] GET `/v1/guest/me/data` — APP 12 (Australian Privacy Principle 12) personal data export → **positive pattern**

**Source**: `guest-portal.ts:1030-1225` (196 LOC — largest endpoint in domain).

**Meta**: `Auth: guest (global L40) | $$: read | logAction: ❌ | CF: positive exemplar of sole-owner guard`

**Behavior** (7-step assembly):
1. Profile select with **password_hash explicitly excluded** (L1034-1059). ✅ explicit allow-list.
2. Account fetch if `account_id` present (L1067-1073).
3. Emergency contacts (L1076-1080).
4. **Sole-owner guard** (L1082-1092):
   ```ts
   let accountSoleOwner = false;
   if (guest.account_id) {
     const sharers = await db.select({id: guestUsersTable.id})
       .from(guestUsersTable).where(eq(guestUsersTable.account_id, guest.account_id));
     accountSoleOwner = sharers.length === 1 && sharers[0]!.id === guest.id;
   }
   ```
   When account is shared (e.g. a couple with two `guest_users` rows), **bookings/invoices arrays return empty** (L1094-1136 short-circuit on `!accountSoleOwner`). This prevents one guest exporting another guest's bookings via shared `account_id`. **Best-of-breed pattern in this codebase** — only place sole-owner guard appears.
5. Documents query (L1138-1170) handles empty-bookings case via `or(...)` / fallback `and(...)`.
6. Marketing consents by email (L1173-1183).
7. Compose `dump` envelope with `legal_basis` text + counts (L1185-1206).
8. `?format=download` query param triggers `Content-Disposition: attachment; filename="millionstay-mydata-{safeEmail}-{date}.json"` (L1208-1218).

**Findings**:
- ✅ Sole-owner guard pattern → recommend extraction to `_rules/security-rules.md` (T004) as canonical IDOR-defense exemplar.
- 🟡 **Audit miss**: APP 12 export is itself a privacy-sensitive event (subject access request) — should be `logAction({entityType:"guest_user", action:"DATA_EXPORT"})`. CF-008 reinforcement.
- 🟡 **CF-013 cross-ref**: `date_of_birth` exported as raw text (L1043) — DB column is `varchar` per `guest_users` schema (cross-ref to db-schema-overview.md, T002.3). ISO-format not enforced.

---

### 3.6 [E21] GET `/v1/guest/documents` — **dead code**

**Source**: `guest-portal.ts:1227-1241` (15 LOC).

**Meta**: `Auth: guest×2 | $$: read | logAction: ❌ | CF: dead code (incidental)`

**Behavior**:
```ts
router.get("/v1/guest/documents", requireGuestAuth, async (req, res): Promise<void> => {
  const guest = (req as any).guest as { id: number; email: string; account_id: number | null };
  try {
    const guestBookings = await db
      .select({ id: bookingsTable.id })
      .from(bookingsTable)
      .leftJoin(guestUsersTable, eq(guestUsersTable.account_id, bookingsTable.account_id as any))
      .where(eq(guestUsersTable.id, guest.id));

    res.json({ success: true, data: [], meta: { total: 0 } });
  } catch (err) { ... }
});
```

- L1230-1234 fetches `guestBookings` then **discards the result**.
- L1236 always returns `data: []`.
- `documentsTable` is imported (`guest-portal.ts:17`) but only used by `/me/data` (E20) — this endpoint never queries documents.

**Incidental classification (R-REPO-5)**: dead code + wasted DB query per request. `Impact: CF 신규 등재 불필요 (단일 사이트, 사용자 visible impact 없음) — 단순 메모 → INDEX.md "Dead code sites" appendix when T002.5 / T008 close-out.`

---

### 3.7 [E10] PUT `/v1/guest/profile` — full profile update incl. bank details

**Source**: `guest-portal.ts:463-511` (49 LOC).

**Meta**: `Auth: guest (global L40) | $$: indirect — bank fields stored | logAction: ❌ | CF: 017 · 013`

**Behavior**:
- 15 fields accepted (L467-471): name×2, phone, nationality, **date_of_birth**, gender, university, department, student_id, study_year, **bank_name, bank_account_name, bank_bsb, bank_account_number**, preferred_payment_method.
- Each field passed via `?? undefined` (L476-490) → drizzle skip-on-undefined behavior. Partial-update semantics correct.
- Account name secondary-write if `first_name || last_name` provided (L496-503) — 2nd write, no tx (CF-014 micro-instance).
- `res.json({success:true, data:updated})` (L506).

**🔴 CF-017 — input validation matrix (critical)**:

| Field | Validation present? | Risk |
|---|---|---|
| `date_of_birth` | ❌ raw string passthrough | CF-013 — guest can submit `"1900-13-45"` or `"yes"`; stored as-is. |
| `bank_bsb` | ❌ no format check | Australian BSB is `XXX-XXX` 6-digit — not enforced. |
| `bank_account_number` | ❌ no length/digit check | Stored as plaintext varchar (cross-ref security-rules.md, T004 — should be encrypted-at-rest or referenced via tokenization). |
| `gender` | ❌ no enum | `guest_users.gender` schema defines as varchar — accepts any string. |
| `study_year` | ❌ no enum | Accepts arbitrary string (varchar). |
| `email` | n/a (not editable here) | — |
| All others | ❌ no length cap | DoS-via-large-string vector. |

**Audit miss**: bank-detail mutation is a high-risk event (account-takeover indicator). MUST be audited. CF-008 reinforcement.

---

### 3.8 [E6] GET `/v1/guest/bookings/:id` — booking detail with nested invoice/contract/schedule/services → **IDOR-safe read-heavy exemplar**

**Source**: `guest-portal.ts:200-318` (119 LOC).

**Meta**: `Auth: guest (global L40) | $$: read (4 SELECTs across 5 tables) | logAction: ❌ | CF: ✅ IDOR-safe; N+1-class read but single-booking scope`

**Behavior** (4 sequential queries):
1. **Booking row** (L204-235): `SELECT bookings JOIN spaces JOIN properties WHERE id=:bookingId AND account_id=:guest.account_id LIMIT 1`. ✅ IDOR-safe via AND.
2. Invoices for booking (L243-258): `SELECT invoices WHERE booking_id=:bookingId`. **Authorization via prior step** — caller already established booking ownership; invoice scope inherits. Acceptable.
3. Contract for booking (L261-280): `SELECT contracts WHERE booking_id=:bookingId LIMIT 1`. Inherited authorization.
4. Payment schedule (L283-299): conditional on contract presence — `SELECT recurring_schedules WHERE contract_id=:contract.id`.
5. Booking services (L302-315): `SELECT booking_services WHERE booking_id=:bookingId AND status='Active'`.

**Findings**:
- ✅ **Read-heavy IDOR exemplar**: 5 tables, 1 ownership check at root. Recommend as positive case study in `security-rules.md` (T004).
- 🟡 N+1-class **per request but bounded**: 4 sequential queries always. Could be parallelized (Promise.all on steps 2-5). Perf nit, not defect. `Impact: 단순 메모 → architecture-rules.md`.
- ✅ `cancellation_reason` exposed (L217) — leaks ops cancellation note to guest. Likely intentional (transparency) but T004 (privacy-rules) should confirm.

---

## §4 — Grouped sections (compact format)

### 4.1 Auth (3 endpoints)

| # | Endpoint | Notes |
|---|---|---|
| E1 | POST `/v1/auth/guest/register` (`guest-auth.ts:14-144`) | `validatePassword` policy enforced (L30-34) ✅. `bcrypt.hash(password, 10)` (L50) — bcrypt cost-10 standard. **Two-table INSERT** (L54-83): `accounts` then `guest_users`. **No tx** (CF-014). Marketing consent recorded with `onConflictDoUpdate` on `(email, channel)` (L93-116) wrapped in try/catch — fail-silent design (L117-120). |
| E2 | POST `/v1/auth/guest/login` (`guest-auth.ts:149-197`) | Generic 401 on missing user OR `!is_active` OR bcrypt mismatch (L164-173) — ✅ no enumeration. JWT signed via `signGuestJWT` (L175-179). |
| E3 | GET `/v1/auth/guest/me` (`guest-auth.ts:202-227`) | Re-fetches from DB (not from JWT payload) — ✅ catches deactivated-mid-session. |

### 4.2 Bookings list (1 endpoint, E4)

`GET /v1/guest/bookings` (`guest-portal.ts:45-80`): `WHERE account_id=:guest.account_id AND status='Active'` (L72-75). 17-column projection across 3 tables. ✅ IDOR-safe; ✅ soft-delete filter (`status='Active'`) — positive pattern relevant to CF-020.

### 4.3 Invoices read (2 endpoints, E7-E8)

| # | Notes |
|---|---|
| E7 `GET /v1/guest/invoices` (L323-352) | `WHERE invoices.account_id=:guest.account_id` (L348). ✅ IDOR-safe via direct `account_id` column (no booking-fallback like payment-confirm endpoints — assumes invoice always has `account_id`). |
| E8 `GET /v1/guest/invoices/:id` (L357-411) | `WHERE id=:invId AND account_id=:guest.account_id` (L388-391). ✅ IDOR-safe via AND. Includes guest profile in response (L399-408) — for receipt rendering. |

### 4.4 Profile (4 endpoints, E9-E12)

E9 GET (L416-458) — returns BSB + account_number plaintext (privacy-sensitive). E10 PUT — see §3.7. E11 POST avatar (L516-556) — Cloudinary upload, deletes prior `avatar_public_id` if exists, 5MB cap, image-mimetype filter (L28-30). E12 DELETE avatar (L561-580) — symmetric cleanup.

### 4.5 Emergency Contacts (4 endpoints, E13-E16)

| # | Notes |
|---|---|
| E13 GET (L585-593) | `WHERE guest_user_id=:guest.id`. ✅ IDOR-safe. |
| E14 POST (L598-630) | If `is_primary` true, batch-clears prior primaries (L612-616) **before** INSERT — but no tx (CF-014). Race window: two concurrent POSTs both `is_primary=true` → both clear, both INSERT, two primaries result. |
| E15 PUT (L635-678) | Pre-check ownership via existence query (L646-651) → TOCTOU window before UPDATE (L661-672) but UPDATE itself filters by `id AND guest_user_id` so still safe. ✅ |
| E16 DELETE (L683-701) | DELETE filters by `id AND guest_user_id`. ✅ IDOR-safe. **Hard delete** — cross-ref CF-015 (no soft-delete on this table is intentional; `guest_emergency_contacts` schema has no `deleted_at`). |

### 4.6 CS / Support (5 endpoints, E22-E26)

| # | Notes |
|---|---|
| E22 POST `/v1/cs/upload-image` (`guest-cs.ts:25-34`) | Per-route `requireGuestAuth` + `multer.memoryStorage()` 10MB cap (L9). 503 if `!isCloudinaryConfigured()`. Uploads to `millionstay/cs` folder. |
| E23 GET `/v1/guest/cs-tickets` (`guest-cs.ts:39-59`) | 🟡 **N+1**: L48-53 `Promise.all(tickets.map(async (t) => COUNT(*) WHERE ticket_id=t.id))` — one COUNT query per ticket. At 100 tickets = 101 queries. CF-021 cross-ref (N+1 pattern). |
| E24 POST `/v1/guest/cs-tickets` (`guest-cs.ts:64-102`) | `generateTicketRef()` (L13-20): proper `COUNT(*) WHERE EXTRACT(YEAR)+1` pattern (same race risk as CF-011 but lower-volume table). 2-table sequential INSERT (ticket L76 + initial message L88) — **no tx** (CF-014). 🟡 `booking_id` accepted from body **with no ownership check** (L79) — guest can attach a ticket to another guest's booking. CF-018 micro-instance. |
| E25 GET `/v1/guest/cs-tickets/:id` (`guest-cs.ts:107-137`) | `WHERE id=:id AND guest_user_id=:guestId` (L113). ✅ IDOR-safe. Includes messages + booking summary. |
| E26 POST `/v1/guest/cs-tickets/:id/messages` (`guest-cs.ts:142-179`) | Pre-check ticket ownership (L153-155) ✅. INSERT message (L160-167) + UPDATE ticket `status` / `updated_at` (L169-173) — **2 writes, no tx** (CF-014). Re-opens `Resolved` tickets to `Open` on guest reply (L169-170) — state-machine entry for T002.5. |

### 4.7 Announcements & Direct Messages (3 endpoints, E27-E29)

| # | Notes |
|---|---|
| E27 GET `/v1/guest/announcements` (`guest-cs.ts:184-207`) | `WHERE is_published=1 AND published_at <= now` (L191-194); post-filter expired in JS (L199-201) — **could push to SQL** (perf nit). |
| E28 GET `/v1/guest/direct-messages` (`guest-cs.ts:212-226`) | `WHERE guest_user_id=:guestId`. Unread count computed in JS (L221) — could be SQL aggregate. |
| E29 PATCH `/v1/guest/direct-messages/:id/read` (`guest-cs.ts:231-255`) | UPDATE filters `id AND guest_user_id`. ✅ IDOR-safe. |

---

## §5 — IDOR audit (29-row matrix)

| # | Endpoint | Authorization basis | Verdict |
|---|---|---|---|
| 1-2 | `/auth/guest/register`, `/login` | n/a (unauthenticated) | n/a |
| 3 | `/auth/guest/me` | `WHERE id=:jwt.id` | ✅ |
| 4 | GET `/bookings` | `WHERE account_id=:jwt.account_id AND status='Active'` | ✅ |
| 5 | POST `/bookings` | `account_id` set from JWT (L153) | ✅ no IDOR (creation, not access) |
| 6 | GET `/bookings/:id` | `WHERE id=:p AND account_id=:jwt` (L229-233) | ✅ |
| 7 | GET `/invoices` | `WHERE account_id=:jwt` (L348) | ✅ |
| 8 | GET `/invoices/:id` | `WHERE id=:p AND account_id=:jwt` (L388-391) | ✅ |
| 9-12 | Profile / avatar | `WHERE id=:jwt.id` on every query | ✅ |
| 13-16 | Emergency contacts | `WHERE guest_user_id=:jwt.id` (×4) | ✅ |
| 17 | POST `/payment/confirm` | `WHERE id=:p AND account_id=:jwt` (L734-737) | ✅ |
| 18 | POST `/payment/create-intent` | 2-stage: `invoice.account_id===jwt.account_id` else booking-fallback (L862-877) | ✅ compound |
| 19 | POST `/payment/invoice-confirm` | Same 2-stage as E18 (L957-974) | ✅ compound |
| 20 | GET `/me/data` | `id=:jwt.id` everywhere + **sole-owner guard** for shared-account fields | ✅ best-of-breed |
| 21 | GET `/documents` | n/a (returns `[]` always — dead code) | n/a |
| 22 | POST `/cs/upload-image` | per-route `requireGuestAuth`, no entity-scoped check (just upload) | ✅ |
| 23 | GET `/cs-tickets` | `WHERE guest_user_id=:jwt.id` | ✅ |
| 24 | POST `/cs-tickets` | `guest_user_id` set from JWT, BUT `booking_id` accepted unchecked | 🟡 **partial — booking ownership not verified** |
| 25 | GET `/cs-tickets/:id` | `WHERE id=:p AND guest_user_id=:jwt` | ✅ |
| 26 | POST `/cs-tickets/:id/messages` | `WHERE id=:p AND guest_user_id=:jwt` (L153-155) | ✅ |
| 27 | GET `/announcements` | not entity-scoped (public to all logged-in guests) | ✅ by design |
| 28 | GET `/direct-messages` | `WHERE guest_user_id=:jwt.id` | ✅ |
| 29 | PATCH `/direct-messages/:id/read` | `WHERE id=:p AND guest_user_id=:jwt` (L240-243) | ✅ |

**IDOR tally**: 26 ✅ + 1 🟡 (E24 booking_id unchecked) + 2 n/a. **Domain is the strongest IDOR-defense surface in the codebase audited so far** (compare to `contracts.ts` where 7 of 17 nested writes were vulnerable per CF-018).

---

## §6 — Cross-cutting findings summary (this domain)

### 6.1 Per-CF impact

| CF | Anchor sites in this domain | Severity in domain |
|---|---|---|
| **CF-001** (auth boundary) | Mount-style inconsistency: `guest-portal.ts:40` global vs `guest-cs.ts` per-route × 8 vs `guest-auth.ts` per-route × 1 (ML on `me` only). 3 routes double-guarded (E18/E19/E21). | 🟢 informational |
| **CF-008** (audit-trail incompleteness) | 1 of 29 endpoints audit (3.4%) — only E19 calls `logAction`. Missing on all profile/bank mutations (E10), all bookings creation (E5), all CS writes (E24/E26), payment-intent creation (E18), bank-transfer payment confirm (E17), APP12 data export (E20). | 🔴 reinforces P1 |
| **CF-011** (count+1 race) | E17 `guest-portal.ts:762-764` — same `allInvRows.length+1` pattern. Adds **2nd full carrier site** for CF-011 (alongside `contracts.ts`). | 🔴 reinforces P0 — multi-site systemic |
| **CF-013** (date/timezone) | E10 `date_of_birth` raw text accepted; E20 exports raw text. | 🟡 reinforces P1 |
| **CF-014** (no transaction) | 5 multi-write sites with no tx: E1 register (accounts+guest_users), E5 bookings POST + email (email outside tx-need), E10 profile + accounts.name, E17 invoice+booking_status, E24 ticket+message, E26 message+ticket-update. **6th–11th carrier sites** for CF-014. | 🔴 reinforces P0 — ubiquitous |
| **CF-015** (hard delete) | E16 emergency-contact DELETE — schema lacks `deleted_at` so by design. ✅ no leak. | n/a |
| **CF-017** (input validation) | E5/E10/E14/E17/E24 all accept body fields with no Zod/format check. **Confirms ~88% rate** from CF-017 baseline. | 🔴 reinforces P1 |
| **CF-018** (IDOR) | E24 `booking_id` unchecked = **1 new partial IDOR site**. Domain otherwise extremely clean. | 🟢 1 partial, very low. |
| **CF-020** (soft-delete leak) | E4 `WHERE status='Active'` ✅ filters; E7 invoices read **does NOT filter `invoices.status` deleted state** — but `invoices` schema may not have soft-delete; cross-check needed in T002.3. | 🟡 candidate — defer to T002.3 |
| **CF-021** (N+1 enrichment) | E23 `Promise.all` per-row COUNT (`guest-cs.ts:48-53`). Reinforces CF-021 candidate. | 🟡 reinforces |
| **CF-023.b** (NEW SUB-PATTERN) | E5 `guest-portal.ts:138-141` fake-ref + real INSERT. Splits CF-023 into .a (orphan) / .b (insecure-ref-with-INSERT). | 🟡 P1 sub-pattern |

### 6.2 New incidentals (R-REPO-5) discovered this sub-task

| ID | Site | Description | Impact |
|---|---|---|---|
| Inc-1 | E18 `guest-portal.ts:884` | `new Stripe(...)` per-request (not module singleton) | 단순 메모 → architecture-rules.md (T004) "external-client lifecycle" |
| Inc-2 | E21 `guest-portal.ts:1227-1241` | Dead code — `guestBookings` SELECT discarded; always returns `[]` | 단순 메모 → INDEX.md "Dead code sites" appendix at T008 |
| Inc-3 | E14 `guest-portal.ts:612-616` | `is_primary` race window — clear-then-INSERT without tx | 단순 메모 → CF-014 next expansion (no new CF) |
| Inc-4 | E17 `guest-portal.ts:802` | Dead-branch ternary `bank_transfer ? "PendingApproval" : "PendingApproval"` | 단순 메모 → state-machines.md (T002.5) MUST surface |
| Inc-5 | Mount-style | `guest-portal.ts` global vs `guest-cs.ts` per-route × 8 vs `guest-auth.ts` per-route × 1 | 단순 메모 → architecture-rules.md (T004) "auth-mount conventions" |

**No mini-task proposals** — all 5 incidentals route to existing follow-ups (T002.5/T004/T008/CF-014 next expansion). No new CF promotion candidate identified beyond CF-023 sub-split (already promoted in T002.2.e.fix-1).

---

## §7 — 29 × 7 self-check matrix

| # | Endpoint | Auth ✓ | $$ ✓ | logAction ✓ | CF ✓ | Spot-check ref | IDOR ✓ | All-pass |
|---|---|---|---|---|---|---|---|---|
| 1 | POST `/v1/auth/guest/register` | ✅ | ✅ | ✅ | ✅ | guest-auth.ts:14-144 | n/a | ✅ |
| 2 | POST `/v1/auth/guest/login` | ✅ | ✅ | ✅ | ✅ | :149-197 | n/a | ✅ |
| 3 | GET `/v1/auth/guest/me` | ✅ | ✅ | ✅ | ✅ | :202-227 | ✅ | ✅ |
| 4 | GET `/v1/guest/bookings` | ✅ | ✅ | ✅ | ✅ | guest-portal.ts:45-80 | ✅ | ✅ |
| 5 | POST `/v1/guest/bookings` | ✅ | ✅ | ✅ | ✅ CF-023.b | :85-195 | ✅ | ✅ |
| 6 | GET `/v1/guest/bookings/:id` | ✅ | ✅ | ✅ | ✅ | :200-318 | ✅ | ✅ |
| 7 | GET `/v1/guest/invoices` | ✅ | ✅ | ✅ | ✅ | :323-352 | ✅ | ✅ |
| 8 | GET `/v1/guest/invoices/:id` | ✅ | ✅ | ✅ | ✅ | :357-411 | ✅ | ✅ |
| 9 | GET `/v1/guest/profile` | ✅ | ✅ | ✅ | ✅ | :416-458 | ✅ | ✅ |
| 10 | PUT `/v1/guest/profile` | ✅ | ✅ | ✅ | ✅ CF-017 | :463-511 | ✅ | ✅ |
| 11 | POST `/v1/guest/profile/avatar` | ✅ | ✅ | ✅ | ✅ | :516-556 | ✅ | ✅ |
| 12 | DELETE `/v1/guest/profile/avatar` | ✅ | ✅ | ✅ | ✅ | :561-580 | ✅ | ✅ |
| 13 | GET `/v1/guest/emergency-contacts` | ✅ | ✅ | ✅ | ✅ | :585-593 | ✅ | ✅ |
| 14 | POST `/v1/guest/emergency-contacts` | ✅ | ✅ | ✅ | ✅ Inc-3 | :598-630 | ✅ | ✅ |
| 15 | PUT `/v1/guest/emergency-contacts/:id` | ✅ | ✅ | ✅ | ✅ | :635-678 | ✅ | ✅ |
| 16 | DELETE `/v1/guest/emergency-contacts/:id` | ✅ | ✅ | ✅ | ✅ | :683-701 | ✅ | ✅ |
| 17 | POST `/v1/guest/payment/confirm` | ✅ | ✅ | ✅ | ✅ CF-011/014/017 + Inc-4 | :706-828 | ✅ | ✅ |
| 18 | POST `/v1/guest/payment/create-intent` | ✅ ×2 | ✅ | ✅ | ✅ Inc-1 | :834-912 | ✅ | ✅ |
| 19 | POST `/v1/guest/payment/invoice-confirm` | ✅ ×2 | ✅ | ✅ logAction | ✅ | :918-1019 | ✅ | ✅ |
| 20 | GET `/v1/guest/me/data` | ✅ | ✅ | ✅ | ✅ exemplar | :1030-1225 | ✅ | ✅ |
| 21 | GET `/v1/guest/documents` | ✅ ×2 | ✅ | ✅ | ✅ Inc-2 | :1227-1241 | n/a | ✅ |
| 22 | POST `/v1/cs/upload-image` | ✅ | ✅ | ✅ | ✅ | guest-cs.ts:25-34 | ✅ | ✅ |
| 23 | GET `/v1/guest/cs-tickets` | ✅ | ✅ | ✅ | ✅ CF-021 | :39-59 | ✅ | ✅ |
| 24 | POST `/v1/guest/cs-tickets` | ✅ | ✅ | ✅ | ✅ CF-018 partial | :64-102 | 🟡 | ✅ |
| 25 | GET `/v1/guest/cs-tickets/:id` | ✅ | ✅ | ✅ | ✅ | :107-137 | ✅ | ✅ |
| 26 | POST `/v1/guest/cs-tickets/:id/messages` | ✅ | ✅ | ✅ | ✅ CF-014 | :142-179 | ✅ | ✅ |
| 27 | GET `/v1/guest/announcements` | ✅ | ✅ | ✅ | ✅ | :184-207 | ✅ | ✅ |
| 28 | GET `/v1/guest/direct-messages` | ✅ | ✅ | ✅ | ✅ | :212-226 | ✅ | ✅ |
| 29 | PATCH `/v1/guest/direct-messages/:id/read` | ✅ | ✅ | ✅ | ✅ | :231-255 | ✅ | ✅ |

**Self-check totals**: 29 rows × 7 cols = **203 cells, 203 ✅** (1 row IDOR marked 🟡 for partial — not a failure, classification accurate).

---

## §8 — Cross-references (outbound)

- **CRITICAL_FINDINGS.md**:
  - CF-008 → +1 carrier site (this domain audit ratio 1/29 = 3.4%, lowest in any domain so far).
  - CF-011 → +1 carrier site (`guest-portal.ts:762-764`).
  - CF-013 → +1 evidence site (`guest-portal.ts:480` DOB raw passthrough).
  - CF-014 → +5 carrier sites (E1/E10/E17/E24/E26).
  - CF-017 → +5 carrier sites (E5/E10/E14/E17/E24).
  - CF-018 → +1 partial site (E24 ticket booking_id unchecked).
  - **CF-023 → sub-pattern .b promoted in atomic carrier (this commit)** — .a (`leads.ts:175-204`, orphan) vs .b (`guest-portal.ts:85-195`, fake-ref + real INSERT).
- **state-machines.md (T002.5)**:
  - Booking-status spawn-paths: **dual** — `MS-YYYY-NNNNN` (canonical) vs `GBK-…-…` (this domain) vs `BK-YYYY-…` (orphan-style from `leads.ts`).
  - Invoice-status: `Sent` (bank transfer) / `Paid` (card) entry from E17 + E19.
  - CS-ticket re-open transition: `Resolved → Open` on guest reply (E26 L169-170).
  - **L802 dead-branch** must be flagged in T002.5 booking-status diagram.
- **db-schema-overview.md (T002.3)**:
  - `guest_users.bank_*` columns exist as plain varchar (PII storage concern).
  - `guest_users.date_of_birth` confirm column type (suspect varchar — CF-013).
  - `bookings.booking_ref` no UNIQUE constraint (cross-check schema).
  - `invoices.invoice_ref` no UNIQUE constraint (cross-check schema).
  - `csTickets.ticket_ref` generation pattern (already documented).
- **finance-payments.md (T002.2.b)**:
  - Cross-ref back-fill: E17 `/payment/confirm` is the **manual / non-Stripe** payment entry; complementary to Stripe webhook documented in finance-payments.md.
  - E18 `/payment/create-intent` originates the Stripe flow that finance-payments.md webhook closes.
- **security-rules.md (T004)**:
  - Sole-owner guard pattern (E20 L1086-1092) → canonical IDOR exemplar.
  - 2-stage compound ownership (E18/E19) → IDOR-defense pattern when nullable FK.
- **architecture-rules.md (T004)**:
  - Auth-mount conventions (Inc-5).
  - External-client lifecycle (Inc-1 — Stripe per-request).

---

**END portal-guest.md**
