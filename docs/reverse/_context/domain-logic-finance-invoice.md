# Finance Invoice 도메인 — 비즈니스 규칙 + 워크플로우 + 불변식

> **Sub-task**: T003 묶음 2 sub-task 1 (invoice + payment pair, 분할 (β) 채택). [domain-logic-finance-payment.md](./domain-logic-finance-payment.md) 와 짝.
> **Scope**: `invoices` 도메인의 5-state document lifecycle + Stripe webhook 이 일으키는 cross-state-policy 정책 분리 (CF-010 핵심 anchor) + helper-driven 자동생성 (`generateContractInvoicesAndSchedules`) cascade 수신 측.
> **Risk**: 🔴 P0. Triggering findings: [CF-001](../_audit/CRITICAL_FINDINGS.md#cf-001) (invoices.amount=numeric ✓ — 정밀 보존 측) / [CF-002](../_audit/CRITICAL_FINDINGS.md#cf-002) (precision loss chain 종착점 — `bookings.numeric → contracts.real → contract_line_items.unit_price → invoices.amount` 4-hop) / [CF-008](../_audit/CRITICAL_FINDINGS.md#cf-008) (invoice 5/10 = 50% endpoint audit; CF-022 측정 단위 차이 명확화 트리거) / [CF-010](../_audit/CRITICAL_FINDINGS.md#cf-010) (Stripe payment lifecycle ↔ invoice document lifecycle 분리 — repo 핵심 결합 손상) / [CF-011](../_audit/CRITICAL_FINDINGS.md#cf-011) (`nextInvoiceRef` row-count race — 3 generator factory 중 1) / [CF-018](../_audit/CRITICAL_FINDINGS.md#cf-018) (Sub-pattern B vertical-privilege-escalation: bulk-delete + permanent DELETE SuperAdmin 가드 2 sites) / [CF-019.a](../_audit/CRITICAL_FINDINGS.md#cf-019) (`stripe_payment_intent_id` write-orphan: webhook payload 만 audit, invoice 컬럼 미저장) / [CF-022](../_audit/CRITICAL_FINDINGS.md#cf-022) (transition-grain 2/3 = 67% gated; webhook bypass 시 1/3 = 33%).
> **Cross-domain effects**: ① upstream — contract C3 activate → helper §2.2 (`contracts.ts:55-237`) 가 `invoices` INSERT × N + recurring_schedules INSERT × M (이미 [domain-logic-contract.md §2.2](./domain-logic-contract.md#22-helper-generatecontractinvoicesandschedules-7-step-분해-contractsts55-237)). ② side — Stripe webhook (`stripe.ts:25-109`) 이 invoice.status 직접 UPDATE (manual `/pay` 가드 우회). ③ downstream — `domain-logic-finance-payment.md §1` payment audit-only payload 가 invoice id 참조.

---

## §0 PURPOSE & SCOPE

### §0.1 invoice 도메인의 두 정체성 (CF-010 핵심)

`invoices` 는 본 코드베이스의 **재무 단일 진실원 (single source of truth)** — invoices.status 가 "Paid" 면 결제 완료, "Sent"/"Draft" 면 미결, "Void"/"Archived" 면 취소. 그러나 status 를 변경하는 **3 source 가 정책이 서로 다름**:

| Source | trigger | source-state guard | file:line |
|--------|---------|--------------------|-----------|
| Manual `POST /v1/invoices/:id/send` | admin 수동 | `Draft` only ✓ | `invoices.ts:144-153` |
| Manual `POST /v1/invoices/:id/pay` | admin 수동 mark-as-paid | `Sent` only ✓ | `invoices.ts:155-167` |
| Manual `POST /v1/invoices/:id/void` | admin 수동 | (없음 — 어느 상태든) | `invoices.ts:169-179` |
| Stripe webhook `payment_intent.succeeded` | 자동 | **(없음 — bypass /pay 가드)** | `stripe.ts:55-57` |
| Stripe webhook `payment_intent.payment_failed` | 자동 | (audit log only — invoice 미변경) | `stripe.ts:73-78` |
| Stripe webhook `charge.refunded` | 자동 | (audit log only — invoice 미변경) | `stripe.ts:88-93` |
| `DELETE /v1/invoices/:id` (soft) | admin | (없음 — 어느 상태든) | `invoices.ts:139` |
| `POST /v1/invoices/bulk-delete` (soft) | SuperAdmin | (없음) | `invoices.ts:124` |

**정책 분리의 운영 함의** ([CF-010](../_audit/CRITICAL_FINDINGS.md#cf-010) 핵심): 동일한 "invoice → Paid" transition 이 **2 정책으로 갈라짐**:
- Manual `/pay` 는 Sent-only 가드로 안전 (Draft 또는 Void invoice 를 실수로 Paid 처리 차단).
- Stripe webhook 은 가드 없이 직접 UPDATE → **Draft / Void / Archived invoice 도 webhook 으로 Paid 된다**.

운영 시나리오: admin 이 invoice 를 Void 처리 (분쟁 종결) 후 Stripe payment_intent 가 늦게 succeed 되면 webhook 이 자동 Paid 로 되돌려 → invoice status = Paid 인데 계약상 Void 인 dual-truth 상태. audit log 는 두 transition 모두 기록되어 timeline 으로 발견 가능하나 데이터 자체는 webhook 이 우선.

### §0.2 In-scope / Out-of-scope

- **In**: invoices 5-state document lifecycle (Draft / Sent / Paid / Void / Archived), 3 manual transition + 3 webhook handler + 2 soft-delete handler 정책 차이, helper-driven 자동생성 수신 측, `nextInvoiceRef` factory race, `enrichInvoices` N+1 query, Stripe webhook 미처리 이벤트 (chargeback / dispute / partial refund).
- **Out**: payment-info / commissions / beneficiaries / accounts 4 lookup-style routes (→ [domain-logic-finance-payment.md](./domain-logic-finance-payment.md)), Stripe webhook 자체 인프라 (signature verification 등 → [_rules/security-rules.md] T004), invoice PDF 생성 / 이메일 송신 (→ T005 `_workflows/`).

---

## §1 비즈니스 규칙 (5 hard-coded constants + 5 transition + 3 webhook + 2 factory)

### §1.1 Money & default constants

| # | 규칙 | 식 | file:line | CF |
|---|------|----|-----------|-----|
| BR1 | invoice.amount default = 0 | `parsed.data.amount ?? 0` | `invoices.ts:76` | (CF-001 정밀 보존 ✓ — numeric col) |
| BR2 | invoice.currency default = "AUD" | `parsed.data.currency ?? "AUD"` | `invoices.ts:77` | 🟡 BR2↔booking BR6/contract BR4 동일 패턴 (CF-016 sister) |
| BR3 | invoice_ref 패턴 = `MS-INV-YYYY-NNNNN` | `MS-INV-${year}-${String(count).padStart(5, "0")}` | `invoices.ts:18` | 🟡 [CF-011](../_audit/CRITICAL_FINDINGS.md#cf-011) row-count race (3 generator 중 1) |
| BR4 | invoice helper-generated default status = "Pending" | `status: "Pending"` (helper 안 — `contracts.ts:152`/214) | `contracts.ts:152,214` | (helper §2.2 step (v)/(vi) 안) |
| BR5 | webhook /pay paid_at = `new Date()` (always now) | `paid_at: new Date()` | `stripe.ts:56` (vs manual `:158` `parsed.data.paid_at ?? new Date()` 옵션) | webhook 정책 차이 |

**도메인 의미**: BR4 "Pending" 은 **5-state 안에 없는 6th state** — helper 가 만든 invoice 는 처음부터 "Pending" 으로 들어가는데, manual 5-state lifecycle (Draft/Sent/Paid/Void/Archived) 에서 "Pending" 처리 정책 부재. /send 핸들러는 `Draft` 만 받음 (`invoices.ts:147`) → **helper 가 만든 "Pending" invoice 는 /send 호출 시 "Invoice not in Draft status" 400** 가능. T002.5 §3 invoice 5-state ground truth 와 helper 코드 모순 → **F10 신규 incidental 후보** (§5.3).

### §1.2 State-transition rules (BR6-BR10) — manual 측

| # | Transition | source state | target state | 가드 식 | file:line |
|---|------------|--------------|--------------|---------|-----------|
| BR6 | /send | Draft | Sent | `eq(status, "Draft")` ✓ | `invoices.ts:147` |
| BR7 | /pay | Sent | Paid | `eq(status, "Sent")` ✓ | `invoices.ts:161` |
| BR8 | /void | (any) | Void | (없음) | `invoices.ts:169-179` |
| BR9 | DELETE soft | (any) | Archived + deleted_at=now | (없음) | `invoices.ts:139` |
| BR10 | bulk-delete soft (SuperAdmin) | (any × N) | Archived + deleted_at=now × N | role guard (`:113-115`) | `invoices.ts:124` |

**transition-grain CF-022 측정**: 5 transition 중 2 gated (BR6, BR7) = **2/5 = 40%**. 그러나 /void + 2 soft-delete 는 의도된 무가드 (terminal sink) 로 볼 수 있어 **rejected-transition-grain** 으로는 2/3 = 67%. 두 측정 모두 valid → §5.4 spot-check 일치.

### §1.3 Stripe webhook handlers (BR11-BR13) — automatic 측

| # | event | invoice 변경 | audit log | source-state guard | file:line |
|---|-------|-------------|----------|--------------------|-----------|
| BR11 | `payment_intent.succeeded` | UPDATE status="Paid" + paid_at=now | ✓ PAYMENT | (없음 — **bypass BR7 manual 가드**) | `stripe.ts:51-67` |
| BR12 | `payment_intent.payment_failed` | (없음) | ✓ STATUS_CHANGE payload only | n/a | `stripe.ts:69-82` |
| BR13 | `charge.refunded` | (없음 — invoice.status 미변경) | ✓ STATUS_CHANGE payload only | n/a | `stripe.ts:84-97` |
| (default) | 그 외 모든 event | (없음) | ✗ (`console.log` 만) | n/a | `stripe.ts:99-100` |

**🔴 핵심 invariant 부재 1 (BR11 webhook bypass)**: webhook 은 invoice.status 의 source state 를 검사하지 않고 `WHERE id=invoiceId` 만으로 UPDATE → **어느 상태의 invoice 도 Paid 로 강제 가능** (Draft / Void / Archived 모두). [§0.1](#01-invoice-도메인의-두-정체성-cf-010-핵심) 정책 분리 시나리오 참조.

**🔴 핵심 invariant 부재 2 (BR13 refund 무처리)**: `charge.refunded` 발생 시 audit log 만 기록 + invoice.status 는 Paid 그대로 → **환불된 invoice 가 회계상 여전히 Paid** 으로 남음. dashboard 의 "Total revenue" 쿼리 (가설) 가 환불 금액 차감 안 함. **Phase 2 = `payment_events` 별도 entity** (CF-010 Option B) 가 invoice.status 보다 우선하는 truth 가 됨; 또는 invoice.status 에 "Refunded" 6th state 추가 + webhook UPDATE.

**🔴 핵심 누락 (default branch)**: 다음 Stripe 이벤트 handler **전무**:
- `charge.dispute.created` / `charge.dispute.closed` / `charge.dispute.funds_withdrawn` / `charge.dispute.funds_reinstated` (chargeback flow — 회계 critical)
- `charge.failed` (succeed 전 실패)
- `customer.subscription.*` (subscription 자체 미사용; 본 코드 invoice 는 subscription 기반 아님 → 무관 ✓)
- `invoice.*` (Stripe 자체 invoice 객체 사용 안 함; MillionStay invoice 는 별도 → 무관 ✓)

운영 시나리오: 고객 chargeback 제기 → Stripe 가 `charge.dispute.created` webhook 보냄 → handler 부재 → `console.log('Unhandled event type: charge.dispute.created')` 만 → invoice.status = Paid 그대로. **운영자는 Stripe Dashboard 외에 chargeback 발생 사실 모름**. 분쟁 대응 시간 손실 + funds_withdrawn 시점에도 회계 시스템 무반응. [F11 신규 incidental 후보](#53-r-repo-5-incidental-disposition).

### §1.4 Helper factories

| # | 규칙 | file:line | CF |
|---|------|-----------|-----|
| BR14 | `nextInvoiceRef()` row-count + 1 (race-prone) | `invoices.ts:13-19` | 🟡 [CF-011](../_audit/CRITICAL_FINDINGS.md#cf-011) generator 3 (booking + contract + invoice) |
| BR15 | `enrichInvoices(rows)` per-row N+1 query (booking + contract + account) | `invoices.ts:21-50` | 🟡 [CF-021](../_audit/CRITICAL_FINDINGS.md#cf-021) N+1 query 패턴 |

**도메인 의미**: BR14 race = 동시 invoice 생성 시 같은 ref 발급 가능 (UNIQUE index 가 caught 하지만 사용자 에러 raise). Phase 2 = DB sequence (`MS_INV_SEQ`) 또는 advisory lock. BR15 N+1 = `bookingIds.length + contractIds.length + accountIds.length` query 발생 (typically 3-9 query / page) — list endpoint 성능 저하. Phase 2 = JOIN 또는 batch IN-query. T002.2.b finance-invoicing.md §2.A.1 cross-ref.

---

## §2 워크플로우 (3 sub-flows)

### §2.1 5-state document lifecycle (manual 측)

```
[*] ──helper auto-create (Pending)──▶ Pending  [F10 — 5-state 외 stray]
[*] ──admin POST /v1/invoices──▶ Draft
Draft ──/send (BR6 ✓)──▶ Sent
Sent ──/pay (BR7 ✓ manual)──▶ Paid
Sent ──/pay (BR11 webhook bypass)──▶ Paid    [Stripe direct]
Draft ──/pay (BR11 webhook bypass)──▶ Paid   [⚠️ 정책 위반]
Void ──/pay (BR11 webhook bypass)──▶ Paid    [⚠️ dual-truth]
{any} ──/void (BR8)──▶ Void
{any} ──DELETE soft (BR9)──▶ Archived + deleted_at=now
{any × N} ──bulk-delete soft (BR10)──▶ Archived × N
```

[state-machines.md §3 Invoices](../_schema/state-machines.md#3-invoices-5-state) 의 `stateDiagram-v2` 와 일치 (단 helper "Pending" 6th state F10 추가).

**lifecycle 비대칭**: 5-state 중 forward 방향 (Draft→Sent→Paid) 만 가드; terminal sink (Void / Archived) 와 webhook 측은 무가드. 본 도메인은 invoices.status 라는 컬럼 1 개를 5 종류의 코드 경로에서 변경 — single column 정책의 2-sourced split 이 핵심 위험 (CF-010).

### §2.2 Stripe webhook flow + 미처리 이벤트

```
Stripe Event ──signature verify (stripe.ts:42)──▶ event 검증 OK?
  │
  ├── payment_intent.succeeded (BR11) ──▶ UPDATE invoice + audit PAYMENT
  ├── payment_intent.payment_failed (BR12) ──▶ audit STATUS_CHANGE only
  ├── charge.refunded (BR13) ──▶ audit STATUS_CHANGE only [invoice 미변경 ⚠️]
  └── default ──▶ console.log only [⚠️ chargeback/dispute 손실]
```

webhook 의 핵심 idempotency 메커니즘 = signature verification (`stripe.ts:42` `stripe.webhooks.constructEvent`) — Stripe 가 retry 시 동일 event 재전송하면 idempotent 하게 처리되어야 하지만, 현재 코드는 동일 invoice 를 다시 Paid 로 UPDATE (idempotent ✓ — Paid → Paid 무영향) + 동일 audit log 중복 기록 (audit duplication ⚠️). Phase 2 = event_id (`event.id`) 별 dedup table 권장.

### §2.3 helper-driven cascade 수신 (contract C3 activate trigger)

[contract §2.2 helper §2.2 step (v)/(vi)](./domain-logic-contract.md#22-helper-generatecontractinvoicesandschedules-7-step-분해-contractsts55-237) 에서:
- step (v) 가 recurring 마다 `db.insert(invoicesTable).values({status: "Pending", ...})` (`contracts.ts:152`)
- step (vi) 가 at_activation 마다 `db.insert(invoicesTable).values({status: "Pending", ...})` (`contracts.ts:214`)
- step (iv) 가 wipe 시 `db.delete(invoicesTable).where(and(contract_id, ne(status, "Paid")))` (`contracts.ts:122`)

**도메인 의미**:
- helper 가 만든 invoice 의 default status = "Pending" — manual lifecycle 5-state 외 [F10 incidental](#53-r-repo-5-incidental-disposition).
- "Pending" invoice 는 manual `/send` 의 가드 (`Draft only`) 에 거부됨 → **helper-generated invoice 는 운영자가 send 못 함** (DB 직접 수정 필요). 회계 운영 시나리오 단절.
- helper wipe 시 paid 보존 (CF-010 INV4) ✓ — 이미 결제된 invoice 만 보호; "Pending" / "Sent" 는 모두 wipe 가능.

---

## §3 불변식 (8 invariants)

| # | Invariant | 강제 site | 위반 시 동작 |
|---|-----------|-----------|------------|
| INV1 | /send 는 `Draft` 만 (BR6) | `invoices.ts:147` `eq(status, "Draft")` | 400 "Invoice not in Draft status" |
| INV2 | /pay manual 은 `Sent` 만 (BR7) | `invoices.ts:161` `eq(status, "Sent")` | 400 "Invoice not in Sent status" |
| INV3 | /void 는 source-state 가드 **없음** (BR8) | n/a | 임의 상태에서 Void 가능 |
| INV4 | bulk-delete 는 SuperAdmin 만 (BR10) | `invoices.ts:113-115` `currentUser?.role !== "SuperAdmin"` | 403 |
| INV5 | DELETE permanent 는 SuperAdmin 만 | `invoices.ts:134` | 403 |
| INV6 | Stripe webhook 은 `WHERE id` 만 (BR11) — source-state guard 없음 (manual /pay 와 정책 분리) | `stripe.ts:55-57` | 어느 상태든 Paid 강제 — CF-010 핵심 |
| INV7 | webhook signature verification 의무 | `stripe.ts:35-47` | 400 if missing/invalid signature ✓ |
| INV8 | helper auto-create invoice = "Pending" — manual 5-state 외 | `contracts.ts:152,214` | F10 incidental — manual /send 가드 거부 |

**INV3 의 함의**: /void 는 회계상 invoice 무효화 — Paid invoice 도 Void 가능 → audit log 에 PAYMENT (Sent→Paid) + STATUS_CHANGE (?→Void) 두 entry 남으나 invoice.status 자체는 Void. **dashboard 에서 "Total paid revenue" 가 Void invoice 도 합산하면 부정확**. 회계 보고 정확성에 critical (CF-001 sister).

**INV6 의 함의 (CF-010 핵심)**: webhook 과 manual 의 정책 분리 = **invoice.status column 의 단일 truth 가정 무너짐**. Phase 2 prescription = (a) webhook 에도 source-state guard 추가하여 정책 통일, (b) `payment_events` 별도 entity 로 결제 사실 기록 + invoice.status 는 manual 만 변경, (c) webhook bypass 를 의도로 명문화 + audit log 로만 추적. CF-010 Phase 2 Option A/B/C 와 정확히 일치.

**INV8 의 함의 (F10)**: helper 와 manual 의 status taxonomy 불일치 = **운영자가 helper 생성 invoice 를 send 하려면 DB 수동 UPDATE 필요** (Pending → Draft). Phase 2 = (a) helper 도 "Draft" 사용으로 통일, (b) "Pending" 을 6th state 로 명시 + /send 가드를 `["Draft", "Pending"]` 로 확장. T004 `_rules/financial-rules.md` 일괄.

---

## §4 Cross-domain effects 매핑

| 발신 transition | 수신 도메인 / 컬럼 | 효과 | 시점 | audit log |
|-----------------|-------------------|------|------|-----------|
| (외부) contract C3 activate | `invoices` INSERT × N (Pending) + `recurring_schedules` INSERT × M | helper §2.2 step (v)/(vi) | activate handler | helper 측 audit 부재 (CF-008 carrier) |
| (외부) contract C3 re-activate | `invoices` DELETE non-Paid + INSERT 재 | helper step (iv) → step (v)/(vi) | activate handler | invoice 측 audit 부재 |
| /send | `invoices` UPDATE status="Sent" | manual | /send handler | ✓ STATUS_CHANGE Draft→Sent (`:150`) |
| /pay manual | `invoices` UPDATE status="Paid" + payment_method + paid_at | manual | /pay handler | ✓ PAYMENT Sent→Paid (`:164`) |
| /void | `invoices` UPDATE status="Void" | manual | /void handler | ✓ STATUS_CHANGE *→Void (`:176`) |
| DELETE soft | `invoices` UPDATE deleted_at=now + status="Archived" | manual | DELETE handler | ✗ 부재 (CF-008 floor) |
| bulk-delete soft | `invoices` UPDATE deleted_at=now + status="Archived" × N | SuperAdmin | bulk handler | ✗ 부재 (CF-008 + CF-018) |
| webhook payment_intent.succeeded | `invoices` UPDATE status="Paid" + paid_at | Stripe | webhook | ✓ PAYMENT (`stripe.ts:62`) |
| webhook payment_intent.payment_failed | (없음) | Stripe | webhook | ✓ STATUS_CHANGE payload (`:77`) |
| webhook charge.refunded | (없음 — invoice 미변경) | Stripe | webhook | ✓ STATUS_CHANGE payload (`:91`) |
| webhook chargeback / dispute | (없음 — handler 부재) | Stripe | n/a | ✗ console.log only (F11 후보) |

**audit coverage matrix**:
- invoice 10 endpoint × audit = `/send` ✓ + `/pay` ✓ + `/void` ✓ + 3 webhook ✓ = **6/10 = 60% endpoint-grain** (단 webhook 3 은 별도 파일 `stripe.ts`)
- invoice 5 manual transition × audit = `/send` ✓ + `/pay` ✓ + `/void` ✓ = **3/5 = 60% transition-grain** (DELETE soft + bulk-delete soft = 무 audit)
- 두 측정 모두 "endpoint vs transition" 단위 차이로 다른 결과 → CF-008 [§5.4 spot-check C2](#54-3-claim-spot-check) 와 CF-008 본문 expansion (booking 26% vs 78% 명확화) 에서 동일 패턴.

---

## §5 Cross-references + Self-check

### §5.1 Cross-references

- State machine: [state-machines.md §3 Invoices](../_schema/state-machines.md#3-invoices-5-state) (5-state stateDiagram + Stripe sub-section).
- Schema: [db-schema-overview.md §1.4 Finance cluster](../_schema/db-schema-overview.md) — `invoices` 19-col + amount=numeric (CF-001 ✓).
- ERD: [erd-core.md §6 Finance cluster](../_schema/erd-core.md).
- Endpoints: [api-endpoints/finance-invoicing.md](../_schema/api-endpoints/finance-invoicing.md) (17 endpoints incl. stripe.ts handlers, 681 lines).
- Money: [MONEY_AUDIT.md](../_audit/MONEY_AUDIT.md) — 41 money cols, invoice amount ✓ numeric (정밀 보존 측).
- Contract upstream: [domain-logic-contract.md §2.2 helper](./domain-logic-contract.md#22-helper-generatecontractinvoicesandschedules-7-step-분해-contractsts55-237).
- Payment pair: [domain-logic-finance-payment.md](./domain-logic-finance-payment.md) (T003 묶음 2 sub-task 2 — payment-info / commissions / beneficiaries / accounts 4 lookup-style routes).
- Phase 2 CF-010 Option A/B/C: T004 `_rules/financial-rules.md` (일괄).

### §5.2 R-REPO-7 Trade-off (3개 결정)

| # | 결정 | 채택 | 미채택 | 이유 |
|---|------|------|--------|------|
| 1 | 5-state vs 6-state (helper "Pending" 포함) | 5-state mainline + F10 incidental + Pending 별도 표기 | (a) 6-state 통합 / (b) Pending 무시 | T002.5 §3 ground truth (5-state) 와 일관성 + helper 코드 ground truth (Pending) 모두 보존 → F10 등재. |
| 2 | Stripe webhook 표기 | invoice 도메인 안 §1.3 + §2.2 (CF-010 핵심으로 본 도메인 핵심) | payment 도메인 분리 / 별도 sub-doc | webhook 은 invoice.status 직접 변경 → invoice 도메인 본질적; payment 도메인 (payment-info CRUD) 와 무관. T002.5 §4.5 Stripe sub-section 도 invoice 본체에 종속 패턴 일치. |
| 3 | INV3 (/void 무가드) 분류 | 단순 INV (의도된 sink) + §4 cross-domain 표 entry | "신규 P1 promotion 후보" / CF-022 carrier 강조 | terminal sink 는 의도된 무가드 — manual /pay 와 webhook 의 정책 split (BR11/INV6) 이 더 critical → CF-022 carrier 는 INV6 측에 집중. |

### §5.3 R-REPO-5 Incidental disposition

- **F10 신규 incidental** (memo only, no promotion): helper auto-create invoice = "Pending" (5-state 외 6th label). manual /send 가드 (`Draft only`) 와 충돌 → helper-generated invoice 는 운영자 send 불가. T004 `_rules/financial-rules.md` "invoice status taxonomy 통일" 일괄 처리. 코드 file:line: `contracts.ts:152` (recurring) + `contracts.ts:214` (at_activation).
- **F11 신규 incidental** (memo only, no promotion): Stripe webhook chargeback / dispute 미처리 — `charge.dispute.created/closed` handler 부재 + default branch `console.log` 만 → 분쟁 발생 시 운영 시스템 무반응. CF-010 Phase 2 Option B `payment_events` 가 cover; T004 `_rules/financial-rules.md` "Stripe event handler completeness" 일괄.
- **CF-008 evidence 명확화** (T002.2.j booking 26% vs T003 묶음 1 booking 78% 두 측정 단위 차이): T002.2.j `booking.md §4` = **logAction call site / total endpoint 27 = 7/27 = 26%** (endpoint-grain); T003 묶음 1 `domain-logic-booking.md §4` = **logAction call site / state-transition 9 = 7/9 = 78%** (transition-grain). 둘 다 valid + 단위 다름. CRITICAL_FINDINGS.md CF-008 본문에 두 측정 단위 표기 명확화 (atomic commit 일부 — §6.3).

### §5.4 3-claim spot-check

| # | Claim | 검증 방법 | 결과 |
|---|-------|-----------|------|
| C1 | INV6 webhook bypass — Stripe webhook (`stripe.ts:55-57`) 가 source-state guard 없이 invoice.status="Paid" UPDATE | `sed -n 55,57p stripe.ts` + manual `/pay` (`invoices.ts:155-167`) 의 `eq(status, "Sent")` (`:161`) 비교 | ✅ webhook = `eq(invoicesTable.id, invoiceId)` only / manual = `and(eq(id), eq(status, "Sent"))` — 가드 정책 split 정확. CF-010 핵심 anchor 확정. |
| C2 | CF-008 booking 26% vs 78% 두 측정 단위 차이 — endpoint-grain (7/27) vs transition-grain (7/9) | T002.2.j booking.md §4 carrier 표 (logAction call site 7개 endpoint) + T003 booking §1.2 BR8-BR12 가드 5 + nested 4 = 9 transition + carrier 7개 audit | ✅ 두 측정 모두 정확 (carrier 7 동일, 분모만 다름) — endpoint vs transition 단위 split. CRITICAL_FINDINGS.md CF-008 본문 명확화 필요 ✓. |
| C3 | F10 (helper "Pending" 5-state 외) — `contracts.ts:152` (recurring) + `:214` (at_activation) 가 status="Pending" insert + invoices.ts /send 가드 `Draft only` (`:147`) 충돌 | `sed -n 150,155p contracts.ts` + `sed -n 212,216p contracts.ts` + `sed -n 144,150p invoices.ts` | ✅ helper 두 site 모두 `status: "Pending"` 정확 + /send 가드 `eq(status, "Draft")` 정확 → helper-generated invoice 는 manual /send 거부 정확. F10 anchor 확정. |

3/3 spot-check ✅. webhook bypass + CF-008 측정 단위 차이 + F10 helper "Pending" 모두 file:line 정확.

---

**T003 묶음 2 sub-task 1 (invoice) — 본문 + self-check 완료. 다음: payment 본문 (NNNNN-payment) → 묶음 통합 self-check + atomic carrier (PPPPP-payment) → 묶음 통합 보고 (QQQQQ).**
