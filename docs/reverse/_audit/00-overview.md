# MillionStay — Reverse Documentation Overview (STEP 0)

> Generated: 2026-04-19. Snapshot of the actual codebase state.

## 1. Project structure

```
/home/runner/workspace
├─ artifacts/                 # Deployable apps (each has its own preview path)
│  ├─ api-server/             # Express 5 API (port = $PORT, mounted under /api)
│  ├─ million-stay-web/       # Public site + Guest Portal (React + Vite)
│  ├─ property-admin/         # Internal admin dashboard
│  ├─ owner-portal/           # Property owner portal
│  ├─ agent-portal/           # Booking agent portal
│  ├─ service-host-portal/    # Service / cleaning host portal
│  └─ mockup-sandbox/         # Vite preview server for canvas iframe mockups
├─ lib/
│  ├─ db/                     # Drizzle schema, drizzle-kit migrations
│  ├─ api-spec/               # OpenAPI source + Orval config
│  ├─ api-zod/                # Generated Zod schemas
│  └─ api-client-react/       # Generated React Query hooks
├─ scripts/                   # Workspace tooling
├─ docs/                      # Documentation (incl. this reverse-docs pack + NDB runbook)
└─ attached_assets/           # User-supplied references and screenshots
```

## 2. Tech stack

| Purpose | Stack |
|---|---|
| Backend framework | Express 5 (Node 20+) |
| Frontend framework | React 19, Vite 7, Wouter |
| ORM / DB | Drizzle ORM 0.45 + `pg` driver, PostgreSQL |
| Validation | Zod 3 (mostly Orval-generated) |
| Auth | `jsonwebtoken` (JWT, 3 separate secrets), `bcryptjs`, `express-session`, `cookie-parser` |
| File handling | `multer` upload → Cloudinary (signed URLs), magic-byte validator |
| Email | Resend |
| State / data | TanStack Query, Zustand |
| UI | shadcn/ui (Radix + Tailwind v4 + class-variance-authority), Lucide icons, Framer Motion |
| Testing | **None** — no test framework configured |
| Deployment | Replit deployments + workflows (no Docker) |

## 3. Database tables (full inventory)

**Auth / users**: `admin_users`, `guest_users`, `partner_users`, `refresh_tokens`, `login_attempts`
**Property**: `properties`, `spaces`, `space_blocked_dates`, `space_images`, `space_policies`, `space_options`, `accommodation_catalog`
**Products**: `contract_products`, `service_catalog`, `booking_extra_services`, `booking_service_photos`
**CRM**: `accounts`, `contacts`, `commissions`, `leads`, `tasks`
**Booking / Contract**: `bookings`, `contracts`, `contract_line_items`
**Finance**: `invoices`, `recurring_schedule`, `promotions`, `payment_methods`
**Operations**: `work_orders`, `cs_tickets`, `cs_ticket_replies`
**Logging**: `system_log`, `email_logs`
**Privacy / compliance**: `marketing_consents`, `documents`
**Content**: `website_content`, `blog_posts`

**Tables missing audit columns**:

| Table | Missing |
|---|---|
| `guest_users` | `deleted_at` |
| `partner_users` | `deleted_at` |
| `refresh_tokens` | `updated_at`, `deleted_at` |
| `marketing_consents` | `deleted_at` |
| `space_blocked_dates` | `created_at`, `updated_at`, `deleted_at` |

## 4. API routes (high-level)

Counted ~60 route handlers across `artifacts/api-server/src/routes/`.

| Domain | Route file(s) | Endpoint count (approx) |
|---|---|---|
| Auth (admin/guest/partner) | `auth.ts`, `guest-auth.ts`, `partner-auth.ts` | 14 |
| Public (anonymous) | `public-spaces.ts`, `public-properties.ts`, `privacy.ts` | 7 |
| Property / Space / Product | `properties.ts`, `spaces.ts`, `contract-products.ts`, `accommodation-catalog.ts` | 18 |
| Booking | `bookings.ts` | 10 |
| Contract | `contracts.ts` | 9 |
| Finance | `invoices.ts`, `recurring-schedules.ts`, `promotions.ts`, `stripe-webhook.ts` | 12 |
| CRM | `accounts.ts`, `contacts.ts`, `leads.ts`, `commissions.ts`, `tasks.ts` | 14 |
| Operations | `work-orders.ts`, `cs-tickets.ts`, `service-catalog.ts` | 9 |
| Settings / admin | `admin-users.ts`, `integrations.ts`, `db-sync.ts` | 8 |
| Guest portal | `guest-portal.ts`, `guest-cs.ts`, `guest-documents.ts` | 12 |
| Agent / Owner / ServiceHost portals | `agent-portal.ts`, `owner-portal.ts`, `service-host-portal.ts` | 13 |

Full breakdown in `_schema/api-endpoints.md`.

## 5. Frontend pages (high-level)

| Artifact | Page count |
|---|---|
| `million-stay-web` (public + guest portal) | ~22 |
| `property-admin` | ~14 |
| `agent-portal` | 6 |
| `owner-portal` | 6 |
| `service-host-portal` | 6 |

Full inventory in `_design/component-library.md`.

## 6. Missing pieces — backend without frontend / frontend without backend

### Backend features with no UI yet
- `recurring_schedule` — schema, generation logic and CRUD endpoints exist; no admin UI to view/edit individual recurring schedules.
- `promotions` — CRUD endpoint exists; no admin promotions management page.
- `service_catalog` — CRUD endpoint exists; admin UI not built.
- `system_log` — fully populated for booking/invoice/contract; no admin viewer page.
- `email_logs` — populated; no admin viewer page.
- `documents` retention purge — script exists (`scripts/purge-expired-documents.ts`), no admin trigger.

### Frontend features with no backend
- Admin dashboard "Availability Calendar" — placeholder UI only; no backend grid endpoint.
- "Tenant Lifecycle" sidebar item in property-admin — page is a stub.

### Routes with no service layer
The codebase does not separate routes/services/repositories. Business logic sits inline in route handlers (see `_rules/architecture-rules.md`).
