# API Endpoint Inventory — `artifacts/api-server`

> Source: `artifacts/api-server/src/routes/*.ts` and `app.ts` mounting.
> Mount prefix: most admin routes under `/api/v1/...`. Public anonymous routes under `/api/v1/public/...`. Portal routes under `/api/v1/{guest|agent|owner|service-host}/...`. Stripe webhook at `/api/stripe/webhook`.

## Auth

| Method | Path | Handler file | Auth | Roles | Description |
|---|---|---|---|---|---|
| POST | /api/v1/auth/login | `auth.ts` | none | Public | Admin login → access JWT (8 h) + refresh token (30 d). Login lockout after 5 fails / 15 min |
| POST | /api/v1/auth/refresh | `auth.ts` | refresh token cookie | Public | Rotate refresh, issue new access |
| POST | /api/v1/auth/logout | `auth.ts` | any | Authed | Revoke refresh token |
| POST | /api/v1/auth/register | `auth.ts` | none | Public | Submit admin registration (requires manual approval) |
| POST | /api/v1/auth/forgot-password | `auth.ts` | none | Public | Send reset email |
| POST | /api/v1/auth/reset-password | `auth.ts` | reset token | Public | Complete reset |
| GET  | /api/v1/auth/me | `auth.ts` | requireAuth | Admin | Current admin profile |
| POST | /api/v1/auth/guest/register | `guest-auth.ts` | none | Public | Guest signup (creates account + guest_user + marketing_consent) |
| POST | /api/v1/auth/guest/login | `guest-auth.ts` | none | Public | Guest login → guest JWT (7 d) |
| POST | /api/v1/auth/guest/forgot-password | `guest-auth.ts` | none | Public | |
| POST | /api/v1/auth/guest/reset-password | `guest-auth.ts` | none | Public | |
| POST | /api/v1/auth/partner/login | `partner-auth.ts` | none | Public | Agent / Owner login → partner JWT (7 d) |
| POST | /api/v1/auth/partner/change-password | `partner-auth.ts` | requirePartnerAuth | Partner | |
| GET  | /api/v1/auth/partner/me | `partner-auth.ts` | requirePartnerAuth | Partner | |

## Public (anonymous) endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /healthz | none | Liveness |
| GET | /api/v1/health | none | Health |
| GET | /api/v1/public/properties | none | Public property list |
| GET | /api/v1/public/spaces | none | Searchable space list |
| GET | /api/v1/public/spaces/:id | none | Space detail (privacy-masked address per `spaces.privacy_*`) |
| GET | /api/v1/public/spaces/:id/availability | none | Date-range availability for booking wizard |
| GET | /api/v1/privacy/unsubscribe | HMAC token | HTML confirmation page |
| POST | /api/v1/privacy/unsubscribe | HMAC token | JSON unsubscribe |

## Property / Space / Product (admin)

| Method | Path | Auth | Roles |
|---|---|---|---|
| GET / POST | /api/v1/properties | requireAuth | Admin |
| GET / PATCH / DELETE | /api/v1/properties/:id | requireAuth | Admin |
| GET / POST | /api/v1/spaces | requireAuth | Admin |
| GET / PATCH / DELETE | /api/v1/spaces/:id | requireAuth | Admin |
| POST | /api/v1/spaces/:id/block | requireAuth | Admin (writes audit log) |
| POST | /api/v1/spaces/:id/unblock | requireAuth | Admin (writes audit log) |
| GET / POST | /api/v1/contract-products | requireAuth | Admin |
| GET | /api/v1/accommodation-catalog | requireAuth | Admin |

## Booking (admin)

| Method | Path | Auth | Side effects |
|---|---|---|---|
| GET | /api/v1/bookings | requireAuth | List with filters |
| POST | /api/v1/bookings | requireAuth | Manual booking, runs `checkOverbooking` |
| GET / PUT / DELETE | /api/v1/bookings/:id | requireAuth | PUT only allowed on `Draft` / `Confirmed` |
| PATCH | /api/v1/bookings/:id/submit | requireAuth | `Draft → PendingPayment` |
| PATCH | /api/v1/bookings/:id/confirm | requireAuth | `→ Confirmed` + blocks dates + auto-creates Contract |
| PATCH | /api/v1/bookings/:id/reject | requireAuth | `PendingApproval → Cancelled` |
| PATCH | /api/v1/bookings/:id/cancel | requireAuth | `* → Cancelled`; unblocks dates |
| PATCH | /api/v1/bookings/:id/check-in | requireAuth | `Confirmed → Active` |
| PATCH | /api/v1/bookings/:id/check-out | requireAuth | `Active → CheckedOut` (no auto cleaning WO) |

## Contract (admin)

| Method | Path | Auth | Side effects |
|---|---|---|---|
| GET | /api/v1/contracts | requireAuth | |
| POST | /api/v1/contracts | requireAuth | |
| GET / PUT / DELETE | /api/v1/contracts/:id | requireAuth | |
| POST | /api/v1/contracts/:id/send | requireAuth | `Draft → Sent`, sets `sent_at` |
| POST | /api/v1/contracts/:id/sign | requireAuth | `Sent → Signed` |
| POST | /api/v1/contracts/:id/activate | requireAuth | `Signed → Active`, generates invoices + schedules, sets booking `Active` |
| POST | /api/v1/contracts/:id/terminate | requireAuth | `Active → Terminated` |
| POST | /api/v1/contracts/:id/expire | requireAuth | `Active → Expired` |

## Finance (admin)

| Method | Path | Auth |
|---|---|---|
| GET / POST | /api/v1/invoices | requireAuth |
| GET / PUT / DELETE | /api/v1/invoices/:id | requireAuth |
| POST | /api/v1/invoices/:id/send | requireAuth |
| POST | /api/v1/invoices/:id/pay | requireAuth |
| POST | /api/v1/invoices/:id/void | requireAuth |
| GET / POST | /api/v1/recurring-schedules | requireAuth |
| GET | /api/v1/promotions | requireAuth |
| POST | /api/stripe/webhook | Stripe signature | mutates invoice on payment |

## CRM (admin)

| Method | Path | Auth |
|---|---|---|
| GET / POST | /api/v1/accounts | requireAuth |
| GET / PUT / DELETE | /api/v1/accounts/:id | requireAuth |
| GET / POST | /api/v1/contacts | requireAuth |
| GET / POST | /api/v1/leads | requireAuth |
| GET / POST | /api/v1/commissions | requireAuth |
| GET / POST | /api/v1/tasks | requireAuth |

## Operations (admin)

| Method | Path | Auth | Audit log? |
|---|---|---|---|
| GET / POST | /api/v1/work-orders | requireAuth | ❌ |
| PATCH | /api/v1/work-orders/:id | requireAuth | ❌ |
| GET / POST | /api/v1/cs-tickets | requireAuth | ❌ |
| POST | /api/v1/cs-tickets/:id/reply | requireAuth | ❌ |
| GET | /api/v1/service-catalog | requireAuth | |

## Settings & Admin Management

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET / POST | /api/v1/admin/users | requireAuth | Admin |
| PATCH / DELETE | /api/v1/admin/users/:id | requireAuth | Admin |
| GET | /api/v1/integrations/settings | requireAuth | Admin |
| POST | /api/v1/admin/db-sync/export | requireSuperAdmin | SuperAdmin only |

## Guest Portal

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/v1/guest/me | requireGuestAuth | Profile |
| PATCH | /api/v1/guest/me | requireGuestAuth | Update profile |
| GET | /api/v1/guest/me/data | requireGuestAuth | APP 12 data export |
| GET | /api/v1/guest/me/data?format=download | requireGuestAuth | JSON download |
| GET / POST | /api/v1/guest/bookings | requireGuestAuth | List own / Apply |
| GET | /api/v1/guest/invoices | requireGuestAuth | Own invoices |
| POST | /api/v1/guest/invoices/:id/pay | requireGuestAuth | Stripe checkout |
| GET / POST | /api/v1/guest/cs-tickets | requireGuestAuth | List / Create ticket |
| GET / POST | /api/v1/guest/documents | requireGuestAuth | Upload / list (signed Cloudinary) |

## Agent Portal

| Method | Path | Auth |
|---|---|---|
| GET | /api/v1/agent/dashboard | requireAgentAuth |
| GET | /api/v1/agent/bookings | requireAgentAuth (filtered to agent_account_id) |
| GET | /api/v1/agent/bookings/:id | requireAgentAuth |
| GET | /api/v1/agent/properties | requireAgentAuth (visible/affiliated only) |
| GET | /api/v1/agent/commissions | requireAgentAuth |

## Owner Portal

| Method | Path | Auth |
|---|---|---|
| GET | /api/v1/owner/dashboard | requireOwnerAuth |
| GET | /api/v1/owner/properties | requireOwnerAuth (filtered to owner_account_id) |
| GET | /api/v1/owner/bookings | requireOwnerAuth |
| GET | /api/v1/owner/revenue | requireOwnerAuth |

## Service Host Portal

| Method | Path | Auth |
|---|---|---|
| GET | /api/v1/service-host/dashboard | requireServiceHostAuth |
| GET | /api/v1/service-host/jobs | requireServiceHostAuth |
| PATCH | /api/v1/service-host/jobs/:id | requireServiceHostAuth |
| GET | /api/v1/service-host/schedule | requireServiceHostAuth |
| GET | /api/v1/service-host/earnings | requireServiceHostAuth |

## Privacy / Compliance

| Method | Path | Auth |
|---|---|---|
| GET / POST | /api/v1/privacy/unsubscribe | HMAC token (no JWT) |
| GET | /api/v1/guest/me/data | requireGuestAuth |

---

## Security flags

### ❌ Endpoints with NO auth (intentionally public)
- All `/api/v1/public/*`
- All `/api/v1/auth/*` *register / login / forgot / reset* paths
- `/api/stripe/webhook` (Stripe signature instead)
- `/healthz`, `/api/v1/health`

### ⚠️ Endpoints with **manual** validation (not Zod)
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/reset-password`
- `PATCH /api/v1/admin/users/:id`

### ❌ Missing global error handler
There is **no** `app.use((err, req, res, next) => ...)` in `src/app.ts`. Each route catches errors locally with `try/catch` returning `res.status(500).json({ error: ... })`. See `_templates/crud-service-template.md` for the recommended global handler.

### ❌ Endpoints with no business-logic validation
- `PUT /v1/invoices/:id` — no immutability guard once Sent/Paid
- `POST /v1/bookings` — does not block past-date bookings server-side (relies on UI)
- `POST /v1/bookings` — does not enforce `min_stay_weeks` / `max_stay_weeks` server-side
