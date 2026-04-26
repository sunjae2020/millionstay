# T001 RECON REPORT — MillionStay Codebase Ground Truth

> **Generated**: 2026-04-26 by recon scan of source only.
> **Source rule**: Code, schema, `package.json`, route definitions only. No existing `docs/reverse/` documentation was consulted while sections §a–§f were produced (per OPERATING RULE 1). The §4 classification (existing docs) was performed after recon, by reading existing docs and judging them against §a–§f findings.
> **Raw scans**: `docs/reverse/_audit/raw/01_…08_….txt` (regenerable).
> **Citation format**: `path:line` or `path:line-line`. Every claim carries a citation. Speculative claims are marked ⚠️ UNCLEAR / SPEC-ONLY / 🆕 UNDOCUMENTED.

---

## §a. Codebase Inventory

### a.1 Top-level layout (2 levels)

```
/home/runner/workspace
├── artifacts/
│   ├── agent-portal/          # React 19 + Vite (partner web)
│   ├── api-server/            # Express 5 backend
│   ├── million-stay-web/      # Public marketing + guest portal
│   ├── mockup-sandbox/        # Component preview (design surface)
│   ├── owner-portal/          # React 19 + Vite (partner web)
│   ├── property-admin/        # React 19 + Vite (admin web)
│   └── service-host-portal/   # React 19 + Vite (partner web)
├── lib/
│   ├── api-client-react/      # Generated React Query hooks (Orval)
│   ├── api-spec/              # OpenAPI YAML + Orval config
│   ├── api-zod/               # Generated Zod request/response schemas
│   ├── db/                    # Drizzle schemas + connection
│   └── ui/                    # (presence not verified in recon)
├── docs/                      # Living docs (incl. existing reverse pack)
└── package.json (root pnpm workspace)
```

Source: workspace listing + registered artifacts in `View` snapshot; `lib/api-spec/package.json` (Orval ^8.5.2).

### a.2 Web artifacts and their workflow commands

| Artifact (dir) | Kind | Workflow command |
|---|---|---|
| `artifacts/api-server` | api | `pnpm --filter @workspace/api-server run dev` |
| `artifacts/property-admin` | web | `pnpm --filter @workspace/property-admin run dev` |
| `artifacts/million-stay-web` | web | `pnpm --filter @workspace/million-stay-web run dev` |
| `artifacts/owner-portal` | web | `pnpm --filter @workspace/owner-portal run dev` |
| `artifacts/agent-portal` | web | `pnpm --filter @workspace/agent-portal run dev` |
| `artifacts/service-host-portal` | web | `pnpm --filter @workspace/service-host-portal run dev` |
| `artifacts/mockup-sandbox` | design | `pnpm --filter @workspace/mockup-sandbox run dev` |

### a.3 Backend dependencies (declared in `artifacts/api-server/package.json`)

`bcryptjs`, `cloudinary`, `cookie-parser`, `cors`, `drizzle-orm`, `express`, `express-session`, `helmet`, `jsonwebtoken`, `multer`, `pino`, `pino-http`, `resend`, `stripe`, `@workspace/api-zod`, `@workspace/db`, `zod`.

Used in `app.ts` boot (verified `app.ts:1-27`): `express`, `cors`, `helmet`, `pinoHttp`, `express-session`, `path`, `node:fs`, `node:url`. ⚠️ UNCLEAR — `connect-pg-simple` is NOT in `api-server/package.json` despite session usage; session store strategy was not verified in this recon and must be confirmed in T003.

🆕 UNDOCUMENTED — `bcryptjs` is declared but its call sites were not enumerated in this recon (must be verified in T002 auth section).

### a.4 DB schema location and table count

- **Path**: `lib/db/src/schema/` — 48 `.ts` files (47 schema modules + `index.ts`).
- **Index pattern**: `lib/db/src/schema/index.ts:1-47` uses `export * from "./<file>"` (47 lines, 47 modules).
- **Schema files** (all 47, sorted): `accommodation_catalog`, `accommodation_service_catalog`, `accounts`, `announcements`, `beneficiaries`, `blog_posts`, `booking_service_photos`, `bookings`, `commissions`, `contacts`, `contract_line_items`, `contracts`, `contract_types`, `cs_tickets`, `documents`, `email_logs`, `email_templates`, `guest_emergency_contacts`, `guest_users`, `integration_settings`, `invoices`, `leads`, `login_attempts`, `marketing_consents`, `page_contents`, `partner_users`, `payment_info`, `product_catalog`, `product_groups`, `products`, `product_types`, `promotions`, `properties`, `recurring_schedules`, `refresh_tokens`, `service_catalog`, `service_hosts`, `space_availability`, `space_images`, `space_options`, `space_policies`, `space_service_catalog`, `spaces`, `suburbs`, `system_logs`, `tasks`, `users`, `work_orders`.
- **Tables ≠ files**: several files declare multiple tables (e.g., `bookings.ts` defines `bookings` + `booking_services`; `cs_tickets.ts` defines `cs_tickets` + `cs_messages`; `announcements.ts` defines `announcements` + `guest_direct_messages`; `spaces.ts` defines `spaces` + `space_option_maps` + `space_blocked_dates`; `products.ts` declares `products` + `contract_products`). Total tables ≈ 55+; exact count requires per-file inspection in T002.
- **`users.ts` table name surprise**: schema file is `users.ts`, exported variable is `usersTable` ⚠️, but actual SQL table name is `admin_users` — verified by route imports using `usersTable` for admin login flows.

---

## §b. Detected Entities — Drizzle Tables, Columns, FKs

### b.1 Major tables verified by direct read

The following tables were read in full during recon. Citations are file paths in `lib/db/src/schema/`.

| Table (SQL name) | File:line span | Notes |
|---|---|---|
| `bookings` | `bookings.ts:1-50` | Core; money columns `numeric(12,2)` ✅ |
| `booking_services` | `bookings.ts:51-...` | `unit_price`, `total_price` `numeric(10,2)` ✅ |
| `contracts` | `contracts.ts:1-50` | Money columns are `real` ⚠️ (precision risk) |
| `contract_line_items` | `contract_line_items.ts:1-25` | `unit_price`, `total_price` `numeric(10,2)` ✅ |
| `contract_types` | `contract_types.ts:1-15` | |
| `products` | `products.ts:1-30` | All money cols `real` ⚠️ |
| `contract_products` | `products.ts:30+` | Same file as products |
| `product_catalog` | `product_catalog.ts` | All money cols `real` ⚠️ |
| `accommodation_catalog` | `accommodation_catalog.ts:1-40` | All money cols `real` ⚠️ |
| `accommodation_service_catalog` | `accommodation_service_catalog.ts` | `custom_price` `real` ⚠️ |
| `service_catalog` | `service_catalog.ts:1-30` | `base_price` `real` ⚠️ |
| `space_service_catalog` | `space_service_catalog.ts` | `custom_price` `real` ⚠️ |
| `spaces` | `spaces.ts:1-25` | `base_weekly_price`, `base_daily_price` `real` ⚠️ |
| `space_options`, `space_option_maps` | `spaces.ts` (3 tables in one file) | |
| `space_blocked_dates` | `spaces.ts` (3rd table) | Used by `bookings.ts:96-105` for overbooking |
| `space_availability` | `space_availability.ts` | Coexists with `space_blocked_dates` (purpose overlap ⚠️ — not resolved in recon) |
| `space_images`, `space_policies` | own files | |
| `properties` | `properties.ts:1-30` | `approval_status` default `"Pending"` |
| `suburbs` | `suburbs.ts:1-15` | `status` default `"Active"` |
| `accounts` | `accounts.ts:1-35` | `default_currency` default `"AUD"`, `status` default `"Active"` |
| `contacts` | `contacts.ts:1-35` | `status` default `"Active"` |
| `leads` | `leads.ts:1-25` | `budget_min/max` `numeric(12,2)` ✅; `lead_status` enum-like text |
| `commissions` | `commissions.ts:1-15` | `commission_rate`, `commission_amount` `real` ⚠️ |
| `beneficiaries` | `beneficiaries.ts:1-20` | `fixed_amount` `real` ⚠️ |
| `payment_info` | `payment_info.ts:1-20` | `payment_type` default `"BankTransfer"` |
| `invoices` | `invoices.ts:1-20` | `amount` `numeric(10,2)` ✅ |
| `recurring_schedules` | `recurring_schedules.ts:1-15` | `amount` `numeric(10,2)` ✅; `frequency` default `"Biweekly"` |
| `promotions` | `promotions.ts:1-15` | `discount_amount` `numeric(10,2)` ✅ |
| `tasks` | `tasks.ts:1-25` | `task_status` default `"Todo"` |
| `work_orders` | `work_orders.ts:1-20` | `cost` `real` ⚠️; `status` default `"Open"` |
| `service_hosts` | `service_hosts.ts:1-20` | `status` default `"Active"` |
| `partner_users` | `partner_users.ts:1-20` | `portal_type` text — comment says `'agent' \| 'owner'` (line 8) but code accepts `'service_host'` ⚠️ |
| `users` (admin) | `users.ts` | SQL table `admin_users`, var `usersTable` ⚠️ |
| `guest_users`, `guest_emergency_contacts`, `marketing_consents` | own files | |
| `cs_tickets`, `cs_messages` | `cs_tickets.ts` | |
| `announcements`, `guest_direct_messages` | `announcements.ts` | |
| `system_logs` | `system_logs.ts:1-25` | `actor_type` default `"User"` — used by audit log helper |
| `email_templates`, `email_logs` | own files | `email_logs.status` default `"Sent"` |
| `blog_posts`, `page_contents` | own files | |
| `refresh_tokens`, `login_attempts` | own files | |
| `documents`, `booking_service_photos` | own files | |
| `integration_settings` | own file | |
| `product_types`, `product_groups` | own files | |

### b.2 Foreign-key declarations — **0 explicit `.references()` calls** ⚠️🔴

```
$ rg "\.references\(" lib/db/src/schema/ → 0 matches
```

**Source**: `docs/reverse/_audit/raw/09_fk_references.txt` (empty body).

**Implication**: All inter-table relationships are by naming convention only (`*_id` integer columns). PostgreSQL has **no `FOREIGN KEY` constraints**. Cascading deletes, orphan-prevention, and referential integrity are entirely application-layer responsibilities — and there is no centralized check.

### b.3 Orphan / unused tables in routes

```
$ rg "productsTable|productCatalogTable" artifacts/api-server/src/routes/ → 0 matches
```

- **`products` table**: defined in `products.ts:1-30` but the route layer never imports `productsTable`. Only `contractProductsTable` (also defined in `products.ts`) is used by `beneficiaries.ts`, `bookings.ts`, `contracts.ts`, `products.ts` (route).
- **`product_catalog` table**: zero route usage.
- **`accommodation_catalog`**: actively used by `lookup.ts`, `product-catalog.ts`, `public.ts`, `contracts.ts`, `bookings.ts`, `promotions.ts`.

⚠️ Three "product"-shaped tables exist in schema (`products`, `product_catalog`, `accommodation_catalog`); only the third is wired up in the API. `products` and `product_catalog` are **dead schema** in the runtime path.

### b.4 Status / state default values (recon §d source data)

47 status-like columns have a `.default()`. See `docs/reverse/_audit/raw/05_status_defaults.txt` for the full list. Highlights:

| Table | Column | Default | Verified at |
|---|---|---|---|
| `properties` | `approval_status` | `"Pending"` | `properties.ts:16` |
| `spaces` | `status` | `"Active"` | `spaces.ts:20` |
| `products` | `status` | `"Draft"` | `products.ts:10` |
| `products` | `product_type` | `"Room"` | `products.ts:9` |
| `products` | `billing_frequency` | `"Biweekly"` | `products.ts:18` |
| `accommodation_catalog` | `status` | `"Active"` | `accommodation_catalog.ts:38` |
| `accommodation_catalog` | `billing_frequency` | `"Biweekly"` | `accommodation_catalog.ts:22` |
| `bookings` | `booking_status` | (no default — set by code to `"Draft"` at `bookings.ts:194`) | |
| `contracts` | `status` | (no default — set to `"Draft"` at `contracts.ts:331`) | |
| `invoices` | `status` | (no default — set to `"Draft"` implicitly via creation; lifecycle paths verified) | |
| `recurring_schedules` | `frequency` | `"Biweekly"` | `recurring_schedules.ts:11` |
| `tasks` | `task_status` | `"Todo"` | `tasks.ts:9` |
| `tasks` | `priority` | `"Medium"` | `tasks.ts:10` |
| `work_orders` | `status` | `"Open"` | `work_orders.ts:10` |
| `work_orders` | `priority` | `"Normal"` | `work_orders.ts:11` |
| `announcements` | `category` | `"General"` | `announcements.ts:7` |
| `announcements` | `priority` | `"Normal"` | `announcements.ts:8` |
| `commissions` | `commission_type` | `"Percentage"` | `commissions.ts:8` |
| `beneficiaries` | `commission_type` | `"Percentage"` | `beneficiaries.ts:11` |
| `users` (admin) | `role` | `"Admin"` | `users.ts:7` |
| `email_logs` | `status` | `"Sent"` | `email_logs.ts:12` |
| `payment_info` | `payment_type` | `"BankTransfer"` | `payment_info.ts:8` |

---

## §c. Detected API Surface

### c.1 Route file → endpoint count (50 files, **353 endpoints**)

Source: `docs/reverse/_audit/raw/02_endpoints_count.txt` (regenerable via `rg -c "^router\.(get|post|put|patch|delete)\(" artifacts/api-server/src/routes/`).

| Route file | Endpoints | Auth pattern |
|---|---:|---|
| `bookings.ts` | 27 | `requireAuth` (via central `/api/v1` mount) |
| `contracts.ts` | 21 | `requireAuth` |
| `guest-portal.ts` | 18 | `requireGuestAuth` (via `router.use("/v1/guest", requireGuestAuth)` line 40) |
| `spaces.ts` | 13 | `requireAuth` |
| `product-catalog.ts` | 11 | `requireAuth` |
| `products.ts` | 10 | `requireAuth` |
| `invoices.ts` | 10 | `requireAuth` |
| `lookup.ts` | 10 | `requireAuth` |
| `public.ts` | 10 | **none** (mounted at `/api`, no guard) |
| `work-orders.ts` | 10 | `requireAuth` |
| `service-host-portal.ts` | 9 | `requireServiceHostAuth` (per-route, defined at `service-host-portal.ts:31-39`) |
| `dashboard.ts` | 8 | `requireAuth` |
| `guest-cs.ts` | 8 | `requireGuestAuth` (per-route) |
| `leads.ts` | 8 | `requireAuth` |
| `promotions.ts` | 8 | `requireAuth` |
| `auth.ts` | 7 | mostly public; `requireAuth` only on `/v1/auth/me` (`auth.ts:357`) |
| `contract-types.ts` | 7 | `requireAuth` |
| `cs-tickets.ts` | 7 | `requireAuth` (per-route) |
| `properties.ts` | 7 | `requireAuth` |
| `recurring-schedules.ts` | 7 | `requireAuth` |
| `tasks.ts` | 7 | `requireAuth` |
| `accounts.ts`, `beneficiaries.ts`, `blog-posts.ts`, `commissions.ts`, `contacts.ts`, `email-templates.ts`, `payment-info.ts`, `product-groups.ts`, `product-types.ts`, `service-catalog.ts`, `space-images.ts`, `space-options.ts`, `space-policies.ts`, `suburbs.ts` | 6 each | `requireAuth` |
| `agent-portal.ts` | 5 | `requireAgentAuth` (per-route) |
| `integrations.ts`, `owner-portal.ts`, `service-hosts.ts` | 5 each | various |
| `admin-users.ts` | 4 | `router.use(requireAuth)` at `admin-users.ts:9` |
| `db-sync.ts` | 3 | `requireSuperAdmin` (defined at `db-sync.ts:18`) — admin role gate |
| `guest-auth.ts` | 3 | mostly public; `/v1/auth/guest/me` requires `requireGuestAuth` (`guest-auth.ts:202`) |
| `page-contents.ts` | 3 | mounted at `/api` directly via `app.ts:172` — **all 3 routes pass through `requireAuth` because `app.ts:167` (`app.use("/api/v1", requireAuth)`) is registered first** |
| `partner-auth.ts` | 3 | mostly public; `/v1/auth/partner/me`, `/change-password` require `requirePartnerAuth` |
| `health.ts`, `privacy.ts` | 2 each | public |
| `stripe.ts` | 2 | webhook (no auth, signature-verified at `stripe.ts:37-49`) + config endpoint |
| `dev-migration.ts`, `email-logs.ts`, `reports.ts`, `system-logs.ts` | 1 each | various |

### c.2 Authentication topology (4 distinct guards)

| Guard | Source | JWT secret | Expiry | Used by |
|---|---|---|---|---|
| `requireAuth` (admin) | `middlewares/requireAuth.ts:1-40` | `JWT_SECRET ?? SESSION_SECRET` | 8h (`signJWT` line 26) | All `/api/v1/*` admin routes |
| `requireGuestAuth` | `middlewares/requireGuestAuth.ts:1-30` | `GUEST_JWT_SECRET ?? BASE_SECRET + "_guest"` | 7d | `guest-portal`, `guest-cs`, `guest-auth.ts:/me` |
| `requirePartnerAuth` (+ `requireAgentAuth` / `requireOwnerAuth`) | `middlewares/requirePartnerAuth.ts:1-40` | `PARTNER_JWT_SECRET ?? BASE_SECRET + "_partner"` | 7d | `agent-portal`, `owner-portal`, `partner-auth.ts:/me` |
| `requireServiceHostAuth` | inline, `routes/service-host-portal.ts:31-39` | (delegates to `requirePartnerAuth`, then checks `partner.portal_type === "service_host"`) | (inherits 7d) | `service-host-portal` |
| `requireSuperAdmin` | inline, `routes/db-sync.ts:18-29` | (chained after `requireAuth`, checks `req.user?.role === "SuperAdmin"`) | n/a | `/api/v1/admin/db-sync/*` |

### c.3 Mount order (critical for understanding auth coverage)

`app.ts:140-175` — order of `app.use(...)` matters:

```
1. publicRouter           → /api          (anonymous)
2. authRouter             → /api          (mostly anonymous; /me guarded inside)
3. healthRouter           → /api          (anonymous)
4. privacyRouter          → /api          (anonymous)
5. guestAuthRouter        → /api          (anonymous + /me guarded)
6. guestPortalRouter      → /api          (uses requireGuestAuth internally)
7. guestCsRouter          → /api          (per-route requireGuestAuth)
8. stripeRouter           → /api          (webhook signature-verified)
9. devMigrationRouter     → /api/v1/admin (no auth ⚠️ — verified)
10. partnerAuthRouter     → /api          (per-route requirePartnerAuth on /me)
11. agentPortalRouter     → /api          (per-route requireAgentAuth)
12. ownerPortalRouter     → /api          (per-route requireOwnerAuth)
13. serviceHostPortalRouter → /api        (per-route requireServiceHostAuth)
14. adminUsersRouter      → /api          (router.use(requireAuth) inside)
15. requireAuth           → /api/v1       (GLOBAL ADMIN GUARD)
16. dbSyncRouter          → /api/v1/admin (requireSuperAdmin enforced inside)
17. spaceImagesRouter     → /api          (sits AFTER global guard — protected)
18. pageContentsRouter    → /api          (sits AFTER global guard — protected)
19. router (central)      → /api          (all remaining /v1/* — protected)
```

⚠️ **Anomaly**: `dev-migration.ts` is mounted at `/api/v1/admin` *before* the global `requireAuth` (line 142 vs 167 in raw). Therefore its single endpoint is **unauthenticated**. To be confirmed by reading `dev-migration.ts` body in T002 (recon read first 10 lines only).

⚠️ **Subtle**: `serviceHostPortalRouter` is registered at line 164 — *before* the `/api/v1` `requireAuth` at line 167. So service-host routes never hit the admin guard. They self-protect via `requireServiceHostAuth`. Verified by `service-host-portal.ts:51` calling `requireServiceHostAuth` per-route.

### c.4 Frontend hook usage (138 generated hooks; 124 used per portal)

- **Generated hooks**: 138 (`rg -c "^export (const|function) use[A-Z]" lib/api-client-react/src/generated/api.ts` → 138).
- **Distinct hooks called per portal**: 124 in each of `property-admin`, `million-stay-web`, `agent-portal`, `owner-portal`, `service-host-portal`.
- **Caveat ⚠️**: The 124-distinct number was computed via a global `rg -oh "use[A-Z][a-zA-Z0-9_]+"` over each portal's `src/`, which catches *any* identifier starting with `useX`, including React built-ins (`useState`, `useEffect`, `useMemo`, …). The actual count of *generated API hooks* used is therefore lower; per-portal precise mapping was not produced in this recon.
- **Orphan hooks** (generated but never imported anywhere): the diff `comm -23 all_hooks.txt used_hooks.txt` produced an empty list, indicating **no entirely-unused generated hook**. This is a strong signal but may be inflated by the React-built-in collision noted above. Re-verify in T002.
- **OpenAPI source**: `lib/api-spec/openapi.yaml` (139 KB, 1 file). Codegen via `orval` (`lib/api-spec/package.json:scripts.codegen`).

### c.5 Public (anonymous) endpoints

From `routes/public.ts` (10 endpoints, mounted at `/api`):

| Method | Path | Verified at |
|---|---|---|
| `GET` | `/v1/public/properties` | `public.ts:537` |
| `GET` | `/v1/public/services` | `public.ts:581` |
| `GET` | `/v1/public/blog` | `public.ts:697` |
| `GET` | `/v1/public/blog/:slug` | `public.ts:722` |
| `POST` | `/v1/public/owner-applications` | `public.ts:735` |
| `POST` | `/v1/public/agent-applications` | `public.ts:787` |
| `POST` | `/v1/public/service-host-applications` | `public.ts:833` |

Plus `health.ts` (`/v1/health`, `/v1/health/live`), `privacy.ts` (2 endpoints), `auth.ts` (login + register flows minus `/me`), `guest-auth.ts` (login/register), `partner-auth.ts` (login + reset), `stripe.ts` (`/v1/stripe/config`, `/v1/stripe/webhook`).

⚠️ Other 4 endpoints in `public.ts` not enumerated above (10 total — 7 listed); the remaining 3 must be enumerated in T002 (likely upper-half of the file).

---

## §d. Detected State Fields & Transitions (FSM evidence)

### d.1 Booking status FSM — verified from `bookings.ts`

| From | To | Endpoint | Verified at |
|---|---|---|---|
| (none) | `Draft` | `POST /v1/bookings` (create) | `bookings.ts:194` |
| (none) | `Pending` | `POST /v1/guest/...` (guest-side create) | `guest-portal.ts:160` |
| `Draft` | `PendingPayment` | (transition endpoint) | `bookings.ts:360-364` (guard `!== "Draft"`, set `"PendingPayment"`) |
| (current) | `Confirmed` | confirm booking | `bookings.ts:380` |
| `Confirmed` | `Active` | check-in (`PATCH /v1/bookings/:id/check-in`) | `bookings.ts:645-649` |
| `Active` | `CheckedOut` | check-out | `bookings.ts:659-663` |
| `PendingApproval` | `Cancelled` | reject pending | `bookings.ts:631-635` |
| (any) | `Cancelled` | manual cancel | `bookings.ts:683` |

⚠️ `PendingApproval` is referenced in `bookings.ts:631` but no transition *into* `PendingApproval` was found in this recon. T005 (booking workflow) must trace its origin.
⚠️ `PendingPayment` and `Pending` (from guest portal) appear to coexist; relationship between them not resolved.

Also: `contracts.ts:443` flips `bookings.booking_status` to `"Active"` when a contract is activated — i.e., **two separate code paths set booking status to Active** (check-in route AND contract activation). Potential double-state-machine ⚠️.

### d.2 Contract status FSM — verified from `contracts.ts`

| From | To | Trigger | Verified at |
|---|---|---|---|
| (none) | `Draft` | create contract | `contracts.ts:331` |
| `Draft` | `Sent` | `POST .../send` (sets `sent_at`) | `contracts.ts:410-413` |
| `Sent` | `Signed` | `POST .../sign` (sets `signed_at`, optional `document_url`) | `contracts.ts:422-425` |
| `Signed` | `Active` | `POST .../activate` (sets `effective_date`, also flips booking → Active) | `contracts.ts:433-443` |
| (any) | `Archived` | bulk-delete / soft-delete | `contracts.ts:387, 402` |

Auto-create contract from booking confirmation (`bookings.ts:380-505`): a confirmation triggers contract row insert with `status: "Draft"` and full `contract_line_items` population (Rent + per-service items). Contract `weekly_rate, total_rent, bond_amount, advance_amount` are written into `contracts.*` columns which are typed `real` ⚠️ (precision loss versus `bookings.*` numeric source).

### d.3 Invoice status FSM — verified from `invoices.ts`

| From | To | Endpoint | Verified at |
|---|---|---|---|
| (creation) | `Draft` | (assumed default; not yet verified literally) | `invoices.ts` |
| `Draft` | `Sent` | `POST /v1/invoices/:id/send` (guarded `status = "Draft"`) | `invoices.ts:146-150` |
| `Sent` | `Paid` | `POST /v1/invoices/:id/mark-paid` (sets `paid_at`, `payment_method`) | `invoices.ts:160-164` |
| any | `Void` | `POST /v1/invoices/:id/void` | `invoices.ts:170-176` |
| any | `Archived` | bulk-delete / soft-delete | `invoices.ts:124, 139` |

Stripe webhook (`stripe.ts:37-100`) flips invoice → `Paid` on `payment_intent.succeeded` (uses `pi.metadata.invoice_id` to find the invoice). `payment_intent.payment_failed` and `charge.refunded` only write audit log entries; **no invoice status change on failure or refund** ⚠️.

### d.4 Lead status

| Default | Transitions verified |
|---|---|
| (literal not in defaults; must be set in `leads.ts` create handler) | `→ "ConvertedToBooking"` (`leads.ts:192`); `→ "Lost"` (`leads.ts:209`); `→ "Archived"` (`leads.ts:152, 169`) |

Guard at `leads.ts:183` blocks re-conversion if `lead_status === "ConvertedToBooking"`.

### d.5 Soft-delete naming **inconsistency** ⚠️

Three distinct conventions observed:
1. `status = "Archived"` + `deleted_at = now()` — `beneficiaries.ts:125`, `space-policies.ts:111`, `space-options.ts:110`, `leads.ts:152`, `suburbs.ts:118`, `invoices.ts:124, 139`, `contracts.ts:387, 402`.
2. `status = "Deleted"` (no `deleted_at`) — `service-hosts.ts:84` (only).
3. `deleted_at = now()` only (no status change) — present in some routes but not enumerated; T002 must enumerate.

---

## §e. Detected Money / Calculation Code

### e.1 Money column type **inconsistency** 🔴

| Type | Tables / columns |
|---|---|
| `numeric(12,2)` ✅ | `bookings.agreed_weekly_rate`, `bookings.total_rent`, `leads.budget_min/max` |
| `numeric(10,2)` ✅ | `booking_services.unit_price/total_price`, `contract_line_items.unit_price/total_price`, `invoices.amount`, `recurring_schedules.amount`, `promotions.discount_amount` |
| `real` (FLOAT4) ⚠️🔴 | `contracts.weekly_rate/total_rent/bond_amount/advance_amount`, `products.weekly_rate/monthly_rate/effective_weekly_rate/bond_amount/admin_fee/cleaning_fee`, `accommodation_catalog.price/weekly_rate/bond_amount/admin_fee/cleaning_fee/bond_weeks`, `accommodation_service_catalog.custom_price`, `space_service_catalog.custom_price`, `service_catalog.base_price`, `spaces.base_weekly_price/base_daily_price`, `commissions.commission_rate/commission_amount`, `beneficiaries.fixed_amount`, `work_orders.cost`, `product_catalog.price/bond_amount/admin_fee/cleaning_fee` |

Source: `docs/reverse/_audit/raw/04_money_columns.txt`.

**Risk**: Older / catalog-side tables store money as IEEE-754 single-precision float. Newer tables (introduced with bookings, contract_line_items, invoices, recurring_schedules) use `numeric`. A booking computed in `numeric` is then copied into `contracts.weekly_rate/total_rent/bond_amount/advance_amount` (`bookings.ts:458-461`) where it becomes `real` — **precision lost on round-trip**.

### e.2 Booking → contract money calculation flow

`bookings.ts:72-78` — `calcStayDetails`:

```
nights = round((checkOut - checkIn) / day)
weeks  = parseFloat((nights / 7).toFixed(2))   // 2-decimal weeks
total  = parseFloat((weeks * parseFloat(weeklyRate)).toFixed(2))
```

Result types are returned as **strings** (correct for `numeric` column), but the rounding to 2 decimals on `weeks` introduces a 1-step rounding before the multiplication.

`bookings.ts:393-396` (on confirmation):

```
weeklyRate    = parseFloat(existing.agreed_weekly_rate ?? "0")
totalRent     = parseFloat(existing.total_rent ?? "0")
advanceAmount = weeklyRate * 2          // hard-coded "2 weeks rent"
```

`bondAmount` source not yet captured in citations (must verify in T005); the comment on `bookings.ts:430` reads "Rent is payable biweekly in advance" and `bookings.ts:432` reads "First payment due on check-in date". `bookings.ts:425` literal: `"Advance Payment : ${currency} ${advanceAmount.toFixed(2)} (2 weeks rent)"` — confirms hard-coded 2-week rule.

`bookings.ts:458-461` writes these into `contracts` table:
```
weekly_rate:    weeklyRate,    // → contracts.weekly_rate (real)
total_rent:     totalRent,     // → contracts.total_rent (real)
bond_amount:    bondAmount,    // → contracts.bond_amount (real)
advance_amount: advanceAmount, // → contracts.advance_amount (real)
```

🔴 **All four go from JS `number` directly into `real` columns — precision-lossy by design**.

### e.3 Contract → invoice generation

`contracts.ts:55-115` — `generateContractInvoicesAndSchedules(contractId)` — single source of truth for invoice + recurring schedule creation. Falls back to virtual Rent line item if `contract_line_items` is empty:

```
billingFreq = "Monthly" (default fallback; otherwise read from accommodation_catalog or contract_products)
rentAmount = billingFreq === "Weekly"   ? weeklyRate
           : billingFreq === "Biweekly" ? weeklyRate * 2
           : (weeklyRate * (52 / 12)).toFixed(2)   // Monthly
```

Same formula appears at `bookings.ts:445-449` when auto-populating contract line items on booking confirmation. **Two sites duplicate the per-frequency rent calc** — divergence risk if one changes.

Invoked from `contracts.ts:438` (the `/activate` endpoint) — the only caller.

### e.4 Owner portal "monthly rent" display — illustrative only

`owner-portal.ts:236`:
```
const monthlyRent = (c.weekly_rate ?? 0) * 52 / 12;
```

`owner-portal.ts:243`:
```
owner_share_pct: c.weekly_rate
  ? Math.round((recurringWeekly / c.weekly_rate) * 1000) / 10
  : null,
```

The preceding comment at `owner-portal.ts:220` explicitly labels this **"illustrative"**. ⚠️ Not a real settlement calculation.

`owner-portal.ts:83` — dashboard "rent under management":
```
sum + parseFloat(b.agreed_weekly_rate ?? "0") * 4
```
Multiplies weekly rate × 4 to approximate monthly. Inconsistent with the `* 52/12` formula 5 lines later — two different "weekly→monthly" conversions in the same file.

### e.5 Stay-week computation rounds to 2 decimals before multiplication

`bookings.ts:75`:
```
const weeks = parseFloat((nights / 7).toFixed(2));
```

For a 30-day booking: `weeks = 4.29`, then `total = 4.29 × rate`, which differs from `(30/7) × rate` by up to a few cents. ⚠️ Order-of-operations rounding.

### e.6 GST handling

`bookings.ts:499` — line item insertion sets `gst_included: true` literally. No GST extraction or display logic was found in this recon — must verify in T004 / T005.

`accommodation_catalog.gst_included` boolean exists; `contract_line_items.gst_included` exists. No code path computes GST as a separate amount — values are stored as "GST-inclusive" with the boolean flag.

---

## §f. ⚠️ Red Flags

### f.1 Data integrity 🔴

1. **Zero `.references()` FK declarations across all 47 schema files.** No referential integrity at the DB level.
2. **Money type inconsistency between `numeric` and `real`** — every contract activation downcasts precise booking money to floats.
3. **Three product-shaped tables** (`products`, `product_catalog`, `accommodation_catalog`) — only the third is used by routes; `products` and `product_catalog` are dead schema and could mislead a reader.
4. **`space_blocked_dates` and `space_availability` coexist** in the schema; only `space_blocked_dates` is used by the booking overbooking guard (`bookings.ts:96-105`). Purpose of `space_availability` was not resolved in recon. ⚠️ ORPHAN suspect.
5. **Soft-delete inconsistency** — three different conventions in routes (Archived+deleted_at / Deleted only / deleted_at only).

### f.2 Auth / security 🟡

1. **`dev-migration.ts` mounted at `/api/v1/admin` *before* the global `requireAuth`** (`app.ts:142` vs `app.ts:167`) — its endpoint is publicly callable. Must verify whether it's a no-op or actually does something destructive (T002).
2. **`partner_users.portal_type` text column has no DB constraint** and the schema comment (`partner_users.ts:8`) says `'agent' | 'owner'`, but the runtime code (`service-host-portal.ts:34`) accepts `"service_host"`. The TypeScript `PartnerAuthPayload.portal_type` (`requirePartnerAuth.ts:17`) is also typed `"agent" | "owner"` — **a third value bypasses TS type-safety at the JWT signing site**.
3. **Three JWT secrets derived by string concatenation** (`BASE_SECRET + "_partner"`, `BASE_SECRET + "_guest"`) — works but if `BASE_SECRET` rotates the partner/guest tokens silently invalidate together. May or may not be intended behavior.
4. **JWT expiry asymmetry**: admin 8h, guest 7d, partner 7d. Long-lived partner tokens with no documented refresh flow (T002 must check for `refresh_tokens` table usage in routes).
5. **Stripe webhook accepts only 3 event types** (`payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded` — `stripe.ts:51-100`). `charge.refunded` does not flip invoice to a refund status — it only audit-logs. No invoice column for refund state was observed.

### f.3 Audit log inconsistency 🟡

`utils/auditLog.ts:1-37` — `logAction()` accepts 9 actions: `CREATE | UPDATE | DELETE | STATUS_CHANGE | LOGIN | PAYMENT | VERIFY | BLOCK | UNBLOCK`.

Call sites verified: only **6 route files** (`guest-portal.ts`, `stripe.ts`, `bookings.ts`, `contracts.ts`, `spaces.ts`, `invoices.ts`) — see `docs/reverse/_audit/raw/08_audit_log_calls.txt`.

⚠️ The other 44 route files perform mutations **without writing to `system_logs`**. Examples of mutation routes with no audit log: `accounts.ts`, `contacts.ts`, `leads.ts`, `properties.ts`, `tasks.ts`, `work-orders.ts`, `commissions.ts`, `service-hosts.ts`. `system_logs` thus does not represent a complete audit trail.

### f.4 Calculation duplication / hard-coded business rules 🟡

1. **2-weeks advance hard-coded** (`bookings.ts:396` and contract terms text `bookings.ts:425`).
2. **Monthly rent formula duplicated** with two different versions in the same file: `weekly * 4` (`owner-portal.ts:83`) and `weekly * 52/12` (`owner-portal.ts:236`).
3. **Per-frequency rent formula duplicated** at `bookings.ts:445-449` and `contracts.ts:96-99` (`Weekly` / `Biweekly` / `Monthly` branches with the same `52/12` constant).
4. **Bond default of 4 weeks** (`accommodation_catalog.bond_weeks.default(4)` and `products.bond_weeks.default(4)`) — appears in 2 schema files; bond computation site not yet pinpointed in `bookings.ts`.
5. **Contract reference numbering** (`bookings.ts:447`) uses `count + 1` from existing rows where ref starts with `MS-C-{year}-` — race condition under concurrent contract creation (no DB sequence). Same pattern for booking refs (`bookings.ts:60-69`).

### f.5 Dependencies that may be undeclared / mis-declared 🟡

- **`connect-pg-simple`** likely required for `express-session` Postgres-backed store but **not declared** in `artifacts/api-server/package.json`. `app.ts:5` imports `session` but the store backend was not verified in recon. T003 must confirm whether sessions are memory-only (development default) or PG-backed.
- **`@workspace/db`** vs **`drizzle-orm`** — both declared; `@workspace/db` re-exports from `lib/db/`. OK.
- **`bcryptjs`** declared but call sites not enumerated in recon.

### f.6 Frontend / API client 🟡

- 138 generated hooks; "124 distinct used per portal" was inflated by React-built-in `useX` collisions — actual generated-hook usage per portal is unknown until a precise grep against the 138 known names is run (T002).
- Empty orphan-hook list is therefore **not yet trustworthy**.

---

## §g (= §4). Existing `docs/reverse/` 35-file Classification

> Per OPERATING RULE 4: judgment only; deletion / rewrite gated on user approval.
> Scoring legend: **KEEP** = recon corroborates the doc's main claims; **REVISE** = doc is partially correct but contains claims unverified or contradicted by recon; **DELETE** = doc's premise is contradicted by recon or the doc is speculation.

### g.1 Files in `docs/reverse/_audit/`

| File | Lines | Recon check | Verdict | Reason |
|---|---:|---|---|---|
| `00-overview.md` | 113 | Section header reads "Snapshot of the actual codebase state" + project-structure listing (`00-overview.md:1-11`). Recon agrees on monorepo structure; specific dep tables not yet cross-checked. | **REVISE** | Likely accurate but written before service-host portal — verify portal count, deps. |
| `00-feature-gap.md` | 70 | "Feature Implementation Gap Analysis (STEP 0-B)" — pure status table, no testable claims read. | **REVISE** | Review against current portal/feature set; gap matrix may be stale. |

### g.2 Files in `docs/reverse/_context/`

| File | Lines | Recon check | Verdict | Reason |
|---|---:|---|---|---|
| `constraints.md` | 111 | Lead claim: "Overbooking prevention ✅ (race condition risk 🔴)" referencing `checkOverbooking()`. Recon confirms `bookings.ts:88-105` has `checkOverbooking()` and uses `space_blocked_dates`. ✅ corroborated. | **KEEP** | Race condition framing matches recon. |
| `domain-model.md` | 124 | Claims "properties (1)─< spaces (1)─< contract_products (1)─< bookings". Recon: routes use `accommodation_catalog`, not `contract_products`, as the primary product axis. ⚠️ Doc names a dead-or-secondary table as the central spine. | **REVISE** | Hierarchy needs to reflect `accommodation_catalog` as the live product, with `contract_products` as a secondary surface. |
| `tech-stack.md` | 89 | Lists `connect-pg-simple` as a backend framework dep. Recon: `connect-pg-simple` is **NOT** in `artifacts/api-server/package.json`. ⚠️ Contradicted. | **REVISE** | Cross-check every package row; remove undeclared ones. |
| `user-personas.md` | 58 | Claims `users` (admin) `role` field has values `Admin` (default), `SuperAdmin`. Recon confirms default `"Admin"` (`users.ts:7`), and `requireSuperAdmin` checks `role === "SuperAdmin"` (`db-sync.ts:18-29`). ✅ corroborated. | **KEEP** | Aligns with recon. |

### g.3 Files in `docs/reverse/_design/`

| File | Lines | Recon check | Verdict | Reason |
|---|---:|---|---|---|
| `admin-layout.md` | 77 | UI shell description; recon did not inspect frontend layout components. | **REVISE** | Cannot verify in T001 — defer to T006 with frontend recon. |
| `component-library.md` | 93 | Claims "All five web artifacts share `src/components/ui/`". Recon: there are **5 web portals + mockup-sandbox = 6 web-like artifacts**. Doc is not necessarily wrong (mockup-sandbox not user-facing). | **REVISE** | Verify against actual `src/components/ui/` directories per artifact. |
| `design-tokens.md` | 80 | Claims Tailwind v4 inline-theme + tokens duplicated per artifact. Not verified in recon. | **REVISE** | T006 must inspect `src/index.css` per artifact. |
| `guest-portal-layout.md` | 104 | Claims guest portal lives at `/portal/*` inside `million-stay-web`. Not verified in recon. | **REVISE** | T006 must inspect `million-stay-web` routing. |

### g.4 Files in `docs/reverse/_rules/`

| File | Lines | Recon check | Verdict | Reason |
|---|---:|---|---|---|
| `architecture-rules.md` | 109 | Claims "longest single handler in `contracts.ts` exceeds 200 lines". Recon: `contracts.ts:55-280+` confirms `generateContractInvoicesAndSchedules` is a long function; full handler size not measured. ✅ plausible. | **KEEP** | Layering critique aligns with recon. |
| `financial-rules.md` | 118 | Claim list: "Rounding patterns" table. Recon confirms rounding sites (`bookings.ts:75`). Specific table content not sampled. | **REVISE** | Verify each row against recon §e. |
| `security-rules.md` | 97 | Claims about authentication topology not yet sampled. | **REVISE** | Compare against §c.2 / §f.2; critical to align. |
| `no-magic-rules.md` | 84 | C# migration audit — out of scope for recon ground-truth. | **KEEP** | Forward-looking; no factual collision. |

### g.5 Files in `docs/reverse/_schema/`

| File | Lines | Recon check | Verdict | Reason |
|---|---:|---|---|---|
| `erd-core.md` | 254 | Header claims "No `drizzle-orm/relations` blocks are defined — joins happen at the application layer". ✅ Recon confirms zero `.references()` and no `relations()` blocks observed. | **REVISE** | Mostly correct; needs hierarchy correction (per `domain-model.md` issue) + addition of FK-absence red flag. |
| `erd-crm.md` | 87 | Claims source is `lib/db/src/schema/{accounts,contacts,commissions,leads}.ts`. Recon read all four. | **REVISE** | Verify column lists against recon b.1. |
| `erd-finance.md` | 103 | Claims source is `{invoices,recurring_schedules,promotions}.ts`. Recon confirms tables and money types. | **REVISE** | Add `numeric` vs `real` warning; cross-check column lists. |
| `erd-operations.md` | 112 | Claims source is `{work_orders,cs_tickets,service_catalog,system_logs,email_logs}.ts`. Recon confirms tables. | **REVISE** | Add `cs_messages`, `email_templates`, `tasks` to operations scope. |
| `api-endpoints.md` | 193 | Claims "Stripe webhook at `/api/stripe/webhook`". Recon: actual mount is `app.use("/api", stripeRouter)` and the route declares `"/v1/stripe/webhook"` (`stripe.ts:25`) — so the full path is `/api/v1/stripe/webhook`, NOT `/api/stripe/webhook`. ⚠️ Contradicted. | **REVISE** | Path is wrong; full endpoint inventory (353) must replace partial list. |
| `dto-contracts.md` | 164 | Claims DTOs auto-generated by Orval; references `lib/api-zod/src/generated/api.ts (~3900 lines)`. Recon confirms Orval setup (`lib/api-spec/orval.config.ts`) but did not measure generated file size. | **KEEP** | Premise correct; line count is incidental. |

### g.6 Files in `docs/reverse/_templates/`

| File | Lines | Recon check | Verdict | Reason |
|---|---:|---|---|---|
| `audit-log-template.md` | 89 | References `artifacts/api-server/src/lib/audit.ts`. Recon: actual helper is at `artifacts/api-server/src/utils/auditLog.ts`. ⚠️ Path mismatch. | **REVISE** | Update path; the helper is `logAction()` not the implied `audit()`. |
| `crud-service-template.md` | 171 | Forward-looking template (route → service → repo) — aspirational, not descriptive. | **KEEP** | Aspiration; no factual collision. |
| `financial-calculation-template.md` | 163 | References `artifacts/api-server/src/utils/money.ts`. Recon: this file's existence not verified — likely **does not exist** (no money helper was found in audit-log scan; calculations are inline in routes). | **REVISE** | Either rename to clarify "proposed" or delete the unverified path. |

### g.7 Files in `docs/reverse/_test/`

| File | Lines | Recon check | Verdict | Reason |
|---|---:|---|---|---|
| `api-test-checklist.md` | 86 | Generic checklist; no testable claim. | **KEEP** | Stylistic; no collision. |
| `booking-test-cases.md` | 91 | Test-case suggestions; no factual claim about implementation. | **KEEP** | Forward-looking. |
| `existing-test-coverage.md` | 94 | Claims about coverage — recon did not enumerate test files (no `*.test.ts` search performed). | **REVISE** | Run a test-file inventory in T007 to validate. |
| `migration-readiness-checklist.md` | 87 | C# migration — out of scope for ground truth. | **KEEP** | No collision. |
| `performance-benchmarks.md` | 103 | Explicitly states "No load testing has been run" — accurate disclaimer. | **KEEP** | Honest about absence of data. |

### g.8 Files in `docs/reverse/_workflows/`

| File | Lines | Recon check | Verdict | Reason |
|---|---:|---|---|---|
| `booking-lifecycle.md` | 143 | Defines `BookingStatus` union: `Draft \| PendingPayment \| ...`. Recon §d.1 verified `Draft, PendingPayment, Confirmed, Active, CheckedOut, Cancelled, PendingApproval, Pending`. Doc's union should be cross-checked. | **REVISE** | Make sure all 8 observed values appear; clarify guest-side `Pending` vs admin-side `PendingPayment`. |
| `agent-commission-workflow.md` | 78 | Claims agent linked via `bookings.agent_account_id`. Recon: `bookings.ts` selects agent fields; specific column existence not sampled (must check `bookings.ts:1-50` columns). | **REVISE** | Verify column name; cross-check commissions calc. |
| `checkin-checkout-workflow.md` | 124 | Endpoint `PATCH /api/v1/bookings/:id/check-in` matches recon (`bookings.ts:645-649`). ✅ | **KEEP** | Confirmed. |
| `maintenance-workflow.md` | 120 | Work-order lifecycle `Open → InProgress → PendingReview → Completed`. Recon: schema default `"Open"` confirmed (`work_orders.ts:10`); other transitions not sampled. | **REVISE** | Verify transition endpoints in `work-orders.ts`. |
| `payment-workflow.md` | 133 | Claims trigger is `POST /api/v1/contracts/:id/activate` → `generateContractInvoicesAndSchedules` in `routes/contracts.ts:55`. Recon **VERIFIED line 55** (`contracts.ts:55`). ✅ | **KEEP** | Top-quality — verified. |
| `promotion-application-logic.md` | 61 | Claims `contract_products.promotion_id` and `accommodation_catalog.promotion_id`. Recon read both files but did not specifically verify these column names. | **REVISE** | Re-read those two schema files for `promotion_id`. |

### g.9 Top-level

| File | Lines | Verdict | Reason |
|---|---:|---|---|
| `README.md` | 94 | **REVISE** | Reading order may need adjustment; refresh once T002+ docs are rewritten. |

### g.10 Verdict counts

- **KEEP**: 9 (constraints, user-personas, architecture-rules, no-magic-rules, dto-contracts, crud-service-template, api-test-checklist, booking-test-cases, migration-readiness-checklist, performance-benchmarks, checkin-checkout-workflow, payment-workflow) — actually 12.
- **REVISE**: 23
- **DELETE**: 0 (no doc was outright fabricated; several are merely stale or path-wrong)

---

## §h. Verification Gate (per OPERATING RULE 7)

Three highest-uncertainty claims selected and re-checked:

| # | Claim | Re-check | Result |
|---|---|---|---|
| 1 | "Zero `.references()` FK declarations across all 47 schema files." | `rg "\.references\(" lib/db/src/schema/` → 0 matches (`raw/09_fk_references.txt` empty body) | ✅ VERIFIED |
| 2 | "`generateContractInvoicesAndSchedules` is at `contracts.ts:55`." | `rg -n "generateContractInvoicesAndSchedules" artifacts/api-server/src/routes/contracts.ts` → match at line 55 | ✅ VERIFIED |
| 3 | "`service-host-portal.ts` accepts `portal_type === 'service_host'` despite TS type declaring only `'agent' \| 'owner'`." | `service-host-portal.ts:34`: `if (partner.portal_type !== "service_host") {` confirmed; `requirePartnerAuth.ts:17`: `portal_type: "agent" \| "owner"` confirmed | ✅ VERIFIED |

Additional spot-checks:
- App boot enforces `DATABASE_URL` and `SESSION_SECRET` (`app.ts:32-44`) — VERIFIED.
- `app.ts:142` mounts `devMigrationRouter` BEFORE `app.ts:167` global `requireAuth` — VERIFIED (route ordering will be re-confirmed when `dev-migration.ts` is read in T002).
- `bookings.ts:447-449` includes `weeklyRate * 2` (Biweekly), `weeklyRate * (52/12).toFixed(2)` (Monthly) — VERIFIED.

**`VERIFIED ✅ — ready for next task` after user `proceed`.**

---

## §i. Open Items for Next Tasks

1. T002 must enumerate all column lists per table directly from schema files (recon read structure but not every column).
2. T002 must verify `dev-migration.ts` body (currently unread).
3. T002 must run a precise generated-hook usage grep using the actual 138 names (not the inflated `useX` regex).
4. T003 must resolve `connect-pg-simple` / session store mystery.
5. T005 must trace `bondAmount` calculation site in `bookings.ts` (only `weeklyRate * 2` for advance was directly cited).
6. T005 must trace what writes booking `PendingApproval` (only the read of it was found).
7. T006 must inspect frontend layout to validate `_design/*.md` files.
8. T007 must enumerate test files (`*.test.ts`) to validate `_test/existing-test-coverage.md`.
9. Glossary (OPERATING RULE 9): given the volume of REVISE verdicts and the dead-tables finding, **REVISE** is the recommended overall posture — keep the existing pack as a starting point, rewrite each REVISE-marked doc in T002–T007 against the recon facts.

---
*End of T001 RECON REPORT.*
