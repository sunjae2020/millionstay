# MillionStay Architecture

## Overview

This pnpm workspace monorepo, built with TypeScript, provides a comprehensive property management SaaS solution called MillionStay. It includes an admin portal, a guest-facing booking portal, and dedicated portals for property agents and owners. The project aims to streamline property management operations, enhance guest experience, and provide specialized interfaces for various stakeholders.

## User Preferences

- I prefer clear and concise communication.
- Focus on high-level architecture and key features.
- Provide practical examples where appropriate.
- When suggesting code changes, explain the reasoning and potential impact.
- Prioritize well-structured and maintainable code.
- Always ask for confirmation before implementing significant architectural changes or adding new external dependencies.

## System Architecture

The project utilizes a pnpm workspace monorepo structure, with each package managing its own dependencies. Node.js 24 and TypeScript 5.9 are used across the board. The API is built with Express 5, backed by PostgreSQL and Drizzle ORM for database interactions. Zod is used for validation, and Orval generates API client code from an OpenAPI specification. Bundling is handled by esbuild.

**UI/UX Decisions:**

- **Property Admin:** A multi-module property management SaaS admin tool built with React and Vite. It features various dashboards (Overview, Reservations, Finance, Operations) with KPI stat cards, charts (recharts), and tables. It includes comprehensive CRUD interfaces for property management, CRM, sales, booking, products, contracts, finance, and maintenance modules. Custom components like `StatusBadge`, `LookupField`, `LookupSelect`, and `MultiLookupField` are used for consistent UI elements. The admin panel supports internationalization for EN, KO, ZH, JA, and TH.
- **MillionStay Guest Portal:** A guest-facing booking portal built with React and Vite, featuring a brand color of `#E8621A` (orange). It supports i18n (EN/JA/KO/ZH) and uses Zustand for state management. Pages include Home, Search (with Leaflet map), Space Detail, Booking flow, and user portals for bookings, invoices, and documents.
- **Partner Portals (Agent, Owner & Service Host):** Separate React + Vite web applications providing tailored views for agents, property owners, and service providers. The Agent Portal allows agents to view bookings, managed properties, and commissions. The Owner Portal enables owners to monitor property occupancy and revenue, with privacy masking for tenant names. The Service Host Portal lets cleaners, pickup drivers and similar service providers view assigned jobs, their schedule, and earnings.
- **Service Host Portal (port 21888, /service-host-portal):** Dashboard, My Jobs (with calendar/list toggle), Schedule (calendar default), Earnings, Job Detail (photos + editable Status & Notes). Demo: `host@millionstay.com.au` / `Host@2026!`. `portal_type = service_host` in partner_users. Jobs sourced from `booking_services` where `service_id` matches `service_hosts.id` linked to the partner's `account_id`. Allowed job statuses: `Active|Processing|Completed|Cancelled` (writes via `PATCH /api/v1/service-host/jobs/:id`); admin equivalent is `PATCH /api/v1/bookings/:id/services/:svcId`. Job list endpoints filter by `ne(status,"Deleted")` so non-Active statuses remain visible to both admin and host.

**Technical Implementations:**

- **API Server:** An Express-based API server handling all backend logic. Routes are versioned under `/api/v1/`. Lookup endpoints consistently return `{ id, display }` objects.
- **Database Schema:** A PostgreSQL database managed by Drizzle ORM, with 31 tables covering all aspects of property, booking, finance, and user management. Key tables include `accommodation_catalog` (unified product management), `cs_tickets` and `cs_messages` for customer support, `partner_users` for agent/owner authentication, and `blog_posts` for CMS blog content with full SEO metadata, categories, and soft delete support.
- **Blog / Content Module:** Admin blog CRUD at `/content/blog` in property-admin (rich text editor, SEO tab, image URL, status/category/author, bulk archive/delete). Blog detail has a **Translations** tab with language sub-tabs (KO, ZH, JA, VI) — translations stored as JSONB in `blog_posts.translations` column and saved with main post. Public endpoints: `GET /api/v1/public/blog` and `GET /api/v1/public/blog/:slug` (unauthenticated). Public pages at `/blog` (listing with category filters) and `/blog/:slug` (full post) in million-stay-web. About page dynamically fetches 3 latest published posts from API, falling back to static placeholders.
- **Website Pages Content Manager:** Admin pages at `/content/pages` → list of 6 editable public pages (Home, For Students, For Agent, About, FAQ, Contact). Detail page (`/content/pages/:pageKey`) has language tabs (EN, KO, ZH, JA, VI) each with a **Content** sub-tab (page-specific section fields) and **SEO** sub-tab (title, description, keywords + live search preview). Content stored in `page_contents` table (unique per page_key + language). API: `GET /api/v1/page-contents/:pageKey`, `PUT /api/v1/page-contents/:pageKey/:language` (upsert, auth required). Page sections are defined per-page in `PAGE_FIELDS` constant in `WebsiteContentDetail.tsx`.
- **Authentication:** JWT-based authentication for guests, admins, and partners. Partner authentication (`PARTNER_JWT_SECRET`) is handled separately and requires careful routing order in Express to prevent conflicts with admin authentication. Hardcoded JWT/session secret fallbacks have been removed; `app.ts` now validates `DATABASE_URL` and `SESSION_SECRET` at boot and exits if missing. CORS is enforced via an allow-list (`ALLOWED_ORIGINS` env, plus auto-allow for `*.millionstay.com` over https, and `localhost` in non-production).
- **Refresh Tokens (Sprint A-5):** `refresh_tokens` table (UUID PK) stores SHA-256 hashed refresh tokens with 30-day TTL. Endpoints: `POST /api/v1/auth/login` returns `{ token, refresh_token }`; `POST /api/v1/auth/refresh` rotates (revokes old, issues new); `POST /api/v1/auth/logout` accepts `refresh_token` body to revoke; password reset bulk-revokes all tokens for the user. Service: `artifacts/api-server/src/lib/refreshTokens.ts`. Access token TTL currently 8h pending client adoption of refresh flow.
- **Cloudinary Signed URLs (Sprint A-6):** `generateSignedUrl(publicId, expiresInSeconds)` and `uploadPrivateToCloudinary(buffer)` helpers in `utils/cloudinary.ts` for sensitive files (passport, contracts, invoices). Public marketing assets (`space_images`) intentionally remain on permanent URLs for SEO/CDN caching.
- **DB Migration Tooling (Sprint A-4):** Workspace `@workspace/db` exposes `db:push` / `db:push-force` (existing) plus new `db:generate` / `db:migrate` / `db:studio` scripts. Generated SQL migrations live in `lib/db/drizzle/`. Baseline `0000_violet_morgan_stark.sql` captures the full current schema. `db:push` remains primary for dev sync; `db:generate` workflow is recommended for prod-bound changes going forward.
- **Numeric Money Columns (Sprint A-1):** `invoices.amount` and `promotions.discount_amount` are `numeric(10,2)`. Drizzle returns these as strings — wrap with `Number()` before arithmetic (see `routes/dashboard.ts:72`).
- **Marketing Consent (Sprint B-1):** `marketing_consents` table (UUID PK, unique on email+channel) records opt-in/out per channel for Spam Act 2003 compliance. Endpoints: `GET /api/v1/privacy/unsubscribe?token=...` (HTML confirmation page from email link) and `POST /api/v1/privacy/unsubscribe` (JSON for in-app). Tokens are HMAC-SHA256 signed via `SESSION_SECRET`, 90-day TTL, no DB lookup needed. Helper: `lib/unsubscribeToken.ts` `buildUnsubscribeUrl(email)` for embedding in marketing emails. Booking/transactional emails do NOT count as marketing.
- **Document Retention (Sprint B-2):** `documents` table (UUID PK) stores sensitive uploaded files (passports, contracts, tax invoices, receipts) with mandatory `retention_until` per APP 11. Helper `lib/retention.ts` `calcRetentionDate(docType)` applies: tax_invoice/receipt 5yr (ATO), contract 7yr, id_document/visa_document 30 days, other 2yr. Manual purge: `tsx artifacts/api-server/scripts/purge-expired-documents.ts --apply` (dry run without `--apply`). Existing `space_images` and `booking_service_photos` intentionally remain in their own tables (not personal information).
- **My Data — Right of Access (Sprint B-4):** `GET /api/v1/guest/me/data` (requires guest JWT) returns full personal-information dump for APP 12 — `{profile, account, emergency_contacts, bookings, invoices, documents, marketing_consents}` plus `counts`. `password_hash` is excluded. `?format=download` adds `Content-Disposition` to save as `millionstay-mydata-<email>-<date>.json`. Sole-owner guard: bookings/invoices are returned only when the requesting guest is the only `guest_users` row sharing that `account_id` (prevents leakage on shared accounts). Documents include both `entity_type='guest_user'` and `entity_type='booking'` records linked to the user's bookings. Frontend page `pages/portal-my-data.tsx` (sidebar nav `portal.nav.my_data`, Shield icon, route `/portal/my-data`) renders sectioned tables with masked banking (`***-XXX` for BSB, `••••XXXX` for account), Refresh + Download (JSON) buttons. i18n: ko/en/zh/ja/th.
- **Privacy Policy & NDB Runbook (Sprint B-3 + B-5):** `pages/privacy-policy.tsx` (effective 2026-04-19) covers all 13 APPs explicitly (APP 1 governance, APP 2 anonymity, APP 3–5 collection, APP 6 use & disclosure, APP 7 marketing/Spam Act, APP 8 overseas — Railway/Vercel/Cloudinary/Resend/Stripe all US, APP 9 government identifiers, APP 10 quality, APP 11 security & retention with code-accurate periods, APP 12–13 access via `/portal/my-data`), plus NDB scheme + complaints. Privacy Officer mailbox: `millionstay.com@gmail.com` (used consistently in policy, `/portal/my-data` correction footer, and unsubscribe error pages). Internal runbook at `docs/NDB_INCIDENT_RUNBOOK.md` defines roles, triggers, containment matrix, serious-harm assessment, OAIC + individual notification (email channel), sub-processor escalation contacts, 7-year retention, annual tabletop drill; notification email template at `docs/templates/ndb_notification_email.md`.
- **Security Hardening (Sprint B-6):** (1) `utils/fileValidator.ts` `validateMimeBySignature(buffer, mime)` checks magic bytes for PDF/JPEG/PNG/WebP/GIF. (2) `utils/passwordPolicy.ts` `validatePassword(pw)` enforces 12+ chars + lowercase + uppercase + digit + special — applied to admin/guest/partner register/reset/change endpoints. Existing accounts unaffected until they change their password. (3) `lib/loginLockout.ts` records each admin login attempt; 5 failures within 15 min for the same email returns 429 with `Retry-After` header for 15 min cooldown. Successful login resets the failure streak.
- **API Client:** Generated from an OpenAPI specification using Orval, providing React hooks and Zod schemas for type-safe API interactions.
- **Internationalization:** Implemented using `react-i18next` with locale files for multiple languages. Language preference is persisted in `localStorage`.
- **Key Patterns:** Consistent lookup endpoint formats (`{ id, display, ...extra }`), `enrichXxx()` server-side functions for data enrichment, FSM transitions via dedicated POST endpoints, and standardized reference formats (e.g., `MS-WO-YYYY-NNNNN`). Zod schemas from `@workspace/api-zod` are preferred for validation.

## External Dependencies

- **pnpm:** Monorepo package manager.
- **Node.js:** Runtime environment (version 24).
- **TypeScript:** Programming language (version 5.9).
- **Express:** Web application framework (version 5).
- **PostgreSQL:** Relational database.
- **Drizzle ORM:** TypeScript ORM for PostgreSQL.
- **Zod:** Schema declaration and validation library (v4).
- **Orval:** OpenAPI client code generator.
- **esbuild:** JavaScript bundler.
- **React:** JavaScript library for building user interfaces.
- **Vite:** Next-generation frontend tooling.
- **react-i18next:** Internationalization framework for React.
- **Zustand:** Small, fast, and scalable bearbones state-management solution.
- **Leaflet:** JavaScript library for interactive maps (used in Guest Portal search).
- **Recharts:** Composable charting library built with React and D3 (used in Admin Finance Dashboard).
- **Cloudinary:** Cloud-based image and video management service (for CS ticket image uploads).