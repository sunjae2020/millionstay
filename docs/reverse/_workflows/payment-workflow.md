# Payment Workflow

> ✅ **T005-REWRITE** 2026-04-27 (T001 시점 136L T001-VERIFIED → 본 152L; T002 finance-invoicing.md + finance-payments.md + state-machines.md §4-4.5 + T003 _context/domain-logic-finance-{invoice,payment}.md 530L + T004 _rules/financial-rules.md 168L + CF-010 본문 재작성).
> **상위 source**: `_schema/state-machines.md §4` invoice 5-state + `§4.5` Stripe sub-section / `_context/domain-logic-finance-invoice.md` (BR1-BR15 + Stripe webhook flow) / `_audit/CRITICAL_FINDINGS.md` CF-010.
> **Cross-ref**: booking-lifecycle.md §2 (S2 cascade) + agent-commission-workflow.md §2 (commission 지급) + maintenance-workflow.md §1 (work_orders → invoice 생성 부재).

---

## §1 INVOICE DOCUMENT LIFECYCLE — 5-state (CF-022 67% manual carrier)

```
Draft → Sent → Paid → Archived
              ↑       ↑
              └ Void ─┘  (any state)
```

**Manual transition gates** (`invoices.ts §5-state machine`):
- /send precondition `eq(status,"Draft")` — `invoices.ts:147` 단일 가드
- /pay precondition `eq(status,"Sent")` — `invoices.ts:155-167`
- /void = no precondition (any → Void; INV3 무가드)

**helper "Pending" 6th label outlier** (F10 no-magic-rules §5.2): `contracts.ts:152,214` helper-generated invoice 시점 `status="Pending"` (5-state 외) → 운영자 `/send` 가드 (`Draft only`) 충돌 → helper-invoice 운영자 send 불가. Phase 2 enum 통일.

---

## §2 STRIPE WEBHOOK (CF-010 lifecycle 분리 — T002.5 본문 재작성)

`stripe.ts:55-100` switch 4-case:

| event | invoice 본체 영향 | system_logs payload | CF |
|-------|------------------|---------------------|----|
| `charge.succeeded` | UPDATE invoices SET status="Paid" + paid_at (`:55-57` **NO source-state guard** = bypass) | logAction(`payment | charge.succeeded`) | CF-010 + CF-022 |
| `payment_intent.payment_failed` | UPDATE 부재 (audit-only) | logAction(`payment | failed`) | CF-010 |
| `charge.refunded` | UPDATE 부재 (audit-only) | logAction(`payment | refunded`) | CF-010 |
| default (chargeback / dispute) | `console.log` only — 실제 핸들 부재 (F11) | 미발급 | F11 financial-rules §4.3 |

**CF-022 양극단 anomaly** (단일 entity 안 정책 split):
- Manual /pay = `eq(status,"Sent")` precondition (gated 67%)
- Webhook charge.succeeded = no source-state guard (bypass 0%) → Draft/Void invoice 도 "Paid" 진입 가능

**Phase 2 통일 prescription** (financial-rules §4.2): webhook 도 source-state guard 추가 + Option B `payment_events` 별도 entity (CF-010 Phase 2) → invoice document lifecycle 와 Stripe payment lifecycle 분리.

---

## §3 CONTRACT ACTIVATE TRIGGER — 7-step helper (사용자 가설 contract-activate scope 흡수)

`POST /api/v1/contracts/:id/activate` (`contracts.ts:429`) → `generateContractInvoicesAndSchedules(contractId)` (`contracts.ts:55-237`) 7-step (i)-(vii):

1. (i) precondition `eq(contract_status,"Signed")` (T001-VERIFIED + T002.2.a confirmed)
2. (ii) `db.delete(invoices) WHERE contract_id=? AND status NOT IN paidKeys` — 미수 invoice 삭제 (idempotency 위해 author 명시; "partial failure 가능" tell)
3. (iii) `db.delete(payment_schedules) WHERE contract_id=?`
4. (iv) FOR i in 1..months: INSERT invoices (line items per contract_products) — 12-mo contract = 12 invoice + 12*N line_items
5. (v) FOR i in 1..months: INSERT payment_schedules
6. (vi) UPDATE contracts SET contract_status="Active"
7. (vii) UPDATE bookings SET booking_status="Active" (cross-side write)

**합계**: ≥27 sequential mutation per 12-mo contract / ZERO db.transaction (`contracts.ts:55-237` 검증 — Tx 부재). 부분 failure 시 silent dual-billing 시나리오 발생 가능 (CF-014 max carrier).

**Safety limit** `contracts.ts:158-160`: 500-iteration cap (BR3 financial-rules §1) — 41-year contract 까지 안전.

---

## §4 CROSS-REF + Phase 2

- booking-lifecycle.md §2 — S2 cascade trigger
- agent-commission-workflow.md §2 — commissions=real CF-001 양극단
- maintenance-workflow.md §1 — work_orders → invoice 자동생성 부재 (현재 DB write only)
- promotion-application-logic.md §2 — `contract_products.effective_weekly_rate` cache feeds invoice line items

**Phase 2 종합** (financial-rules §4): (1) helper 7-step transaction wrap / (2) webhook source-state guard 통일 / (3) `payment_events` 별도 entity (Stripe lifecycle) / (4) F10 helper "Pending" → 5-state enum 정합 / (5) F11 chargeback/dispute event 핸들 / (6) `stripe_payment_intent_id` orphan column write 검토 (CF-019.a) / (7) audit log 정책 통일 invoices 80% → contracts 71% → payment 0% gap 닫기 (CF-008).

---

## §5 자가 검증 (3 spot-check ✅)

- C1 `stripe.ts:55-57` no source-state guard vs `invoices.ts:155-167` `eq(status,"Sent")` (CF-022 split anomaly)
- C2 `contracts.ts:55-237` ≥27 mutation count + `db.transaction` 0 hits (CF-014 helper line-by-line)
- C3 F11 `stripe.ts:99-100` default `console.log` only — chargeback/dispute event 미핸들
