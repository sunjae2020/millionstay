# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Property Admin (`artifacts/property-admin`)
- **Kind**: web (React + Vite)
- **Port**: 23339
- **Purpose**: MillionStay — multi-module property management SaaS admin tool

**Modules (10 complete):**

**Property:**
- Dashboard — full KPI stats across all modules + booking calendar + alerts
- Suburbs — CRUD with search, country/state filters
- Properties — CRUD with approval status workflow (Pending → Active)
- Space Options — amenity tag CRUD
- Space Policies — house rules templates
- Spaces — tabbed form with LookupField, 30-day availability calendar

**CRM:**
- Contacts — full detail (basic info, KYC/passport/visa with expiry warnings, address, portal toggle)
- Accounts — account CRUD, LookupSelect for contacts/commission/payment
- Commissions — percentage and fixed-amount templates
- Payment Info — bank transfer (BSB/account), Stripe, Cash records

**Sales:**
- Tasks — CRUD with FSM (Todo→InProgress→Done)
- Leads — CRUD with pipeline status, contact/account lookups

**Booking:**
- Bookings — full FSM (Draft→PendingApproval→Confirmed→Active→CheckedOut; Cancel/NoShow)
- Service Hosts — host management

**Products:**
- Contract Products — Space × Promotion = Product; new fields: promotion_id (FK), term_type, effective_weekly_rate (auto-calc), billing_frequency; list shows Term/Promotion/Eff.Rate/Billing columns
- Promotions — 3 term types: ShortTerm (<4w, Weekly, no discount), MidTerm (4–25w, Biweekly, 5%), LongTerm (≥26w, Monthly, 7.5%); fields: term_type, min/max_stay_weeks, billing_frequency, discount_percentage; 3 seed records created; lookup endpoint at /v1/lookup/promotions

**Contracts:**
- Contracts — CRUD + booking_ref enrichment, contract details

**Finance:**
- Invoices — FSM (Draft→Sent→Paid; Void from Draft/Sent); ref format MS-INV-YYYY-NNNNN

**Maintenance:**
- Work Orders — FSM (Open→InProgress→PendingReview→Completed; Cancel any); priority Low/Normal/High/Urgent; ref format MS-WO-YYYY-NNNNN

**Components:**
- `StatusBadge` — colored badge for Active/Pending/Suspended/Rejected
- `LookupField` — single-select modal lookup (dialog-based)
- `LookupSelect` — simplified lookup with internal fetch state
- `MultiLookupField` — multi-select modal lookup with tag display
- `Layout` + `PageHeader` — sidebar nav (MillionStay branding) + page header

### API Server (`artifacts/api-server`)
- **Kind**: api
- **Port**: 8080
- **Routes**: All modules under `/api/v1/...`; lookup endpoints return `{ id, display }` format

## Database Schema (`lib/db`)

Tables (26 total): `suburbs`, `properties`, `space_options`, `space_policies`, `spaces`, `space_option_maps`, `space_blocked_dates`, `commissions`, `payment_info`, `contacts`, `accounts`, `tasks`, `leads`, `service_hosts`, `bookings`, `booking_documents`, `contract_products`, `contracts`, `invoices`, `work_orders`, `space_availability`, `recurring_schedule`, `system_log`, `email_template` (10 seeded templates), `email_log`, `promotions`

## API Client (`lib/api-client-react`)

Generated from OpenAPI spec (`lib/api-spec/openapi.yaml`) via Orval. Hooks for all entities. Zod schemas in `lib/api-zod`. Always run codegen after updating openapi.yaml.

## Important Patterns

- **Lookup endpoints**: return `{ id, display }` format
- **enrichXxx()**: server-side function that joins related data and adds enriched fields (e.g., `property_name`, `booking_ref`)
- **FSM transitions**: separate POST endpoints e.g. `/v1/work-orders/:id/start`
- **Ref format**: MS-{TYPE}-YYYY-NNNNN (e.g., MS-WO-2026-00001)
- **Zod imports**: use `@workspace/api-zod` (never `zod` directly in api-server)
- **DB imports**: use `@workspace/db` (not `@workspace/db/client`)
