# Audit Log Template

## 1. The helper

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

## 2. Mandatory log points

| Domain | Action | Action code | Old | New |
|---|---|---|---|---|
| booking | create | `CREATE` | — | full row |
| booking | status change | `STATUS_CHANGE` | `{status}` | `{status, reason?}` |
| booking | cancel | `STATUS_CHANGE` | full row | `{status:'Cancelled', reason}` |
| invoice | send | `STATUS_CHANGE` | `{status:'Draft'}` | `{status:'Sent'}` |
| invoice | pay | `PAYMENT` | `{status:'Sent'}` | `{status:'Paid', method, paid_at}` |
| invoice | void | `STATUS_CHANGE` | `{status}` | `{status:'Void'}` |
| invoice | edit (after add of immutability check) | `UPDATE` | full row | full row |
| contract | send/sign/activate/terminate/expire | `STATUS_CHANGE` | `{status}` | `{status}` |
| contract | schedule add/update/delete | `SCHEDULE_*` | row | row |
| space | block | `BLOCK` | — | `{date_range}` |
| space | unblock | `UNBLOCK` | `{date_range}` | — |
| widget (template) | create/update/delete | as above | as above | as above |

## 3. Patterns to AVOID

- ❌ **Logging the entire Drizzle row including `password_hash`.** Always strip sensitive fields.
- ❌ **Logging outside the transaction.** Always pass `tx` so log is rolled back if the main mutation fails.
- ❌ **Free-text `action` strings.** Use the enum-style constants in the code; otherwise reporting becomes guesswork.
- ❌ **Logging reads.** Audit is for state changes, not page-views (use a separate access-log table for that).

## 4. PII redaction helper

```ts
function redact<T extends Record<string, any>>(row: T): T {
  const SENSITIVE = ["password_hash", "reset_token", "bank_account_number", "passport_number"];
  return Object.fromEntries(
    Object.entries(row).filter(([k]) => !SENSITIVE.includes(k)),
  ) as T;
}
// Use as: new_value: redact(updated)
```

## 5. Backfill checklist (for currently-unlogged areas)

- [ ] `routes/work-orders.ts` — every CRUD + status change
- [ ] `routes/cs-tickets.ts` — create / reply / close
- [ ] `routes/accounts.ts`, `routes/contacts.ts` — every CRUD
- [ ] `routes/promotions.ts` — every CRUD
- [ ] `routes/marketing-consents.ts` — opt-out / opt-in
- [ ] `routes/admin-users.ts` — role change, deactivation
- [ ] `routes/auth.ts` — password reset success (already logs failed login attempts to `login_attempts`)

## 6. Data retention on `system_log`

System logs grow forever today. Define a retention window:

| Tier | Retention |
|---|---|
| Privacy / consent / NDB-relevant | 7 years (Privacy Act guidance) |
| Financial state changes | 7 years (ATO) |
| Other (reads, generic CRUD) | 2 years |

Implement as a scheduled job that moves old rows to a cold table or hard-deletes per category.
