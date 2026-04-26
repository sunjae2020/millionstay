# Agent Commission Workflow

> ⚠️ **NEEDS REVISION** — see `docs/reverse/_audit/T001_RECON_REPORT.md` §g for specific corrections required. Will be rewritten in T002–T007 when its domain folder is processed.


## 1. Agent ↔ booking link

- An agent is a `partner_users` row with `portal_type = "agent"`.
- An agent's account is linked to bookings via `bookings.agent_account_id` (set at booking creation, either by the admin or by the agent through the agent portal).
- When the agent logs in, `GET /v1/agent/bookings` filters by `eq(bookingsTable.agent_account_id, partnerUser.account_id)`.

## 2. Commission calculation

```ts
// routes/agent-portal.ts:251 — earnings query
const earned = commission?.commission_type === "Percentage" && commission.commission_rate
  ? rentAmount * (commission.commission_rate / 100)
  : commission?.commission_amount ?? 0;
```

| Field | Source |
|---|---|
| `rentAmount` | `bookings.total_rent` (snapshotted at booking creation) |
| `commission` | from `commissions` table — typically `accounts.default_commission_id` for the agent account |
| `Percentage` | `rate × rentAmount / 100` |
| `Fixed` | flat AUD per booking, regardless of rent |

The calculation runs **lazily** on each agent portal load — there is no persisted `commission_earned` row.

## 3. When commission "exists"

| Trigger | Currently | Recommended |
|---|---|---|
| Booking created | not yet (status PendingApproval) | record an estimate row |
| Booking confirmed | not recorded | snapshot the rate + computed amount into `commission_earnings` |
| Contract activated | not recorded | mark `commission_earnings.status = 'Earned'` |
| Booking cancelled | shows as zero | `commission_earnings.status = 'Voided'` with reason |
| Agent paid out | nothing tracks payouts | `commission_payouts (id, agent_account_id, period_start, period_end, total_amount, paid_at, reference)` |

## 4. Gaps

| # | Gap | Severity |
|---|---|---|
| AC-01 | No `commission_earnings` snapshot — rate changes retroactively affect history | 🔴 |
| AC-02 | No payout tracking | 🟡 |
| AC-03 | No statement / report endpoint for agent (`GET /v1/agent/commissions/statement?period=`) | 🟡 |
| AC-04 | Cancelled bookings still appear in agent earnings list with zero — confusing | 🟢 |
| AC-05 | Multi-agent attribution (2 agents share a booking) is not modeled | 🟢 |

## 5. Recommended schema additions

```sql
CREATE TABLE commission_earnings (
  id                  serial PRIMARY KEY,
  booking_id          int NOT NULL REFERENCES bookings(id),
  agent_account_id    int NOT NULL REFERENCES accounts(id),
  commission_id       int REFERENCES commissions(id),
  rate_or_amount      numeric(10,2) NOT NULL,
  rate_type           text NOT NULL,            -- 'Percentage' | 'Fixed'
  computed_amount     numeric(10,2) NOT NULL,
  currency            text DEFAULT 'AUD',
  status              text NOT NULL DEFAULT 'Pending', -- Pending | Earned | Voided
  earned_at           timestamp,
  voided_at           timestamp,
  void_reason         text,
  payout_id           int REFERENCES commission_payouts(id),
  created_at          timestamp DEFAULT now(),
  updated_at          timestamp DEFAULT now()
);

CREATE TABLE commission_payouts (
  id                  serial PRIMARY KEY,
  agent_account_id    int NOT NULL REFERENCES accounts(id),
  period_start        date NOT NULL,
  period_end          date NOT NULL,
  total_amount        numeric(10,2) NOT NULL,
  paid_at             timestamp,
  reference           text,
  created_at          timestamp DEFAULT now()
);
```
