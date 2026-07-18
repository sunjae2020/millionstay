# White-Label Instance Separation — Config Spec (RFC, Phase 0)

**Status:** Draft · **Author:** Platform · **Date:** 2026-07-18
**Scope:** Phase 0 of the white-label SaaS expansion — the *config spec*.
This document does **not** change code. It inventories every single-instance
assumption baked into the codebase and defines the full set of configuration a
new white-label instance needs. It is the prerequisite for Phase 1 (provisioning
automation) and the pilot second instance.

Related: [../ARCHITECTURE.md](../ARCHITECTURE.md), [OWNER_LANDING_SITES.md](OWNER_LANDING_SITES.md)
(reuse its per-slug Vercel domain-registration pattern for per-tenant domains).

---

## 0. Model recap

MillionStay is currently **single-tenant**: one shared Supabase Postgres, one
Railway API process, Vercel front-ends, all branded MillionStay. No `tenant_id`
on any core table (`document_templates.ts` comment states this explicitly).

The chosen expansion path is **white-label instance separation**: code stays one
shared repo, but **each customer company gets its own DB + its own deploy +
its own branding/domain**. The engineering risk is low (few query changes); the
work is (a) externalizing hardcoded MillionStay identity, and (b) automating the
per-instance provision + deploy so N instances are maintainable.

**A new instance = a filled-in copy of the config in §1, plus a DB, plus deploys.**

---

## 1. Instance config spec — the variables a new instance must supply

Each instance is fully described by the following config. Values marked
**(NEW)** do not exist yet and must be introduced during Phase 3 externalization;
the rest already exist as env vars and only need per-instance values.

### 1.1 Identity & DB (per instance, secret)

| Variable | Exists? | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Instance's own Postgres (separate Supabase project/schema) |
| `SESSION_SECRET` | ✅ | Base secret; boots only if present (`app.ts:47`) |
| `JWT_SECRET` | ✅ | Admin auth |
| `GUEST_JWT_SECRET` | ✅ | Guest auth |
| `PARTNER_JWT_SECRET` | ✅ | Partner auth (order-sensitive routing) |

### 1.2 Company identity (per instance, white-label)

An env family already exists and is consumed by the document/theme layer
(`lib/documents/theme.ts:49-56`) — extend its usage to all identity surfaces.

| Variable | Exists? | Current default |
| --- | --- | --- |
| `COMPANY_LEGAL_NAME` | ✅ | `MillionStay Pty Ltd` |
| `COMPANY_TRADING_NAME` | ✅ | `MillionStay` |
| `COMPANY_ABN` | ✅ | `""` |
| `COMPANY_PHONE` | ✅ | `""` |
| `COMPANY_ADDRESS` | ✅ | `Melbourne, VIC, Australia` |
| `SUPPORT_EMAIL` | ✅ | `millionstay.com@gmail.com` |
| `EMAIL_FROM` | ✅ | `MillionStay <noreply@contact.millionstay.com>` |
| `EMAIL_LOGO_URL` | ✅ | `https://www.millionstay.com/millionstay-logo.png` |
| `PRIVACY_CONTACT_EMAIL` | **(NEW)** | hardcoded `privacy@millionstay.com` in 6 places (§2.2) |
| `APP_DISPLAY_NAME` | **(NEW)** | front-end app name, 175 hardcoded `MillionStay` strings (§2.3) |

### 1.3 URLs & domains (per instance)

| Variable | Exists? | Purpose |
| --- | --- | --- |
| `PUBLIC_WEB_URL` | ✅ | Guest web base URL (used in emails, chat, docs) |
| `PUBLIC_API_URL` / `PUBLIC_APP_URL` | ✅ | API / admin base |
| `CLIENT_URL` / `WEB_BASE_URL` / `SIGNING_BASE_URL` | ✅ | Redirects, e-sign links |
| `AGENT_PORTAL_URL` / `OWNER_PORTAL_URL` / `SERVICE_HOST_PORTAL_URL` | ✅ | Partner portal bases |
| `ALLOWED_ORIGINS` | ✅ (partial) | CORS allowlist — **but** `app.ts:79` also hardcodes `*.millionstay.com` (§2.1) |
| `ROOT_DOMAIN` | **(NEW)** | `lib/vercelDomains.ts:17` hardcodes `millionstay.com` for per-slug landing sites |

### 1.4 Front-end build config (per instance, `VITE_*`)

Currently only `VITE_API_URL` + `BASE_URL` exist. White-label needs brand
injection at build time (§2.4):

| Variable | Exists? | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | ✅ | API base per app |
| `VITE_APP_NAME` | ✅ | replaces hardcoded `MillionStay` / `<title>` |
| `BRAND_*` (palette + fonts) | ✅ | build-time input to `generate-brand.mjs` → `brand.overrides.css` (§2.4). **Not** a `VITE_*` var — consumed by the Node build step, not the client bundle. |
| `VITE_LOGO_URL` / `VITE_LOGO_MARK_URL` / `VITE_FAVICON` | ✅ | per-instance horizontal logo, square mark, favicon |
| `VITE_COMPANY_LEGAL_NAME` / `VITE_COMPANY_ABN` / `VITE_COMPANY_CITY` | ✅ | legal entity shown on receipts/policy |
| `VITE_BANK_NAME` / `VITE_BANK_ACCOUNT_NAME` / `VITE_BANK_BSB` / `VITE_BANK_ACCOUNT_NO` | ✅ | bank-transfer payment details |

### 1.5 Third-party service keys (per instance OR shared)

Decision needed per key — isolate per tenant or share the platform account:

| Variable | Exists? | Isolation decision |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` / `_PUBLISHABLE_KEY` / `_WEBHOOK_SECRET` | ✅ | **Per instance** (each company's own Stripe payout account) |
| `RESEND_API_KEY` | ✅ | Per instance if own sending domain, else shared |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | ✅ | **Per instance** (asset + signed-URL isolation, privacy) |
| `ANTHROPIC_API_KEY` / `CHAT_MODEL` / `CS_TRANSLATE_MODEL` | ✅ | Shareable (metered centrally) |
| `VERCEL_TOKEN` / `_PROJECT_ID` / `_TEAM_ID` | ✅ | Provisioning credential (see §3) |

---

## 2. Hardcoded single-instance assumptions — remediation inventory

The audit (2026-07-18) found the blockers below. Ordered by leverage.

### 2.1 CORS domain lock — `app.ts:79` **[blocks pilot]**
```ts
if (protocol === "https:" && (hostname === "millionstay.com" || hostname.endsWith(".millionstay.com"))) {
```
A second-instance domain is rejected by CORS. **Fix:** drive from
`ALLOWED_ORIGINS` + a per-instance `ROOT_DOMAIN`, remove the literal.

### 2.2 Privacy contact email — 6 hardcoded sites **[compliance]**
`privacy@millionstay.com` literal in: `routes/privacy.ts:69,92`,
`routes/partner-privacy.ts:81,130,134`, `routes/guest-portal.ts:1382,1475,1479`.
Australian-APP privacy responses must show the *operating company's* contact.
**Fix:** `PRIVACY_CONTACT_EMAIL` env, default to `SUPPORT_EMAIL`.

### 2.3 Front-end app name — 175 hardcoded strings
`MillionStay` / `Million Stay` literal count by app:
`million-stay-web: 92`, `property-admin: 57`, `owner-portal: 10`,
`agent-portal: 8`, `service-host-portal: 8`. Plus `<title>` in every
`index.html`. **Fix:** `VITE_APP_NAME` + a single `useBrand()`/constant; migrate
strings incrementally (pilot only needs the visible ones — header, title,
emails — not all 175 at once).

### 2.4 Brand tokens — `lib/design-tokens/src/brand.css` (single 53-line file)
One shared CSS file; primary `#E8621A` and the full palette
(navy/teal/cream/burnt/apricot/ink) + fonts are hardcoded, imported by all 6
apps. **Status: DONE.** `brand.css` holds the primary MillionStay defaults;
`brand.overrides.css` (imported right after it in every app) carries the
per-instance overrides and is **committed empty** so the primary instance is
untouched. `scripts/generate-brand.mjs` regenerates `brand.overrides.css` at
build time from `BRAND_*` env (bare HSL triplets `"H S% L%"`, matching the
`hsl(var(--x))` convention — the **same primitive names** as `brand.css`, so
downstream `hsl(var(--primary))` is untouched):

```bash
# run BEFORE `vite build` in a white-label instance's deploy env:
BRAND_ORANGE="256 84% 58%" BRAND_TEAL="173 58% 39%" \
  BRAND_FONT_DISPLAY='"Sora", sans-serif' \
  pnpm --filter @workspace/design-tokens generate-brand
```

With no `BRAND_*` set it re-emits the empty default (idempotent no-op), so it is
safe to run unconditionally. The generated non-empty output must **never** be
committed — the tracked file stays empty (guarded by `.githooks/pre-commit`).
Accepted keys: `BRAND_ORANGE` (=primary slot), `BRAND_NAVY`, `BRAND_TEAL`
(=accent slot), `BRAND_CREAM`, `BRAND_BURNT`, `BRAND_APRICOT`, `BRAND_INK`,
`BRAND_WHITE`, `BRAND_FONT_DISPLAY`, `BRAND_FONT_SANS`.

### 2.5 Landing-site root domain — `lib/vercelDomains.ts:17`
```ts
const ROOT_DOMAIN = "millionstay.com";
```
Per-slug owner landing sites register `{slug}.millionstay.com`. **Fix:**
`ROOT_DOMAIN` env per instance.

### 2.6 Misc literals (low priority, still MillionStay-branded)
- `index.ts:35` / `scripts/seed-admin.ts:9` — seed admin `admin@millionstay.com` → derive from `COMPANY`/`SUPPORT_EMAIL`.
- `rateLimit.ts:55` — support email in a rate-limit message.
- `lib/documents/sampleDocs.ts:52`, `templateEngine.ts:94` — sample/placeholder doc data.
- `routes/public.ts:86` — public company-info endpoint returns literal `MillionStay` trading name → serve from `COMPANY_*` env.

### 2.7 Cross-cutting: external API keys are not tenant-scoped
`api_credentials` has no `account_id`/instance owner, and `/api/ext/v1`
responses are unscoped. In the **instance-separation** model this is naturally
solved (each instance has its own DB → its own keys), so **no code change is
required for this path** — noted here only to prevent regressing into a shared
key store. (It *would* be a blocker for the multi-tenant path.)

---

## 3. Provisioning outline (Phase 1 preview — not built here)

A new instance requires, in order:

1. **DB**: create Supabase project → run Drizzle migrations (`db:migrate`) → seed
   (`seed-admin`, catalog, templates — see `scripts/`, `seed-pdf-templates.mjs`).
2. **API deploy**: Railway service with the §1 env filled in.
3. **Front-end deploys**: Vercel project(s) with §1.4 build vars + custom domain
   (reuse `lib/vercelDomains.ts` registration flow → auto SSL).
4. **DNS**: `{company}.millionstay.com` or the company's own domain.

An **instance registry** (e.g. `instances/<name>.toml`) should capture each
instance's domain, DB ref, and non-secret config so Phase 2 CI can fan out
deploys and migrations across all instances.

---

## 4. Definition of done for Phase 0

- [x] Full env-var spec (§1) — existing vs NEW flagged.
- [x] Hardcoded-blocker inventory with file:line (§2), leverage-ordered.
- [x] Decision recorded per §1.5 key (isolate vs share) — **locked, see §5**.
- [ ] `.env.example` scaffold for a new instance generated from §1 — *pilot step 1*.

## 5. Decisions (locked 2026-07-18)

1. **DB isolation:** ✅ **Separate Supabase project per instance** — strongest
   physical isolation for privacy/compliance. Accept the extra provisioning/ops
   cost (mitigated by Phase 1 automation).
2. **Stripe / Cloudinary:** ✅ **Per instance** — each company's own payout
   account and asset/signed-URL store.
3. **Front-end topology:** ✅ **Build-time brand injection** — per-instance
   build + deploy; `brand.css` generated from `VITE_BRAND_*` env (§2.4). Deploy
   is N× but front-end code change is minimal. (Chosen over runtime injection
   because instance count is low — see #4.)
4. **Year-1 scale:** ✅ **1–3 instances.** ⇒ **Defer Phase 2 CI fan-out.** At
   this scale, scripted-but-manual provisioning + deploy is sufficient; revisit
   CI matrix automation only when the 4th instance is on the horizon.

**Consequence for the pilot:** build-time branding + per-instance DB/Stripe/
Cloudinary means the pilot is a genuine standalone deploy (own Supabase, own
Vercel builds, own Railway service). See [WHITELABEL_PILOT_SETUP.md](WHITELABEL_PILOT_SETUP.md).
