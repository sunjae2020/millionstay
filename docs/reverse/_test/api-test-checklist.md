# API Test Checklist

> ✅ **T001-RECON-VERIFIED** 2026-04-26 — corroborated by `docs/reverse/_audit/T001_RECON_REPORT.md` §g.
> ✅ **T007-LIGHT-TOUCH** 2026-04-27 — 본문 보존, T002~T006 자산 cross-ref. CF anchor 추가:
> - **§1 #5 Zod validation** = CF-017 (5.4% admin floor → 83% blog ceiling 양극단; Phase 2 baseline)
> - **§1 #7 Rate-limited 429** = CF-024 (auth route lockout 만 존재; 11/11 도메인 rate limiting 부재 — 본 체크 = positive assertion)
> - **§1 #10 Side effects in transaction** = CF-014 max carrier `contracts.ts:55-237` ≥27 mutation 0 tx; CF-008 audit log Tx 안 → ghost log 회피
> - **§1 #11 Soft-deleted excluded** = CF-020 leak (현재 9/11 도메인 affected)
> - **§1 #12 Sensitive fields stripped** = CF-013 PII text 형식 (DOB / passport / visa)
> - **§2 A-3 5 wrong attempts → 429** = `auth.ts` 유일 positive site (CF-024 11/11 도메인 중 1 = 8.3% positive)
> - **§3 C-4 Foreign row 404** = CF-018 Sub-pattern A canonical (sole-owner E20 booking-side 3 BAD + 2 POSITIVE; Sub-pattern B 56 SuperAdmin 57 sites 매트릭스)
> - **§4 P-1/P-2 sole-owner data export** = CF-018 Sub-pattern A POSITIVE (`security-rules.md` §1 canonical)
> - **§5 F-2/F-3 Stripe webhook** = CF-010 (signature + idempotency + chargeback default `console.log` only F11)
> - **§5 F-4 Invoice mutability** = CF-022 manual 67% vs webhook 0% split anomaly
> - **§5 F-5 Commission snapshot** = CF-001 (commissions=real) + F12 (status enum 부재)


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
