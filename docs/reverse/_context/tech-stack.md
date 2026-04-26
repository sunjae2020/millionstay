# Tech Stack & Project Audit

> ⚠️ **NEEDS REVISION** — see `docs/reverse/_audit/T001_RECON_REPORT.md` §g for specific corrections required. Will be rewritten in T002–T007 when its domain folder is processed.


## 1. Dependencies (grouped)

| Group | Packages |
|---|---|
| Framework — backend | `express@5`, `cookie-parser`, `cors`, `express-session`, `connect-pg-simple` |
| Framework — frontend | `react@19`, `react-dom@19`, `vite@7`, `wouter`, `@vitejs/plugin-react` |
| DB / ORM | `drizzle-orm@0.45`, `drizzle-kit`, `pg` |
| Auth | `jsonwebtoken`, `bcryptjs`, `crypto` (node built-in for HMAC unsubscribe + refresh hash) |
| Validation | `zod@3.25` (Orval-generated schemas) |
| File handling | `multer`, `cloudinary` (signed-URL helper in `lib/cloudinary.ts`) |
| Email | `resend` |
| State | `@tanstack/react-query`, `zustand` |
| UI | `tailwindcss@4`, `@radix-ui/*`, `class-variance-authority`, `lucide-react`, `framer-motion` |
| Forms | `react-hook-form`, `@hookform/resolvers/zod` |
| Date | `date-fns` |
| Codegen | `orval` (OpenAPI → Zod + TanStack Query hooks) |
| Testing | **(none)** |
| Tooling | `tsx`, `typescript@5`, `eslint`, `prettier` |

## 2. Folder structure

| Folder | Contents |
|---|---|
| `artifacts/<app>/src/pages/` | Wouter route components |
| `artifacts/<app>/src/components/` | App-specific components |
| `artifacts/<app>/src/components/ui/` | shadcn primitives (Radix + Tailwind) |
| `artifacts/<app>/src/lib/` | Utilities (queryClient, fetcher, i18n) |
| `artifacts/api-server/src/routes/` | Per-domain route modules |
| `artifacts/api-server/src/middlewares/` | `requireAuth`, `requireGuestAuth`, `requirePartnerAuth` |
| `artifacts/api-server/src/lib/` | `email.ts`, `cloudinary.ts`, `audit.ts`, `loginLockout.ts`, `refreshTokens.ts`, `unsubscribeToken.ts`, `retention.ts` |
| `artifacts/api-server/src/utils/` | `passwordPolicy.ts`, `fileValidator.ts`, helpers |
| `lib/db/src/schema/` | Drizzle table definitions (one file per table) |
| `lib/db/drizzle/` | Generated SQL migrations + meta |
| `lib/api-spec/` | OpenAPI source + Orval config |
| `lib/api-zod/src/generated/api.ts` | Generated Zod schemas (~3900 lines) |
| `lib/api-client-react/` | Generated React Query hooks |
| `docs/` | NDB runbook, templates, this reverse-docs pack |

**Layer separation rating: 2/5** — there is no service / repository layer. All business logic sits inline in route handlers. See `_rules/architecture-rules.md`.

## 3. Database

- **Engine:** PostgreSQL (managed by Replit's built-in DB).
- **Driver:** `pg` (Pool) wrapped by Drizzle.
- **Connection:** `lib/db/src/index.ts`:
  ```ts
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  export const db = drizzle(pool, { schema });
  ```
- **Migrations:** Drizzle Kit. Baseline `lib/db/drizzle/0000_violet_morgan_stark.sql`.
- **Workflows:** `db:push`, `db:push-force` (dev sync); `db:generate`, `db:migrate`, `db:studio` (production-bound).

## 4. Auth implementation

| Concern | Implementation |
|---|---|
| JWT library | `jsonwebtoken` (HS256) |
| Three secrets | `JWT_SECRET` (admin), `PARTNER_JWT_SECRET`, `GUEST_JWT_SECRET` |
| Refresh tokens | `lib/refreshTokens.ts` — SHA-256 hash stored in `refresh_tokens` table. Rotation on each `/auth/refresh`. |
| Session store | `connect-pg-simple` for admin (express-session) |
| Password hash | `bcryptjs` (default cost) |
| Lockout | `lib/loginLockout.ts` — 5 fails / 15 min → 429 with `Retry-After` |
| Password policy | `utils/passwordPolicy.ts` — 12+ chars, mixed-case + digit + special |
| Auth middleware applied | Inconsistently — most `/api/v1/*` go through `requireAuth`, but some routes register before that mount |

## 5. C# .NET migration risk assessment

| Pattern | Severity | Notes / mitigation |
|---|---|---|
| `real` columns for money | 🔴 | Migrate every money column to `numeric(10,2)` before EF Core mapping. Already done for `invoices.amount` and `promotions.discount_amount`. |
| Snake_case JSON field names | 🟢 | `JsonNamingPolicy.SnakeCaseLower` (NET 8+) covers it |
| Drizzle `numeric` returns string | 🟡 | Native EF returns `decimal` — DTOs need explicit conversion across the wire (or change client to expect string) |
| No service / repository layer | 🔴 | Refactor before migration. C# project should follow Controllers → Services → Repositories cleanly |
| Local `try/catch` in every route, no global handler | 🟡 | C# uses middleware pipeline + ProblemDetails — design once, applied everywhere |
| Two error response shapes | 🔴 | Standardize before migration; pick `{success,error:{code,message}}` |
| Inline JSON-blob columns: `terms_text` (text), `system_log.old_value/new_value` (jsonb) | 🟡 | SQL Server `nvarchar(max)` works for JSON; consider `OPENJSON` for queries |
| Wouter routing | 🟢 | Frontend not migrating |
| Resend, Cloudinary, Stripe SDKs | 🟢 | Each has a maintained .NET SDK |
| `tsx` build | 🟢 | Replaced by `dotnet run` |
| Drizzle relations not declared | 🟡 | EF Core requires explicit relationships; review all FK columns and add navigation properties |
| `node-pg` connection pool | 🟢 | Replaced by `Npgsql` connection pooling |
| HMAC unsubscribe token (Node `crypto`) | 🟢 | `System.Security.Cryptography.HMACSHA256` is direct equivalent |
| Cloudinary signed URLs | 🟢 | `CloudinaryDotNet` SDK — same signing logic |
| Stripe webhook signature | 🟢 | `Stripe.EventUtility.ConstructEvent` does this |
| Express middleware order matters | 🟡 | Replicate via middleware order in `Program.cs` |

Overall **migration readiness: 5/10**. The biggest blockers are: (1) `real` money columns, (2) absent service layer, (3) inconsistent error shapes. Each is a localized refactor — none requires re-architecting.
