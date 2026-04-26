# MillionStay — Reverse Documentation Pack

> ⚠️ **NEEDS REVISION** — see `docs/reverse/_audit/T001_RECON_REPORT.md` §g for specific corrections required. Will be rewritten in T002–T007 when its domain folder is processed.


Generated: 2026-04-19. Reflects the current state of the codebase at that snapshot. Each document includes file paths and code references so it can be re-grounded as the code evolves.

## Reading order

| Step | Folder | Read in order |
|---|---|---|
| 0 | [`_audit/`](./_audit/) | `00-overview.md` → `00-feature-gap.md` |
| 1 | [`_schema/`](./_schema/) | `erd-core.md` → `erd-finance.md` → `erd-crm.md` → `erd-operations.md` → `api-endpoints.md` → `dto-contracts.md` |
| 2 | [`_context/`](./_context/) | `domain-model.md` → `user-personas.md` → `tech-stack.md` → `constraints.md` |
| 3 | [`_rules/`](./_rules/) | `architecture-rules.md` → `financial-rules.md` → `security-rules.md` → `no-magic-rules.md` |
| 4 | [`_workflows/`](./_workflows/) | `booking-lifecycle.md` → `payment-workflow.md` → `checkin-checkout-workflow.md` → `agent-commission-workflow.md` → `promotion-application-logic.md` → `maintenance-workflow.md` |
| 5 | [`_design/`](./_design/) | `component-library.md` → `admin-layout.md` → `guest-portal-layout.md` → `design-tokens.md` |
| 6 | [`_templates/`](./_templates/) | `crud-service-template.md` → `audit-log-template.md` → `financial-calculation-template.md` |
| 7 | [`_test/`](./_test/) | `existing-test-coverage.md` → `booking-test-cases.md` → `api-test-checklist.md` → `migration-readiness-checklist.md` → `performance-benchmarks.md` |

## Quick links

- **Audit overview** — [`_audit/00-overview.md`](./_audit/00-overview.md)
- **What's missing right now** — [`_audit/00-feature-gap.md`](./_audit/00-feature-gap.md)
- **Full API endpoint table** — [`_schema/api-endpoints.md`](./_schema/api-endpoints.md)
- **Booking state machine + race-condition note** — [`_workflows/booking-lifecycle.md`](./_workflows/booking-lifecycle.md)
- **Money rules + invoice mutability gap** — [`_rules/financial-rules.md`](./_rules/financial-rules.md)
- **Security gaps (top 5)** — [`_rules/security-rules.md`](./_rules/security-rules.md)
- **C# migration readiness checklist** — [`_test/migration-readiness-checklist.md`](./_test/migration-readiness-checklist.md)

## Top 10 issues you should fix before any large refactor or C# port

1. Move every money column from `real` to `numeric(10,2)` — currently scattered across `bookings`, `contracts`, `contract_products`, `recurring_schedule`, `commissions`, `work_orders`, `service_catalog`.
2. Add a unique index on `space_blocked_dates(space_id, date)` and wrap booking confirm in `db.transaction(...)` to close the **overbooking race condition**.
3. Add an immutability guard on `PUT /v1/invoices/:id` — currently Paid invoices can be mutated.
4. Standardize error responses on `{ success:false, error:{code,message} }` — two shapes coexist today.
5. Mount a global Express error handler — every route currently does its own `try/catch` with `res.status(500)`.
6. Cancel-booking should terminate the linked contract and void future unpaid invoices.
7. Auto-create a cleaning Work Order on check-out.
8. Add nightly job(s) to flip `Sent` invoices past due to `Overdue`, expire contracts past `end_date`, and purge expired refresh tokens.
9. Snapshot agent commission at confirm-time into a new `commission_earnings` table — current calculation is purely dynamic.
10. Implement MFA for Admin / SuperAdmin (the privacy policy already promises it).

## Document inventory (28 files)

```
docs/reverse/
├─ README.md                                      ← this file
├─ _audit/
│  ├─ 00-overview.md
│  └─ 00-feature-gap.md
├─ _schema/
│  ├─ erd-core.md
│  ├─ erd-crm.md
│  ├─ erd-finance.md
│  ├─ erd-operations.md
│  ├─ api-endpoints.md
│  └─ dto-contracts.md
├─ _context/
│  ├─ domain-model.md
│  ├─ user-personas.md
│  ├─ tech-stack.md
│  └─ constraints.md
├─ _rules/
│  ├─ architecture-rules.md
│  ├─ financial-rules.md
│  ├─ security-rules.md
│  └─ no-magic-rules.md
├─ _workflows/
│  ├─ booking-lifecycle.md
│  ├─ payment-workflow.md
│  ├─ checkin-checkout-workflow.md
│  ├─ agent-commission-workflow.md
│  ├─ promotion-application-logic.md
│  └─ maintenance-workflow.md
├─ _design/
│  ├─ component-library.md
│  ├─ admin-layout.md
│  ├─ guest-portal-layout.md
│  └─ design-tokens.md
├─ _templates/
│  ├─ crud-service-template.md
│  ├─ audit-log-template.md
│  └─ financial-calculation-template.md
└─ _test/
   ├─ existing-test-coverage.md
   ├─ booking-test-cases.md
   ├─ api-test-checklist.md
   ├─ migration-readiness-checklist.md
   └─ performance-benchmarks.md
```

## How to keep this pack fresh

These docs reference real file paths (`artifacts/api-server/src/routes/bookings.ts`, `lib/db/src/schema/*.ts`, etc.). When you change those files, grep the corresponding doc and update.

Suggested cadence: refresh after each sprint that touches schema, finance, or auth.
