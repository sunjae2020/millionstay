# White-Label Pilot Instance — Setup Runbook (Phase 2)

**Status:** Draft · **Date:** 2026-07-18
**Goal:** Stand up **one** standalone pilot instance for a test company to
surface every hidden single-instance assumption *before* mass-externalizing code.
Prereq: [WHITELABEL_INSTANCE_SEPARATION.md](WHITELABEL_INSTANCE_SEPARATION.md)
(config spec + locked decisions §5).

**Decisions baked into this runbook:** separate Supabase project · per-instance
Stripe/Cloudinary · build-time brand injection · scripted-manual (no CI fan-out
yet, 1–3 instances year one).

> The pilot is throwaway-friendly: use a fictional company (e.g. **"Harbourview
> Stays"**) so nothing here touches real customer data or the production DB.

---

## Strategy: thin vertical slice, not big-bang

Do **not** fix all 175 hardcoded name strings first. Stand the instance up, then
fix **only what visibly breaks** on the critical path (login → browse → book →
email → doc). The pilot *is* the scope-discovery tool. Track surprises in §5.

---

## Step 0 — Pilot config sheet (fill first)

Create `artifacts/api-server/.env.harbourview` from §1 of the config spec. Pilot
values:

| Var | Pilot value |
| --- | --- |
| `COMPANY_TRADING_NAME` | `Harbourview Stays` |
| `COMPANY_LEGAL_NAME` | `Harbourview Stays Pty Ltd` |
| `SUPPORT_EMAIL` | `support@harbourview.example` |
| `EMAIL_FROM` | `Harbourview <noreply@harbourview.example>` |
| `PUBLIC_WEB_URL` | pilot Vercel URL |
| `ALLOWED_ORIGINS` | pilot domains (comma-sep) |
| `DATABASE_URL` | new Supabase project (Step 1) |
| `*_JWT_SECRET`, `SESSION_SECRET` | freshly generated, unique |
| Stripe / Cloudinary keys | pilot test accounts |
| `VITE_APP_NAME`, `VITE_BRAND_*` | Harbourview brand (Step 4) |

**Deliverable:** commit a redacted `artifacts/api-server/.env.example` capturing
this shape (config-spec DoD item).

---

## Step 1 — Provision the pilot database (separate Supabase project)

1. Create a new Supabase project `harbourview-pilot`; copy its **session-pooler**
   `DATABASE_URL` into the pilot env.
2. Apply schema — from repo root:
   ```bash
   DATABASE_URL=<pilot> pnpm --filter @workspace/db push        # dev-style sync
   # or, prod-style: pnpm --filter @workspace/db migrate  (23 SQL files in lib/db/drizzle/)
   ```
3. Seed baseline data:
   ```bash
   DATABASE_URL=<pilot> psql < lib/db/seed/translations-seed.sql
   DATABASE_URL=<pilot> node artifacts/api-server/scripts/seed-document-templates.mjs
   DATABASE_URL=<pilot> node artifacts/api-server/scripts/seed-pdf-templates.mjs
   # optional demo data: seed-homestay-samples.mjs
   ```
4. **Seed admin** — `scripts/seed-admin.ts` hardcodes `admin@millionstay.com` /
   `MillionStay@2026!` (`seed-admin.ts:9`). For the pilot, either edit locally or
   (better, feeds §2.6 fix) parametrize via `SEED_ADMIN_EMAIL`/`_PASSWORD` env.
   Rotate immediately after first login.

**Watch for:** any seed/migration that assumes MillionStay-specific rows.

---

## Step 2 — Deploy the pilot API (separate Railway service)

1. New Railway service from the same repo, `nixpacks.toml` build (chromium for
   PDF) unchanged.
2. Set all Step 0 env vars.
3. **Known blocker to hit here:** CORS `app.ts:79` hardcodes `*.millionstay.com`
   — the pilot domain will be rejected. Fix now (drive from `ALLOWED_ORIGINS` +
   `ROOT_DOMAIN`; remove the literal) — this is §2.1, the first real code change.
4. Smoke test: `GET /api/v1/public/...` from the pilot web origin succeeds.

---

## Step 3 — Deploy the pilot front-ends (per-instance Vercel builds)

Per decision (build-time branding), each app builds with pilot env:
```bash
VITE_API_URL=<pilot-api> VITE_APP_NAME="Harbourview Stays" \
  pnpm --filter @workspace/million-stay-web build
vercel --prod --yes --cwd artifacts/million-stay-web
```
Repeat for `property-admin` (already manual today) and the 3 partner portals as
needed for the pilot. Register the pilot custom domain on each Vercel project
(reuse `lib/vercelDomains.ts` flow → auto SSL).

---

## Step 4 — Brand injection (build-time, §2.4)

Highest-value change. Generate the `brand.css` `:root` token block from
`VITE_BRAND_*` env at build:
1. Add a prebuild step that writes `lib/design-tokens/src/brand.generated.css`
   from env (keep the **same** token names — `--brand-orange`, `--primary`, etc.
   — so `hsl(var(--primary))` downstream is untouched).
2. Pilot palette: pick a distinct primary (NOT `#E8621A`) to prove it flows end
   to end — header, buttons, emails, PDFs.
3. Also inject `VITE_APP_NAME` into `<title>` and the visible header/logo.
   Defer the long tail of 175 name strings — fix on sight.

**Success signal:** pilot renders in its own colors + name with zero
`#E8621A`/`MillionStay` leaking on the critical path.

---

## Step 5 — Critical-path walkthrough (the actual test)

Drive the flow on the pilot and log every MillionStay leak:
- [ ] Guest: browse → book → receive confirmation **email** (check FROM, logo, footer)
- [ ] Guest: privacy export/unsubscribe (hits `privacy@millionstay.com` literal — §2.2)
- [ ] Admin: login (seed creds) → create property/space → invoice → **PDF** doc (check theme/`COMPANY_*`)
- [ ] Partner: agent/owner portal login → dashboard branding
- [ ] Owner landing site slug (if in scope) → check `ROOT_DOMAIN` (§2.5)

Each leak found → add to the externalization backlog with file:line.

---

## Step 6 — Capture findings → backlog

Update [WHITELABEL_INSTANCE_SEPARATION.md](WHITELABEL_INSTANCE_SEPARATION.md)
§2 inventory with anything the pilot surfaced that the static audit missed. The
prioritized externalization backlog (fix-on-sight order) becomes Phase 3.

---

## Definition of done (pilot)

- [ ] Pilot instance reachable on its own domain, own DB, own branding.
- [ ] Critical path (Step 5) completes with **no** MillionStay identity leak on
      user-visible surfaces.
- [ ] `.env.example` committed (config-spec DoD).
- [ ] `app.ts:79` CORS + brand-injection build step merged (the two unavoidable
      code changes).
- [ ] Backlog of remaining hardcoded leaks captured for Phase 3.

## Out of scope (deferred)

- CI deploy/migration fan-out across instances (Phase 2 proper) — deferred per
  §5 decision #4 until 4th instance.
- Multi-tenant `tenant_id` refactor — not this path.
- Self-service tenant signup / subscription billing — future phase.
