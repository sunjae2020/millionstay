# Australian Privacy Act 1988 (Cth) — Compliance Matrix

MillionStay is bound by the **Privacy Act 1988 (Cth)**, the **Australian Privacy Principles (APPs)**, and the **Notifiable Data Breaches (NDB) scheme**. This document maps each APP to the technical & operational controls in place.

> Sister documents:
> - `docs/NDB_INCIDENT_RUNBOOK.md` — incident response procedure
> - `docs/CONTRIBUTING.md` — privacy & security checklist for new code
> - The **public-facing privacy policy** is at `/privacy` (separate; legally binding).

---

## APP 1 — Open & transparent management

| Control | Status |
| --- | --- |
| Public privacy policy at `/privacy-policy` (main) + `/homestay/privacy` | ✅ Live |
| Privacy contact (`privacy@millionstay.com`) published | ⚠️ Published in policy + DSAR endpoints — **mailbox must be provisioned** |

## APP 2 — Anonymity / pseudonymity

✅ Public catalogue (`/api/v1/public/*`) requires no auth.

## APP 3-5 — Collection / notification

We collect only what is necessary: name, DOB, email, phone, ID document (passport / visa), payment info (Stripe-tokenised), accommodation preferences. Notice block at signup/booking forms — frontend update pending.

## APP 6 — Use or disclosure

✅ Personal data used only for the booking & accommodation service, reasonably-expected secondary purposes (booking confirmation email), or with consent (marketing — opt-in only).

Code: `lib/db/src/schema/marketing_consents.ts`, `routes/privacy.ts` (unsubscribe).

## APP 7 — Direct marketing

✅ Marketing emails require explicit opt-in. Every marketing email contains a one-click unsubscribe link (HMAC-signed token).

## APP 8 — Cross-border disclosure

| Vendor | Country | Data | Purpose |
| --- | --- | --- | --- |
| **Supabase** (Postgres) | Singapore (ap-southeast-1) | All structured personal data | Database |
| **Vercel** | USA + global edge | IP, request logs | Frontend hosting |
| **Railway** | USA (us-east-1) | Server logs, app data | Backend hosting |
| **Resend** | USA / Tokyo (ap-northeast-1) | Recipient email + content | Transactional email |
| **Cloudflare** | Global edge | IP, request metadata, DNS | DNS, CDN, WAF |
| **Stripe** | USA / global | Card last-4, BIN, amount | Payments |
| **Cloudinary** | USA / global | Uploaded images | Image storage |
| **OpenStreetMap** (tiles) | EU / global | Visitor IP (browser fetches map tiles directly) | Map display |
| **Google Fonts** | USA / global | Visitor IP + User-Agent (browser fetches fonts directly) | Web fonts on all frontends |
| **Third-party partner API consumers** | Varies | Curated booking data (booking ref, guest name, dates, rates) via scoped `/api/ext/v1` keys — no email/phone/passport/payment | Authorised partner integrations |
| **Anthropic** (Claude) | USA | (1) Landing-page chat messages a visitor types + admin-published knowledge content; (2) homestay application attributes — nationality, minor status, dietary, allergies, smoking, cultural/religious preferences — used to generate host-match rationale | AI customer chat assistant + homestay host-matching |

The public privacy policy must list these vendors and disclose Standard Contractual Clauses (SCC) or equivalent contractual safeguards.

**Anthropic note:** Visitor chat messages are sent to Anthropic's API to generate replies. Anthropic does not train models on API data and retains it only transiently for abuse monitoring. Visitors should be told not to share sensitive personal information in chat (the assistant is also instructed never to request passwords, payment-card, or passport details). The chat is optional and admin-toggleable (`CHAT_WIDGET_ENABLED`).

## APP 9 — Government identifiers

- TFN, Medicare, driver licence, passport: not used as keys, not in URLs/logs/emails.
- All listed in `logger.ts` redact list (pino → `[REDACTED]`).

## APP 10 — Quality

✅ Self-correction via `PATCH /api/v1/guest/profile`. Audit-logged.

## APP 11 — Security ✅ (most extensive)

- **TLS 1.2+** on all endpoints — HSTS preload, max-age 1y.
- **Postgres encryption** at rest (Supabase platform).
- **Bcrypt** password hashing (cost 10+).
- **Password policy**: min 12 chars + complexity (`utils/passwordPolicy.ts`).
- **Login lockout** + **rate limits** (10/min login, 100/min forms, 300/min general).
- **Session**: `httpOnly`, `secure` (prod), `sameSite=lax`, **4h rolling**.
- **Audit log** of CRUD/auth/security events (`utils/auditLog.ts` → `system_logs`).
- **PII redaction** in logs (passwords, tokens, passport, TFN, Medicare, license, card, CVV, DOB, bank).
- **Document retention** (`lib/retention.ts`): ID/visa = 30 d, contracts = 7 y, invoices = 5 y.
- **Permissions-Policy**: camera/mic/geo denied unless explicit.
- **Referrer-Policy**: `strict-origin-when-cross-origin`.
- **X-Robots-Tag**: `noindex, nofollow` on API.
- **Helmet** (X-Frame, X-Content-Type, etc.).
- **CORS allow-list** via `ALLOWED_ORIGINS` (no wildcards).
- **CF-004 fix**: dev-migration route hard-blocked in production.

⏳ Outstanding: 2FA, IP allow-list for admin, column-level encryption for passport/TFN, quarterly access review, annual pentest.

## APP 12 — Right of access ✅

`GET /api/v1/guest/me/export` — JSON dump of all PII for the authenticated guest. Internal fields stripped. Audit-logged.

## APP 13 — Correction & deletion ✅

`POST /api/v1/guest/me/deletion-request`:
- Marks account `PendingDeletion`, pseudonymises name/phone/avatar.
- Hard-deletes emergency contacts (no retention obligation).
- Preserves bookings/invoices for ATO 5y / tenancy 7y retention.

---

## NDB scheme

See `docs/NDB_INCIDENT_RUNBOOK.md` for the full procedure.

**Statutory deadline**: assessment within 30 days; notify OAIC + affected individuals as soon as practicable for serious-harm breaches.

OAIC: https://www.oaic.gov.au/privacy/notifiable-data-breaches/

---

## Engineering backlog

- [ ] Public privacy policy at `/privacy`
- [ ] `privacy@millionstay.com` mailbox
- [ ] 2FA for admin accounts
- [ ] Column-level encryption for passport / TFN / Medicare
- [ ] Cron job: purge expired-retention rows
- [ ] Annual penetration test
