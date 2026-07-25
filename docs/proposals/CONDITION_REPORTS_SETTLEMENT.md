# Condition Reports & Deposit Settlement (Phase 2 — 입·퇴실 증빙/합의)

**Status:** Draft / in progress
**Owner:** Ops + Eng
**Scope:** MetHeim vision "합의(Consensus) + 증빙(Evidence)" 축 — move-in condition
onboarding, tenant agree/dispute, move-out image comparison, damage
adjudication, deposit deduction/refund.

This is the single biggest gap in the MetHeim lifecycle: **stage 2 (입실 온보딩)
and stage 5 (퇴실/정산) have no schema, API, or UI today.** The billing/GL,
e-sign tamper-evidence, and booking spine already exist and are reused verbatim.

---

## 1. Design principles (grounded in existing code)

1. **Attach to `bookings.id`, not to homestay/short-term forks.** A booking
   already carries `space_id`, `account_id` (tenant), `check_in_date`,
   `check_out_date`, `room_type`, `contract_term`. `homestay_placements.booking_id`
   links placements to the same spine. → One condition-report system covers
   **Homestay / Short-term / Long-term** with a `phase` discriminator, satisfying
   the cross-product policy (`docs/CROSS_PRODUCT_FEATURE_POLICY.md`).
2. **Reuse the e-sign tamper-evidence pattern** from
   `contract_signing_requests` (`content_hash` sha256 + `signed_snapshot` freeze +
   append-only `audit_trail`). At **publish** and at **tenant response**, freeze a
   snapshot + hash so the agreed-upon state is immutable — this is the "증빙" fix
   the audit flagged as missing on field photos/tickets.
3. **Hash every photo.** `booking_service_photos` today stores only
   `created_at`/`uploaded_by` — no integrity. New condition photos carry
   `content_hash` (sha256 of bytes) + `taken_at`, closing the anti-tamper gap.
4. **Reuse deposit accounting.** Deposits already post to the *Deposits Held*
   liability (invoices `line_type='deposit'`, GL H-402). Move-out settlement
   posts a **reversal + refund** invoice; no new GL primitives.
5. **Money = numeric = string** (Drizzle). Wrap writes in `String()`, reads in
   `Number()`.

---

## 2. Data model (additive, `0001+` numbering, no `manual_*.sql`)

### `condition_reports` — one per (booking, phase)
| col | type | notes |
|---|---|---|
| id | serial pk | |
| report_ref | text unique | e.g. `CR-2026-00001` |
| booking_id | integer notNull | the spine |
| phase | text notNull | `move_in` \| `interim` \| `move_out` |
| status | text notNull default `draft` | `draft` → `published` → `tenant_agreed` \| `disputed` → `finalized` |
| title / summary | text | admin notes / 특이사항 요약 |
| created_by | integer | admin users.id |
| published_at | timestamptz | when tenant becomes able to view/respond |
| tenant_responded_at | timestamptz | |
| finalized_at | timestamptz | |
| content_hash | text | sha256 of published snapshot |
| published_snapshot | jsonb | frozen item set at publish `{ items, capturedAt }` |
| audit_trail | jsonb default `[]` | append-only `[{event, at, actor, ip, ...}]` |
| created_at / updated_at | timestamptz | |

### `condition_report_items` — per facility/area
| col | type | notes |
|---|---|---|
| id | serial pk | |
| condition_report_id | integer notNull | |
| area_key | text | `door`\|`floor`\|`living`\|`kitchen`\|`bathroom`\|`balcony`\|`other` |
| label | text notNull | display name |
| description | text | admin 특이사항 |
| condition_rating | text | `good`\|`fair`\|`damaged` (optional) |
| sort_order | integer default 0 | |

### `condition_report_photos` — evidence, hashed
| col | type | notes |
|---|---|---|
| id | serial pk | |
| condition_report_id | integer notNull | |
| item_id | integer | nullable — report-level photos allowed |
| file_url / thumbnail_url / cloudinary_id | text | Cloudinary |
| caption | text | |
| content_hash | text | **sha256 of bytes — anti-tamper** |
| taken_at | timestamptz | |
| uploaded_by_type | text notNull | `admin` \| `tenant` |
| uploaded_by_id | integer | |
| created_at | timestamptz | |

### `condition_report_responses` — tenant per-item agree/dispute
| col | type | notes |
|---|---|---|
| id | serial pk | |
| item_id | integer notNull | |
| decision | text notNull | `agreed` \| `disputed` |
| comment | text | tenant explanation |
| responded_at | timestamptz | |
| (dispute photos → `condition_report_photos` with `uploaded_by_type='tenant'`) | | |

### `deposit_settlements` — move-out only (2B)
| col | type | notes |
|---|---|---|
| id | serial pk | |
| booking_id | integer notNull | |
| move_out_report_id | integer | the `phase=move_out` condition_report |
| deposit_held | numeric(10,2) | snapshot of placement/booking deposit |
| total_deducted | numeric(10,2) default 0 | |
| refund_amount | numeric(10,2) | held − deducted |
| status | text notNull default `draft` | `draft`→`proposed`→`tenant_ack`→`finalized`→`refunded` |
| refund_invoice_id | integer | reversal/refund invoice |
| audit_trail | jsonb | append-only |

### `deposit_deduction_items` — line-item damage charges (2B)
| col | type | notes |
|---|---|---|
| id | serial pk | |
| deposit_settlement_id | integer notNull | |
| condition_item_id | integer | evidence link |
| description | text notNull | |
| amount | numeric(10,2) notNull | |
| photo_ids | jsonb | before/after evidence refs |

---

## 3. API surface

**Admin** (`requireAuth`, RBAC gate TBD once Phase 1 lands):
- `POST /api/v1/bookings/:id/condition-reports` — create draft (phase)
- `POST /condition-reports/:id/items` / photo upload (`content_hash` computed server-side)
- `POST /condition-reports/:id/publish` — freeze snapshot + hash, status→published, notify tenant
- `GET  /condition-reports/:id` — admin review (see disputes)
- `POST /condition-reports/:id/finalize`

**Tenant** (`requireGuestAuth`, scoped to own booking):
- `GET  /api/v1/portal/bookings/:id/condition-reports` — list/view published
- `POST /condition-report-items/:id/respond` — `agreed` | `disputed` (+comment, +photos)
- report auto-transitions `tenant_agreed` (all agreed) or `disputed` (any dispute)

**Move-out settlement (2B):** admin builds `deposit_settlements` from the
`move_out` report + `move_in` baseline (side-by-side image compare UI), tenant
acknowledges, finalize posts the refund invoice reversing Deposits Held.

---

## 4. Phasing

- **2A — Move-in condition report + consensus (this cut).** Schema (reports/
  items/photos/responses) + admin create/publish/review + tenant view/agree/
  dispute + photo hashing + i18n (en source → ja/ko/th/vi/zh). Delivers 합의 +
  증빙 for stage 2.
- **2B — Move-out settlement.** `phase=move_out` reuses 2A; adds
  `deposit_settlements`/`deduction_items`, baseline↔final image compare, deposit
  deduction/refund + GL reversal. Stage 5.
- **2C — Notice / extension-termination (tenant-side).** Notice period (2/4wk),
  tenant extend/terminate request feeding the existing admin `/extend`.

---

## 5. Reused assets (no rebuild)
- `contract_signing_requests` — tamper-evidence pattern (hash/snapshot/audit).
- `bookings` — operational spine (dates, tenant, space, product class).
- `invoices` + `lib/billing/gl.ts` (H-402 Deposits Held) — deposit accounting.
- Cloudinary upload path from `guest-cs.ts` / `partner-cs.ts` (10MB image up).
- `utils/auditLog.ts` `logAction` → `system_logs` — action audit.

## 6. Open decisions
- **Baseline for damage compare:** move-in report photos are authoritative; if a
  booking has no move-in report, move-out proceeds without baseline (flagged).
- **Deposit source of truth for 2B:** `homestay_placements.deposit` vs
  booking-level bond — resolve when 2B starts.
- **RBAC:** publish/finalize should be gated once Phase 1 RBAC exists; interim,
  gate behind existing admin auth.
