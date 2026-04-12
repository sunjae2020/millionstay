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

**Dashboards (4 dedicated PMS dashboards):**
- Overview Dashboard (`/dashboard`) — KPI stat cards, mini booking calendar, alerts, integrations status
- Reservations Dashboard (`/dashboard/reservations`) — 7-day Gantt calendar (week nav, colour-coded bars), today's arrivals/departures with check-in/out actions, bookings table with filter/pagination
- Finance Dashboard (`/dashboard/finance`) — revenue KPIs, 6-month bar chart (recharts), payment status donut, invoice list with status actions (send/pay/void), revenue by property, tax summary table
- Operations Dashboard (`/dashboard/operations`) — work order KPIs, work orders list with priority dots + status transitions, priority distribution donut, housekeeping room grid, system activity log

**New API endpoints (dashboard.ts):**
- `GET /api/v1/dashboard/overview/kpis` → check-ins today, check-outs, occupancy, monthly revenue
- `GET /api/v1/bookings/calendar?start=&end=` → Gantt data (spaces + booking bars) — added before `:id` route
- `GET /api/v1/bookings/today/arrivals` / `/today/departures` → today's check-ins/check-outs
- `GET /api/v1/finance/summary` → financial KPI totals
- `GET /api/v1/finance/revenue/monthly?months=N` → N-month rolling revenue
- `GET /api/v1/finance/revenue/by-property` → revenue breakdown per property
- `GET /api/v1/finance/tax-summary` → 6-month tax summary (gross/tax/net)
- `GET /api/v1/operations/summary/kpis` → open/in-progress/urgent/completed work order counts
- `GET /api/v1/operations/activity-log?limit=N` → system audit log entries

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
- Promotions — 3 term types: ShortTerm (<4w, Weekly, no discount), MidTerm (4–25w, Biweekly, 5%), LongTerm (≥26w, Monthly, 7.5%); fields: term_type, min/max_stay_weeks, billing_frequency, discount_percentage; 3 seed records created; lookup endpoint at /v1/lookup/promotions; CRUD in openapi.yaml + codegen done
- Beneficiaries — full-stack CRUD; links Account + Commission + Contract Product; commission_type (Percentage/Fixed), split_percentage, fixed_amount, priority; DB schema + API route + BeneficiaryList + BeneficiaryDetail + App.tsx routing all done

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

### MillionStay Guest Portal (`artifacts/million-stay-web`)
- **Kind**: web (React + Vite)
- **Port**: 20546
- **Purpose**: Guest-facing booking portal for MillionStay
- **Brand color**: `#E8621A` (orange)
- **i18n**: EN/JA/KO/ZH via react-i18next
- **State**: Zustand (persisted in `ms-auth-storage` localStorage)
- **Auth**: JWT stored as `ms_auth_token` in localStorage; guest JWT via `GUEST_JWT_SECRET`
- **Custom API hooks**: `artifacts/million-stay-web/src/lib/guest-api.ts` — wraps all guest-specific endpoints not in the OpenAPI spec

**Pages**: Home, Search (with Leaflet map), Space Detail, Stay Plan, About, FAQ, Contact, For Students, For Agent, House Rules, Privacy Policy, Login, Register, Booking (inline auth), Portal Bookings, Portal Invoices, Portal Documents

**Backend guest routes** (not in OpenAPI spec):
- `GET/POST /api/v1/auth/guest/register` — register
- `POST /api/v1/auth/guest/login` — login
- `GET /api/v1/auth/guest/me` — current user
- `GET /api/v1/public/spaces` — public listing with filters + availability check
- `GET /api/v1/public/spaces/:id` — space detail with images/options/policies
- `GET /api/v1/public/properties` — public property list
- `GET /api/v1/guest/bookings` — guest's bookings
- `POST /api/v1/guest/bookings` — create booking
- `GET /api/v1/guest/bookings/:id` — booking detail
- `GET /api/v1/guest/invoices` — guest's invoices
- `GET /api/v1/guest/documents` — guest's documents (stub)
- `GET /api/v1/guest/profile` — profile
- `PUT /api/v1/guest/profile` — update profile
- `GET /api/v1/guest/cs-tickets` — list guest's support tickets
- `POST /api/v1/guest/cs-tickets` — create new support ticket (with optional booking_id + image_urls)
- `GET /api/v1/guest/cs-tickets/:id` — ticket detail with messages (non-internal only) + booking info
- `POST /api/v1/guest/cs-tickets/:id/messages` — send reply to ticket (reopens Resolved tickets)
- `POST /api/v1/cs/upload-image` — upload image for CS ticket (Cloudinary, requires guest auth)

### API Server (`artifacts/api-server`)
- **Kind**: api
- **Port**: 8080
- **Routes**: All modules under `/api/v1/...`; lookup endpoints return `{ id, display }` format

## Database Schema (`lib/db`)

Tables (30 total): `suburbs`, `properties`, `space_options`, `space_policies`, `spaces`, `space_option_maps`, `space_blocked_dates`, `commissions`, `payment_info`, `contacts`, `accounts`, `tasks`, `leads`, `service_hosts`, `bookings`, `booking_documents`, `contract_products`, `contracts`, `invoices`, `work_orders`, `space_availability`, `recurring_schedule`, `system_log`, `email_template` (10 seeded templates), `email_log`, `promotions`, `beneficiaries`, `accommodation_catalog`, `service_catalog`, `cs_tickets`, `cs_messages`

**cs_tickets** — Guest support tickets. Fields: `ticket_ref` (CS-YYYY-NNNN), `guest_user_id`, `booking_id` (optional link), `category` (General/Accommodation/Billing/Maintenance/Other), `subject`, `description`, `status` (Open/InProgress/Resolved/Closed), `priority` (Low/Normal/High/Urgent), `assigned_admin_id`, `closed_at`. Admin API: `/api/v1/cs-tickets`. Guest API: `/api/v1/guest/cs-tickets`.

**cs_messages** — Thread messages per ticket. Fields: `ticket_id`, `sender_type` (guest/admin), `sender_id`, `message`, `image_urls` (JSON array of Cloudinary URLs), `is_internal` (1 = internal admin note, not visible to guest).

**accommodation_catalog** (formerly product_catalog) — Guest-facing accommodation pricing per space. Admin API: `/api/v1/accommodations`. Drizzle: `accommodationCatalogTable`. Fields include `bond_amount`, `admin_fee`, `cleaning_fee` per product.

**service_catalog** — Ancillary services. Types: `one_time`, `scheduled`, `physical`. Admin API: `/api/v1/services`. Public API: `GET /api/v1/public/services` (returns optional, active, display_on_booking_page=true services). Seeded with 6 services: Room Deposit, Admission Fee, Cleaning Fee (required), Airport Pickup, Vodafone SIM Card, Linen Pack (optional). Guest booking page fetches and displays optional services from this catalog.

## API Client (`lib/api-client-react`)

Generated from OpenAPI spec (`lib/api-spec/openapi.yaml`) via Orval. Hooks for all entities. Zod schemas in `lib/api-zod`. Always run codegen after updating openapi.yaml.

## Internationalisation (i18n)

Admin panel supports 5 languages: **EN** (default), **KO** (한국어), **ZH** (中文), **JA** (日本語), **TH** (ภาษาไทย).

- Locale files: `artifacts/property-admin/src/locales/{en,ko,zh,ja,th}/translation.json`
- Language preference persisted to `localStorage` key: `ms_admin_language`
- All 52 pages use `useTranslation` from `react-i18next` — 100% coverage
- Key namespaces: `nav.*` (page titles, sidebar), `dashboard.*` (KPI sections), `common.*` (UI actions), `login.*`, `lang.*`
- `common.new` added to all locales for "New" prefix in detail page titles (e.g. "New Property" / "새 매물")
- Nav keys used directly as page titles — zero duplicate keys

## Important Patterns

- **Lookup endpoints**: return `{ id, display }` format
- **enrichXxx()**: server-side function that joins related data and adds enriched fields (e.g., `property_name`, `booking_ref`)
- **FSM transitions**: separate POST endpoints e.g. `/v1/work-orders/:id/start`
- **Ref format**: MS-{TYPE}-YYYY-NNNNN (e.g., MS-WO-2026-00001)
- **Zod imports**: use `@workspace/api-zod` (preferred in api-server routes); if types not yet generated (missing from openapi.yaml), use inline `zod/v4` schemas instead
- **Account types**: Guest, SpaceOwner (absorbed Landlord), Broker (renamed Agent), Manager, RealEstateAgent, ServiceHost, Partner — Staff removed from accounts → admin_users
- **DB imports**: use `@workspace/db` (not `@workspace/db/client`)
