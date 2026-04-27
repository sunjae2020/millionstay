# Audit Log Template

> ✅ **T007-REWRITE** 2026-04-27 — T002~T006 자산 통합. CF-008 9-domain matrix anchor. CF anchor: CF-008 (audit log absence — repo 75% 도메인이 audit-blind, 6-way TIE at 0% floor) + CF-014 (audit insert outside transaction = 부분 실패 시 ghost log) + CF-022 (state transition 시점 audit 누락).

## 1. The helper (현재 구현 — `lib/audit.ts`)

```ts
// artifacts/api-server/src/lib/audit.ts
import { db, systemLog } from "@workspace/db";

export interface LogActionInput {
  entity_type: "booking" | "contract" | "invoice" | "space" | "account" | "widget" | string;
  entity_id:   number;
  action:      "CREATE" | "UPDATE" | "STATUS_CHANGE" | "PAYMENT" | "BLOCK" | "UNBLOCK" | string;
  actor_type?: "User" | "System";
  actor_id?:   number | null;
  actor_email?: string | null;
  old_value?:  unknown;
  new_value?:  unknown;
  ip_address?: string | null;
  user_agent?: string | null;
}

export async function logAction(txOrDb: typeof db, input: LogActionInput) {
  await txOrDb.insert(systemLog).values({
    actor_type: "User",
    ...input,
    old_value: input.old_value ? JSON.stringify(input.old_value) : null,
    new_value: input.new_value ? JSON.stringify(input.new_value) : null,
    created_at: new Date(),
  });
}
```

## 2. CF-008 도메인 매트릭스 (T003 묶음 4 final 9-domain ranking — `_rules/security-rules.md` §10 cross-ref)

| 순위 | Domain | logAction coverage | endpoints | floor/leader |
|------|--------|-------------------|-----------|--------------|
| #1 | booking | 78% (transition-grain 7/9) / 26% (endpoint-grain 7/27) | 27 ep | leader (cross-pack #1) |
| #2 | contract | 71% (transition-grain 5/7) | 28 ep | #2 |
| #3 | finance-invoice | 60% (3/5 manual transition) | 26 ep | #3 |
| #4 | portal-guest | 3.4% (1/29 = 도메인 lowest) | 29 ep | low |
| #5-#10 | **6-way TIE at 0% floor** (`admin` + `payment` + `catalog` + `property` + `crm` + `portal-partner` + `public`) | **0/175 ep audit-blind** | 175 ep | **75% 도메인 floor** |

→ **Phase 2 audit 정책 baseline** = 6 도메인 일괄 backfill (175 ep mass-application). T004 `_rules/architecture-rules.md` §6 + `_rules/security-rules.md` §10 일괄 처리. CF-014 POSITIVE EXEMPLAR `dev-migration.ts:38-66` SAVEPOINT (3 known production runtime Tx site final).

## 3. Mandatory log points (state-changing operations)

| Domain | Action | Action code | Old | New | CF anchor |
|---|---|---|---|---|---|
| booking | create | `CREATE` | — | full row | CF-008 leader |
| booking | status change | `STATUS_CHANGE` | `{status}` | `{status, reason?}` | CF-022 9/9 leader |
| booking | cancel | `STATUS_CHANGE` | full row | `{status:'Cancelled', reason}` | CF-022 |
| invoice | send | `STATUS_CHANGE` | `{status:'Draft'}` | `{status:'Sent'}` | CF-022 manual ✓ |
| invoice | pay (manual) | `PAYMENT` | `{status:'Sent'}` | `{status:'Paid', method, paid_at}` | CF-022 manual ✓ |
| invoice | pay (Stripe webhook) | `PAYMENT` | — (CF-022 split) | `{status:'Paid'}` | **CF-010 webhook bypass** — no source-state guard at `stripe.ts:55-57` |
| invoice | void | `STATUS_CHANGE` | `{status}` | `{status:'Void'}` | CF-022 0/3 floor |
| contract | send/sign/activate/terminate/expire | `STATUS_CHANGE` | `{status}` | `{status}` | CF-022 0% floor |
| space | block / unblock | `BLOCK` / `UNBLOCK` | — / `{date_range}` | `{date_range}` / — | CF-014 N-DELETE |

## 4. Patterns to AVOID (CF-014 / CF-008 / privacy)

- ❌ **logAction outside transaction** = `system_log` 행만 살아남고 main mutation 롤백 시 ghost log 발생. CF-014 max carrier (helper `generateContractInvoicesAndSchedules` ≥27 mutation 0 db.transaction = `contracts.ts:55-237`).
- ❌ **Logging `password_hash` / `bond_account_number` / `passport_number`** raw — §5 redact 헬퍼 사용.
- ❌ **Free-text `action` strings** = 보고 불가능 → enum 상수 사용.
- ❌ **Logging reads** = audit 가 page-view 로그로 변질. 별도 access-log 테이블 분리.

## 5. PII redaction helper (CF-013 PII text 형식 보강)

```ts
function redact<T extends Record<string, any>>(row: T): T {
  const SENSITIVE = ["password_hash", "reset_token", "bank_account_number", "passport_number", "dob", "visa_number"];
  return Object.fromEntries(
    Object.entries(row).filter(([k]) => !SENSITIVE.includes(k)),
  ) as T;
}
// Use as: new_value: redact(updated)
```

## 6. Backfill checklist (6-way TIE at 0% audit floor — Phase 2 mass backfill)

- [ ] **admin** (37 ep, 18-20 mutator audit-blind; admin = audit data CONSUMER but blind for own mutations — inverse-correlation reversal twist)
- [ ] **payment** (4 routes / 24 ep / 0% — `payment_info.ts` DELETE always permanent + `commissions.ts` no audit)
- [ ] **catalog** (9 routes / 39 ep / 0%)
- [ ] **property** (6 routes / 44 ep / 0% — spaces lifecycle audit 부재)
- [ ] **crm** (5 routes / 51 ep / 0% — `tasks.ts` polymorphic FK orphan F15)
- [ ] **portal-partner** (22 ep / 0%)
- [ ] **public** (CF-024 OPEN POST 12 ep audit 부재 — lead 생성 0 trail)
- [ ] **portal-guest** 보강 (1/29 → 100%; sole-owner E20 가시성 변경 audit)

## 7. Data retention on `system_log` (Phase 2 정책)

| Tier | Retention | 근거 |
|---|---|---|
| Privacy / consent / NDB-relevant | 7 years | Privacy Act guidance |
| Financial state changes | 7 years | ATO |
| Other (reads, generic CRUD) | 2 years | 운영 |

→ Scheduled job (cold table 이동 또는 카테고리별 hard-delete). 현재 retention 정책 0 → 무한 증가.
