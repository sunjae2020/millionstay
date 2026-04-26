# Feature Implementation Gap Analysis (STEP 0-B)

> ⚠️ **NEEDS REVISION** — see `docs/reverse/_audit/T001_RECON_REPORT.md` §g for specific corrections required. Will be rewritten in T002–T007 when its domain folder is processed.


Legend: ✅ Fully implemented · ⚠️ Partially · ❌ Not implemented · 🔲 Backend only (no UI)

## Admin features

| Feature | Status | Notes |
|---|---|---|
| Dashboard — occupancy KPI | ⚠️ | KPI cards exist, occupancy calc is approximate |
| Dashboard — revenue | ⚠️ | Sums paid invoices for current month only |
| Dashboard — check-in/out schedule | ❌ | No today/tomorrow check-in/out widget |
| Dashboard — Availability Calendar | ❌ | Placeholder only |
| Booking — create | ✅ | `POST /v1/bookings` + admin UI |
| Booking — list | ✅ | |
| Booking — confirm | ✅ | + auto-creates Contract |
| Booking — cancel | ✅ | + unblocks dates |
| Booking — check-in | ✅ | |
| Booking — check-out | ⚠️ | No auto cleaning WO, no unpaid-invoice guard |
| Contracts — manage | ✅ | |
| Contracts — activate | ✅ | + generates invoices/schedules |
| Contracts — PDF download | ❌ | `document_url` column exists; no generator |
| Finance — invoice list | ✅ | |
| Finance — payment processing | ⚠️ | Stripe checkout works; no in-app card form |
| Finance — receipt | ⚠️ | `Receipt` not modeled separately; uses paid invoices |
| Finance — payment schedule | ✅ | `recurring_schedule` table + admin viewer per-contract |
| Property / Space / Product | ✅ | |
| Promotions (% + fixed) | 🔲 | CRUD endpoint + schema only; no admin UI |
| Agent commission setup | ⚠️ | `commissions` table + agent-portal earnings view; admin setup UI thin |
| Agent commission tracking | ✅ | Agent portal commissions page |
| Work Orders | ✅ | List + create; no auto-trigger |
| CS Tickets | ✅ | Admin reply + close; no ticket→WO conversion |
| System Settings | ⚠️ | Settings hub exists; many sub-pages stubbed |

## Guest portal features

| Feature | Status | Notes |
|---|---|---|
| Property search | ✅ | `/search` with filters |
| Availability filter on search | ⚠️ | Date filter passes through; results don't currently exclude blocked spaces |
| Booking wizard | ✅ | 4-step (`booking-new.tsx`) |
| My Bookings | ✅ | `/portal/bookings` |
| Invoices page | ✅ | `/portal/invoices` (Stripe pay button) |
| Documents upload/download | ⚠️ | Schema + endpoint exist; UI is in My Data page only — no dedicated Documents page |
| CS ticket submission | ✅ | `/portal/cs` |
| Profile management | ✅ | `/portal` profile section |
| **My Data — APP 12 export** | ✅ | Sprint B-4 |
| **Marketing consent management** | ✅ | Register checkbox + unsubscribe page |

## Top 5 priority gaps

1. **Contract PDF generation** — `document_url` exists but nothing produces a PDF. Without it the "sign" workflow has no artifact to attach. **Suggest:** server-side PDF using `pdfkit` or `puppeteer`.
2. **Auto cleaning Work Order on checkout** — explicit gap noted in audit. Would also unify WO with operational reality. **Suggest:** insert `work_order` row with category=`Cleaning`, status=`Open`, `space_id` populated, in the check-out handler.
3. **Overdue invoice batch job** — `Overdue` status exists but nothing flips invoices into it. **Suggest:** nightly job `UPDATE invoices SET status='Overdue' WHERE status='Sent' AND due_date < now()` + audit log + notification email.
4. **Server-side past-date / min-max-stay enforcement on bookings** — currently UI-only. A direct API call could create an invalid booking. **Suggest:** add Zod refinements + DB-level CHECK constraint.
5. **Admin viewers for `system_log`, `email_logs`, `promotions`, `service_catalog`** — these power the back-office but have no read UI. The data is invisible to operators.

## Backend-only features (🔲)

- Promotions CRUD
- Service Catalog CRUD
- Recurring Schedule individual edit (only viewable inside contract detail today)
- System Log audit trail
- Email Logs delivery history
- Document retention purge script (manual `tsx scripts/purge-expired-documents.ts --apply`)

## Frontend-only stubs

- "Tenant Lifecycle" page (property-admin sidebar)
- "Availability Calendar" widget on Dashboard
- "Reports" submenu under Settings
