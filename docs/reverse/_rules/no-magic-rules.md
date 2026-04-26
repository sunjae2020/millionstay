# C# Migration Compatibility Audit ("No-Magic" Rules)

> ✅ **T001-RECON-VERIFIED** 2026-04-26 — corroborated by `docs/reverse/_audit/T001_RECON_REPORT.md` §g.


> Goal: identify TypeScript/Node patterns that will not translate cleanly to C# .NET, with severity and a refactor approach for each 🔴 item.

## 1. Loose typing

| Pattern | Where | Severity | Refactor |
|---|---|---|---|
| Route handlers returning untyped objects | every file in `routes/` | 🔴 | Define a `<X>Response` type per endpoint and return it. `lib/api-zod` already has these — wire them through. |
| `req.body as any` (implicit before safeParse) | most route handlers | 🟡 | Always derive types from the Zod schema (`z.infer<typeof CreateXBody>`) |
| Drizzle row spread into response (`res.json(row)`) | many routes | 🟡 | Map to DTO; fields like `password_hash` must never be returned (they aren't currently, but no compile-time guarantee) |
| Numeric values as strings (Drizzle `numeric` → string) | `invoices.amount`, `promotions.discount_amount` | 🟡 | C# `decimal` cannot accept string without converter. Add explicit `JsonConverter<decimal>` or reshape the DTO. |

## 2. Language-specific patterns

| Pattern | Severity | Refactor |
|---|---|---|
| Optional chaining + nullish coalescing | 🟢 | C# has `?.`, `??` — direct translation |
| Spread operator on arrays / objects | 🟢 | Use `[..a, ..b]` (collection expressions) and `with`-syntax for records |
| Top-level `await` in scripts | 🟢 | Use `Task.Run` or top-level statements in C# 9+ |
| Inline async IIFE | 🟢 | Replace with `async Task` methods |
| `Object.entries / Object.keys` reflection | 🟡 | Use `record` types and explicit property access; avoid reflection in hot paths |
| Drizzle `or(...dates.map((d) => eq(...)))` (variadic) | 🟡 | EF Core: build `IQueryable.Where` chain or use `.Contains(dates)` |
| Date arithmetic via `date-fns` | 🟢 | C# `DateOnly`, `DateTime.AddDays`, `DateTime.AddMonths` |
| Express middleware as functions | 🟢 | ASP.NET middleware classes / minimal-API filters |

## 3. Library equivalents

| Node package | C# equivalent | Notes |
|---|---|---|
| `express` | ASP.NET Core (Controllers or Minimal API) | Direct |
| `drizzle-orm` + `pg` | `EF Core` + `Npgsql` | Generate model from existing DB; declare relationships explicitly |
| `zod` | `FluentValidation` or `DataAnnotations` | Manual port required; consider exporting OpenAPI from C# (Swashbuckle) instead |
| `jsonwebtoken` | `Microsoft.AspNetCore.Authentication.JwtBearer` | Direct |
| `bcryptjs` | `BCrypt.Net-Next` | Direct, identical hash compatibility |
| `multer` | ASP.NET `IFormFile` | Built-in |
| `cloudinary` | `CloudinaryDotNet` | Direct |
| `resend` | `Resend.Net` (community) **or** Resend HTTP API directly | Confirm SDK quality before adoption |
| `stripe` | `Stripe.net` (official) | Direct |
| `@tanstack/react-query` | (frontend stays — not migrating) | n/a |
| `wouter` | (frontend stays) | n/a |

**No C# equivalent / unique to JS:**
- Orval (OpenAPI → React Query hooks) — not needed once the C# backend exposes Swagger; the React frontend can keep using its current generated client unchanged.
- `tsx` script runner — replaced by `dotnet script` or just compiled console apps.

## 4. Database patterns

| Pattern | Severity | Refactor |
|---|---|---|
| `jsonb` columns: `system_log.old_value`, `system_log.new_value` | 🟡 | EF Core supports JSON columns on PostgreSQL via `Npgsql.EntityFrameworkCore.PostgreSQL`. If migrating to SQL Server, use `nvarchar(max)` + manual JSON. |
| Raw SQL mixed with ORM | 🟢 | None found — all queries go through Drizzle |
| PostgreSQL-specific functions (`gen_random_uuid()`) | 🟡 | If staying on Postgres: keep. If moving to SQL Server: replace with `NEWID()`. |
| `text` for short strings (no length limit) | 🟢 | EF Core maps to `nvarchar(max)`; consider tightening to `varchar(255)` for short fields like `email` |
| Timestamps without timezone | 🟡 | `timestamp` → C# `DateTime` (but ambiguous TZ). Recommend `timestamptz` everywhere going forward. |
| `serial` PKs (auto-increment integer) | 🟢 | EF Core: `[DatabaseGenerated(DatabaseGeneratedOption.Identity)]` |
| `uuid` PKs (`marketing_consents`, `documents`, `refresh_tokens`) | 🟢 | EF Core: `Guid` |

## 5. Cross-cutting things to fix BEFORE migration starts

| Priority | Action |
|---|---|
| 1 | Move every money column from `real` to `numeric(10,2)` |
| 2 | Convert manual auth-route validation to Zod (then port to FluentValidation 1:1) |
| 3 | Add a unique index on `space_blocked_dates(space_id, date)` and wrap booking confirm in a transaction |
| 4 | Standardize error response on `{ success, error: { code, message } }` everywhere |
| 5 | Standardize success response on `{ data, pagination? }` for list endpoints |
| 6 | Extract service layer for booking → contract → invoice chain |
| 7 | Add OpenAPI source-of-truth (it exists at `lib/api-spec/`); C# can re-implement against the same spec |
| 8 | Convert any `JSON.parse(maybe-undefined)` paths to safe parsers — C# `JsonSerializer.Deserialize<T>()` throws on null |
| 9 | Verify all `setInterval`/cron-like assumptions have explicit jobs (Drizzle has none — there is no scheduler today) |

## 6. Estimated total refactor effort before C# port

| Phase | Effort |
|---|---|
| Numeric column migration + Drizzle type updates | 8–12 h |
| Service-layer extraction (booking + contract + invoice) | 24–32 h |
| Standardize error / success envelope | 4–6 h |
| Convert manual validations to Zod | 4–6 h |
| Add overbooking unique index + transaction | 4–6 h |
| Add MFA on admin auth | 16–24 h |
| Test scaffolding (Vitest + a baseline) | 8–12 h |
| **Total** | **~70–100 h before C# port begins** |
