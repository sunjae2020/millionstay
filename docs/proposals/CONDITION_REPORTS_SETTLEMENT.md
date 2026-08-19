---
status: live
domain: 문서발행
last_verified: 2026-08-19
---

# Condition Reports & Deposit Settlement (Phase 2 — 입·퇴실 증빙/합의)

**Status:** Draft / in progress
**Owner:** Ops + Eng
**Scope:** Metheim vision "합의(Consensus) + 증빙(Evidence)" 축 — move-in condition
onboarding, tenant agree/dispute, move-out image comparison, damage
adjudication, deposit deduction/refund.

This is the single biggest gap in the Metheim lifecycle: **stage 2 (입실 온보딩)
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


---

## 부록. 보증금 출처 표기 + 회수 인보이스 (2026-08-19)

정산 확인서 본체(비고 열·환급 라인·점검표 세트 발행)는 이미 적용돼 있고, 여기서는
**돈의 출처와 회수**를 보강한다.

### 보증금(B)은 실납부가 계약상 금액을 이긴다

| 스파인 | 1순위 | 2순위 |
| --- | --- | --- |
| 예약 | 납부된 보증금 인보이스 라인(`line_type='deposit'` + `Paid`) / 홈스테이 upfront | `contracts.bond_amount` → `bookings.deposit_amount` |
| 계약 | 납부된 보증금 인보이스 라인(`invoices.contract_id` 기준) | `contracts.bond_amount` |

읽은 출처는 `deposit_settlements.deposit_source`에 남는다. `invoice`·`placement`만
2100에 실재하므로 finalize의 GL 상계도 그때만 일어난다(계약상 금액은 GL 미전기 —
환급은 운영 처리). 이 구분이 없으면 **받은 적 없는 보증금을 환급 처리**할 수 있다.

### C가 마이너스일 때

`C = B − A`가 마이너스면 보증금으로 못 메운 금액을 임차인에게 청구해야 한다.
`POST /v1/deposit-settlements/:id/invoice`가 부족분만큼 인보이스를 만들고
(`deposit_settlements.invoice_id`로 연결), 입금 확인은 기존 인보이스 Paid 흐름을
그대로 탄다. 확인서 PDF의 C 행도 마이너스면 붉은 −로 찍힌다.

**이중계상 방지:** finalize의 수익 leg를 `deposit_held − refund_amount`(보유 보증금
한도)로 자른다. 종전에는 `total_deducted` 전액을 수익으로 돌려, 차감이 보증금을 넘는
순간 차·대변이 맞지 않았다(초과분의 수익은 회수 인보이스가 잡는다).

### 화면

계약 상세 → 임대료 원장 탭 하단에 예약과 같은 정산 패널(`DepositSettlementPanel
scope="contract"`)이 붙는다. 보증금 출처, 부족분 경고, **회수 청구서 발행** 버튼을
함께 노출한다.

### 마이그레이션

`lib/db/drizzle/0062_deposit_settlement_source_invoice.sql` (additive-only):
`deposit_settlements.deposit_source`, `deposit_settlements.invoice_id`.
