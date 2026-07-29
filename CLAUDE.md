# CLAUDE.md

Agent operating guide for the **MillionStay** monorepo. For deep architecture and
feature history, read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — this file is the operational digest.

## What this is

A pnpm workspace monorepo for **MillionStay**, a property-management SaaS. One
Express API backs six React+Vite frontends (admin, guest web, three partner
portals, a sandbox). Node 24, TypeScript 5.9, PostgreSQL + Drizzle ORM, Zod
validation, Orval-generated API client, esbuild bundling.

## Layout

```
artifacts/
  api-server/          Express 5 API — all backend logic, routes under /api/v1/
  million-stay-web/    Guest booking portal (brand #E8621A)
  property-admin/      Admin SaaS (dashboards, CRUD, CMS, finance)
  agent-portal/        Partner: agents (bookings, commissions)
  owner-portal/        Partner: owners (occupancy/revenue, tenant masking)
  service-host-portal/ Partner: cleaners/drivers (jobs, schedule, earnings)
  mockup-sandbox/      Throwaway UI prototyping
lib/
  db/                  Drizzle schema + migrations (@workspace/db)
  api-zod/             Shared Zod schemas (@workspace/api-zod) — prefer for validation
  api-spec/            OpenAPI spec
  api-client-react/    Orval-generated hooks
scripts/               dev.sh, privacy checks, post-merge, translate
docs/                  CONTRIBUTING, LOCAL_DEV, runbooks, proposals
```

## Local dev

```bash
./scripts/dev.sh                 # all services (one Ctrl+C stops all)
./scripts/dev.sh api web         # subset: api|web|admin|agent|owner|host
```

| Service              | Port  | Filter                              |
| -------------------- | ----- | ----------------------------------- |
| api-server           | 8080  | `@workspace/api-server`             |
| million-stay-web     | 5173  | `@workspace/million-stay-web`       |
| property-admin       | 5174  | `@workspace/property-admin`         |
| agent-portal         | 5175  | `@workspace/agent-portal`           |
| owner-portal         | 5176  | `@workspace/owner-portal`           |
| service-host-portal  | 5177  | `@workspace/service-host-portal`    |

> ⚠️ **Local dev runs against the real production Supabase DB** (Supavisor
> session pooler). There is no separate dev database — be careful with
> destructive queries. See [docs/LOCAL_DEV.md](docs/LOCAL_DEV.md).

## Verifying changes (the feedback loop)

There is **no automated test suite** yet. Before considering a change done:

```bash
pnpm typecheck                                   # whole workspace (libs + apps + scripts) — MUST stay green
pnpm --filter @workspace/<pkg> typecheck         # single package, faster
pnpm --filter @workspace/<pkg> build             # vite/esbuild build (what deploys run)
```

For backend behavior, run the service and hit it with `curl`. For frontend,
verify in the browser via `./scripts/dev.sh`.

### CI ([.github/workflows/ci.yml](.github/workflows/ci.yml))

- **`verify` (required, must pass to merge):** whole-workspace `pnpm typecheck`
  + builds of all deploy targets (`mockup-sandbox` excluded — throwaway, needs
  `PORT`/`BASE_PATH` to even load its vite config).
- **`privacy-checks`** ([.github/workflows/privacy-checks.yml](.github/workflows/privacy-checks.yml))
  runs the static + coverage privacy scripts.

### Type-check status

`pnpm typecheck` is **green across the whole workspace** as of the 2026-06
burndown (146 pre-existing errors cleared — these had never blocked deploys
because Railway/Vercel build with vite/esbuild, which don't run `tsc`). CI now
gates it, so keep it green. Two notable classes were fixed:

- **Real runtime bugs** surfaced by the types — e.g. the DSAR deletion endpoint
  referenced `guest_emergency_contacts.guest_id` (actual column: `guest_user_id`)
  and set a nonexistent `status` column; `lookup.ts` selected a nonexistent
  `properties.address_line1`. These would have thrown at runtime.
- **Convention mismatches** — Drizzle `numeric` columns are strings (wrap writes
  in `String(...)`, reads in `Number(...)`); generated api-zod/api-client types
  occasionally lag the live API (a few are bridged via
  [artifacts/property-admin/src/types/api-augmentations.d.ts](artifacts/property-admin/src/types/api-augmentations.d.ts) —
  prefer regenerating the client when the OpenAPI spec is updated).

## Commit / deploy

- **pre-commit hook** ([.githooks/pre-commit](.githooks/pre-commit)) runs privacy/security
  static checks on staged files. Bypass only when justified: `git commit --no-verify`.
- Deploy model: commit locally, **push 2–3×/day**, not per change. Don't fix-by-deploy.
- **Auto-deploy on merge to `main`:**
  - `api-server` → Railway (platform Git integration)
  - `million-stay-web` → Vercel (platform Git integration)
  - `property-admin` → Vercel, via the `deploy-admin` job in
    [.github/workflows/ci.yml](.github/workflows/ci.yml). It runs only on push to
    `main`, **gated behind `verify`** (a red build never ships), builds the app,
    and runs `vercel deploy --prod`. Requires the `VERCEL_TOKEN` repo secret
    (org/project IDs are inlined, non-secret).
- **Manual deploy** for `property-admin` (fallback / out-of-band redeploy):
  ```bash
  pnpm --filter @workspace/property-admin build
  vercel --prod --yes --cwd artifacts/property-admin
  ```
  (Railway CLI auth has expired — `api-server` redeploys via merge to main or the
  Railway dashboard.)

## Conventions

- **Cross-product features:** every new feature applies across **Homestay,
  Short-term and Long-term** without distinction, wherever applicable — build
  shared/generic by default (extend a discriminator like `context_type`/`kind`,
  don't fork per product). **When applicability is unclear, confirm by text
  first.** See [docs/CROSS_PRODUCT_FEATURE_POLICY.md](docs/CROSS_PRODUCT_FEATURE_POLICY.md).
- **i18n by default:** any user-facing content that is added or modified must be
  translated into **every locale the affected app supports** as part of the same
  work — never ship English-only and defer translation. Locale sets:
  `million-stay-web` (guest/homestay) ships **en, ja, ko, th, vi, zh**; partner
  portals (`agent`/`owner`/`service-host`) ship **en, ja, ko, th, zh** (no `vi`).
  English (`en`) is the source of truth in `src/locales/en/translation.json`; add
  the key there, then fill every other locale via `scripts/translate-i18n.mjs`
  (or the admin AI-translate endpoint) and verify before calling the change done.
  When new content's translatability is unclear, confirm by text first.
- **Documents open in the preview modal, never a bare download.** Every PDF,
  report or sample a user can view — existing and **all future ones** — goes
  through the shared `DocumentPreviewDialog` + `useDocumentPreview()` hook
  (`src/components/DocumentPreviewDialog.tsx`, one copy per app: `property-admin`,
  `million-stay-web`, `owner-portal`; add one to a portal the first time it needs
  a document). It renders the document inline and offers **새 탭 / 인쇄 /
  다운로드 / 이메일 보내기 / 닫기**; pass `onEmail` only when the document type
  actually has a send endpoint (invoice, receipt, quote, contract, signed
  e-sign doc), and omit it otherwise (settlements, checklists, samples).
  Sources are `{ kind: "api", path, init? }` for authenticated server-rendered
  PDFs or `{ kind: "url", href }` for signed/public URLs. Do not add a new
  `a.download = …` / `window.open(blobUrl)` path.
- **Document translations** live in two server-side dictionaries, not in the app
  locale JSONs: [artifacts/api-server/src/lib/documents/i18n.ts](artifacts/api-server/src/lib/documents/i18n.ts)
  (shared chrome — doc types, statuses, money/date labels, service names) and
  [artifacts/api-server/src/lib/documents/applicationLabels.ts](artifacts/api-server/src/lib/documents/applicationLabels.ts)
  (the form-shaped application/service-brief labels, keyed by their English
  text). Every entry carries all six locales (en/ko/ja/zh/th/vi). Builders take
  a `lang: DocLang`; endpoints resolve it from `?lang=` and fall back to the
  tenant's `DEFAULT_DOC_LANG`. Status chips must go through `statusLabel(lang, …)`
  — never render a raw DB status into a document.
- **Postal addresses follow the address's own country (UPU S42), not the reader's.**
  Compose them with `formatPostalAddress(parts, lang)`
  ([artifacts/api-server/src/lib/documents/address.ts](artifacts/api-server/src/lib/documents/address.ts)),
  never by hand-joining fields. KR/JP/CN/TW addresses read largest-unit-first and
  space-separated (`대한민국 경기도 안양시 동안구 동안로 35, 109동 901호`); every other
  country keeps its Western comma order even inside a Korean document
  (`Level 5, 120 Collins St, Melbourne, VIC 3000, 호주`). `lang` only picks the
  language of the **country name** — the body is never reordered or translated.
  Country lookup/aliases live in
  [artifacts/api-server/src/lib/documents/countries.ts](artifacts/api-server/src/lib/documents/countries.ts)
  (mirror of property-admin/src/lib/countries.ts — keep both in sync). Records
  saved without a country are laid out as domestic via
  `{ orderFallbackCountry: await resolveIssuerCountry() }`; the assumed country
  is used for ordering only, never printed. `resolveCompanyInfo(lang)` applies the
  same rule to the issuer block, so pass the document's language where one is in scope.
- **Document filenames** follow `문서이름-고객이름_YYYYMMDD.pdf` and are built
  **server-side** by `buildDocumentFilename()` +
  `setDocumentDownloadHeaders()` ([artifacts/api-server/src/lib/documents/filename.ts](artifacts/api-server/src/lib/documents/filename.ts)),
  which also writes the RFC 5987 `filename*` needed for Korean names. The
  preview modal reads the name back off `Content-Disposition`, so the save
  dialog always matches the API — never hand-roll a filename in a route or a
  frontend download.
- **Document page geometry** lives in one place: the `@page` rule in
  [artifacts/api-server/src/lib/documents/theme.ts](artifacts/api-server/src/lib/documents/theme.ts).
  A CSS `@page` margin overrides puppeteer's `margin` option (measured, not
  assumed), so `pdf.ts` passes zeros. Every page gets the same 32px top/bottom
  margin as the 32px horizontal padding; `@page :first` drops the top margin so
  the brand bar still bleeds to the edge of page 1.
- **Money columns** (`invoices.amount`, `promotions.discount_amount`) are
  `numeric(10,2)` → Drizzle returns **strings**; wrap with `Number()` before math.
- **Lookup endpoints** return `{ id, display, ...extra }` consistently.
- **Validation:** prefer Zod schemas from `@workspace/api-zod`.
- **Auth:** guest/admin/partner JWTs are separate. Partner auth
  (`PARTNER_JWT_SECRET`) is order-sensitive in Express routing — don't reorder
  route mounts without checking partner vs admin precedence.
- **Privacy (Australian APPs):** sensitive docs use Cloudinary signed URLs +
  retention dates; marketing needs consent. Don't weaken privacy code — CI
  enforces it. See [docs/PRIVACY_COMPLIANCE.md](docs/PRIVACY_COMPLIANCE.md) and
  [docs/NDB_INCIDENT_RUNBOOK.md](docs/NDB_INCIDENT_RUNBOOK.md).
- **DB migrations:** code schema (`lib/db/src/schema/*.ts`) is the SSOT; `db:push`
  for dev sync; `db:generate` → `db:migrate` for prod-bound changes (SQL in
  `lib/db/drizzle/`). Follow [docs/DB_MIGRATION_CONVENTION.md](docs/DB_MIGRATION_CONVENTION.md) —
  additive-only, `0001+` numbering, no new `manual_*.sql`.

## Secrets

CLI tokens (Supabase, GitHub, Cloudflare, Resend) live in `.env.local` (root,
gitignored). Per-service runtime config in `artifacts/*/.env*` (gitignored).
Never commit credentials or paste them into `.claude/settings.json`.
