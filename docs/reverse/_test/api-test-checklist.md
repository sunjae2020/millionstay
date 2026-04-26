# API Test Checklist

> ✅ **T001-RECON-VERIFIED** 2026-04-26 — corroborated by `docs/reverse/_audit/T001_RECON_REPORT.md` §g.


A general checklist to apply to **every** endpoint before it is considered production-ready.

## 1. Generic checklist (per endpoint)

| # | Check |
|---|---|
| 1 | Auth middleware applied (unless intentionally public) |
| 2 | Returns 401 when token missing or invalid |
| 3 | Returns 403 when role not authorized |
| 4 | Returns 404 for non-existent or soft-deleted resource |
| 5 | Returns 400 with structured error on validation failure (Zod) |
| 6 | Returns 409 when state guard fails (e.g., wrong status) |
| 7 | Returns 429 if rate-limited (auth endpoints) |
| 8 | Returns 500 with no internal stack details exposed |
| 9 | All responses use the standard envelope (`{data}` / `{success:false,error:{code,message}}`) |
| 10 | Side effects (audit log, email, blocked dates, contract creation) happen in the same transaction |
| 11 | Soft-deleted rows excluded from list / get queries |
| 12 | Sensitive fields stripped from response (password_hash, reset_token, raw bank/passport) |
| 13 | Pagination respected on list endpoints |
| 14 | Idempotent for safe verbs (`GET`, `PUT` with full payload) |
| 15 | Transactions wrap any multi-row write |

## 2. Auth-specific

| # | Check |
|---|---|
| A-1 | Login with correct creds → 200 + JWT + refresh cookie |
| A-2 | Login with wrong password → 401 + attempt recorded |
| A-3 | 5 wrong attempts in 15 min → 429 + Retry-After |
| A-4 | Refresh with valid token → new access + new refresh; old refresh revoked |
| A-5 | Refresh with revoked token → 401 |
| A-6 | Logout revokes refresh + destroys session |
| A-7 | Password policy enforced on register / reset / change |
| A-8 | Tokens from other portals reject (e.g., guest token on admin endpoint) |
| A-9 | Concurrent logins from two devices both work; logout from one does not invalidate the other |
| A-10 | Reset token single-use; second attempt → 401 |

## 3. CRUD-specific

For each resource (`accounts`, `contacts`, `properties`, `spaces`, `contract_products`, `bookings`, `contracts`, `invoices`, `work_orders`, `cs_tickets`, `promotions`, `commissions`, `leads`, `tasks`):

| # | Check |
|---|---|
| C-1 | `POST` with valid body → 201 + new row + audit log |
| C-2 | `POST` with extra unknown fields → either ignored or 400 (decide globally — recommend `.strict()`) |
| C-3 | `GET /:id` of own row → 200 |
| C-4 | `GET /:id` of foreign row (non-admin role) → 404 |
| C-5 | `PUT/PATCH` with valid body → 200 + audit log |
| C-6 | `DELETE` → soft delete (`deleted_at` set) + audit log |
| C-7 | `GET /` honours `?page`, `?limit`, `?sort`, filter params |
| C-8 | List excludes soft-deleted rows |

## 4. Privacy / compliance

| # | Check |
|---|---|
| P-1 | `GET /v1/guest/me/data` returns full snapshot when guest is sole owner of account |
| P-2 | `GET /v1/guest/me/data` returns empty bookings/invoices arrays when account has multiple guest_users |
| P-3 | Bank fields are masked (BSB → `***-XXX`, account → `••••XXXX`) |
| P-4 | `password_hash` never appears in any response |
| P-5 | Document download uses signed Cloudinary URLs (expiry < 24h) |
| P-6 | HMAC unsubscribe link works without auth |
| P-7 | Marketing consent opt-out updates `marketing_consents.opted_out_at` |
| P-8 | Document past `retention_until` is hard-deleted by purge script |

## 5. Financial

| # | Check |
|---|---|
| F-1 | Invoice amount returned as string (Drizzle `numeric`) and the client converts correctly |
| F-2 | Stripe webhook signature verified |
| F-3 | Stripe webhook is idempotent (same event ID twice → no double-marked-paid) |
| F-4 | `PUT /v1/invoices/:id` rejects if status is `Paid` or `Void` (after C-04 fix) |
| F-5 | Commission calculation matches the stored snapshot — does NOT recompute live (after AC-01 fix) |

## 6. Operational

| # | Check |
|---|---|
| O-1 | Health endpoints (`/healthz`, `/api/v1/health`) return 200 < 100 ms |
| O-2 | Server boots without unhandled rejections |
| O-3 | DB connection pool releases on every request |
| O-4 | Email send failures degrade gracefully (no 500 on the user request) |
| O-5 | Cloudinary outage degrades gracefully on document upload (returns 503, no orphan DB row) |
