# Security Rules & Audit

## 1. Authentication

| Concern | Implementation |
|---|---|
| Token type | JWT HS256, three separate secrets (admin / partner / guest) |
| Access TTL | Admin 8 h · Partner 7 d · Guest 7 d |
| Refresh TTL | 30 d (admin only at present) |
| Refresh storage | SHA-256 hash in `refresh_tokens`; raw token only in httpOnly cookie |
| Refresh rotation | Yes — old token revoked on each `/auth/refresh` |
| Logout | Revokes refresh row + destroys session |
| Password hash | bcryptjs (default cost factor 10) |
| Password policy | 12+ chars, mixed-case + digit + special — `utils/passwordPolicy.ts`, applied to admin/guest/partner register/reset/change |
| Lockout | 5 failures / 15 min → 429 + `Retry-After: 900` for 15 min — `lib/loginLockout.ts` |
| Magic-byte file validation | `utils/fileValidator.ts` — PDF / JPEG / PNG / WebP / GIF |

### Gaps

| Item | Severity | Detail |
|---|---|---|
| MFA | 🔴 | Promised in privacy policy, not implemented |
| Refresh token cleanup job | 🟡 | Revoked + expired rows accumulate; no cron purge |
| Password policy retroactivity | 🟡 | Old admin accounts with weak passwords are not forced to upgrade |
| Token transport | 🟢 | httpOnly + secure + SameSite=Lax cookies |

## 2. Authorization (RBAC)

✅ **Strengths:**
- Separate JWT secret per portal type — guest token cannot impersonate admin.
- Account-scoped data isolation in guest portal: `eq(bookingsTable.account_id, guest.account_id)` is enforced at the query layer.
- Sole-owner guard on `/v1/guest/me/data` prevents shared-account leakage.

⚠️ **Risks:**
- Admin role is binary (`Admin` vs `SuperAdmin`). All Admins have full CRUD on every domain. No fine-grained Manager/Receptionist/Housekeeping roles.
- Some routes use Anonymous middleware in code (no `requireAuth`) but rely on the umbrella `app.use("/api/v1", requireAuth)` to mount upstream. **If a future contributor mounts a route before that line, it becomes silently public.** Recommend per-router explicit auth.

### Data isolation matrix

| Resource | Guest A request for Guest B's data | Result |
|---|---|---|
| `GET /v1/guest/bookings/:id` (Guest B's id) | enforced via `account_id` filter | 404 (not found) ✅ |
| `GET /v1/guest/invoices/:id` | enforced | 404 ✅ |
| `GET /v1/guest/me/data` | account-sole-owner guard | bookings/invoices arrays are empty if not sole owner ✅ |
| `GET /v1/guest/documents/:id` | filtered by `entity_id` + `uploaded_by` | 404 ✅ |
| Direct Cloudinary URL | signed URL with timed expiry | safe ✅ |

## 3. Input validation

| Library | Coverage |
|---|---|
| Zod (Orval-generated) | Most CRUD routes use `safeParse(req.body)` and `safeParse(req.params)` |
| Manual validation | `auth.ts::login`, `auth.ts::register`, `reset-password`, `admin-users.ts::PATCH` — these check fields manually with `if (!email || !password) ...` |

**Rule:** Convert manual validations to Zod for consistency. The `/auth/register` body in particular accepts any unknown field today.

### POST/PATCH endpoints with NO Zod validation

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/reset-password`
- `PATCH /api/v1/admin/users/:id`

## 4. Sensitive data

| Concern | Status |
|---|---|
| Passwords hashed | ✅ bcryptjs |
| Passwords / tokens in error messages | ✅ Not exposed (string `"Invalid credentials"` only) |
| Passwords / tokens in logs | ⚠️ Some `console.error(err)` calls in route catch blocks could include request bodies if a future contributor logs `req.body` carelessly |
| Hardcoded secrets | ✅ All via `process.env` |
| Bank account masking on `/me/data` | ✅ BSB → `***-XXX`, account → `••••XXXX` |
| Document files | ✅ Cloudinary signed URLs with expiry |
| Cloudinary upload signature | ✅ Server-side signed (`CLOUDINARY_API_SECRET` never sent to browser) |

## 5. Top 5 security risks (ranked)

| # | Risk | Severity | Detail |
|---|---|---|---|
| 1 | **No MFA on any role** | 🔴 Critical | Admin compromise = total data breach. Privacy policy promises MFA — implementation owed. |
| 2 | **Race condition on overbooking** | 🔴 Critical | Two concurrent confirms can both pass `checkOverbooking`. Add unique index on `(space_id, date)` and wrap in transaction. |
| 3 | **Invoice mutability after Sent/Paid** | 🟡 High | `PUT /v1/invoices/:id` allows tampering. Add status guard. |
| 4 | **Manual validation on auth routes** | 🟡 High | `/auth/register` doesn't reject unknown fields. Convert to Zod with `.strict()`. |
| 5 | **No global error handler — local `console.error(err)` may include sensitive context** | 🟡 Medium | Centralize via Express middleware with a redaction step (strip `password`, `token`, `bank_*`, `passport_*`). |

## 6. Privacy / compliance specifics

| Item | Status | Source |
|---|---|---|
| Marketing consent records | ✅ | `marketing_consents` table |
| HMAC unsubscribe tokens (no DB lookup) | ✅ | `lib/unsubscribeToken.ts` |
| Document retention with date | ✅ | `documents.retention_until` + `lib/retention.ts` |
| Right of access export (APP 12) | ✅ | `GET /v1/guest/me/data` |
| Privacy policy | ✅ | All 13 APPs covered |
| NDB runbook | ✅ | `docs/NDB_INCIDENT_RUNBOOK.md` |
| NDB notification email template | ✅ | `docs/templates/ndb_notification_email.md` |
| Privacy contact mailbox | ✅ | `millionstay.com@gmail.com` consistent across policy + API + portal |
