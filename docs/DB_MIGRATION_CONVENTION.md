# DB Migration Convention (SSOT)

Status: **Authoritative** — every schema change from Phase B onward follows this
document. Established 2026-07-18 (harness audit H-101 / H-102).

## 1. Source of truth

**The Drizzle schema in `lib/db/src/schema/*.ts` (aggregated by
`lib/db/src/schema/index.ts`) is the single source of truth for the database
shape.** The live production database is kept in sync *from* that code, never the
other way around.

Verified at establishment time: code exports **88 tables** via the schema barrel,
and the live prod DB (`public` schema) holds exactly those 88 + `_seed_meta`
(seed bookkeeping, not a Drizzle table). Code ↔ DB were a clean match.

> A table file that is **not** re-exported by `schema/index.ts` is invisible to
> Drizzle and to the `db` client. `product_catalog.ts` was such a dead file
> (never in the barrel, never created in the DB, queried nowhere — the
> `product-catalog` route uses `accommodation_catalog`). It was deleted as part
> of this work. When adding a new table, you MUST add its `export *` line to
> `schema/index.ts` or it does nothing.

## 2. How sync actually happens

| Command | When | Effect |
|---|---|---|
| `pnpm --filter @workspace/db push` (`drizzle-kit push`) | **dev only** | Diffs code schema against the connected DB and applies changes directly. Fast, no migration file. **Never run against prod.** |
| `pnpm --filter @workspace/db generate` (`drizzle-kit generate`) | prod-bound changes | Reads schema + the `drizzle/meta` snapshot and emits a numbered SQL migration. Does **not** touch the DB. |
| `drizzle-kit migrate` | prod deploy | Replays pending numbered migrations and records them in the tracking table. |

Local dev (see [LOCAL_DEV.md](LOCAL_DEV.md)) points at the real prod Supabase
pooler, so **do not run `push` or `migrate` casually** — treat every schema
command as production-affecting until a separate dev DB exists.

## 3. History (why the journal looks empty)

- `drizzle/0000_violet_morgan_stark.sql` — the genesis migration (50 `CREATE
  TABLE`). It is the **only** entry in `drizzle/meta/_journal.json` (`idx 0`).
- `drizzle/manual_*.sql` (22 files) — all subsequent schema changes were applied
  **out of band** as hand-written SQL (additional `CREATE TABLE` + `ALTER`).
  They were **never** registered in the journal and there is **no runner or
  tracking table** (`__drizzle_migrations` does not exist in the DB). The DB
  reached its current 88-table shape via `drizzle-kit push`, not by replaying
  these files.
- `artifacts/api-server/src/seed-migration.sql` is **data only** (49 `INSERT`s,
  zero DDL). It restores a demo snapshot; it does not create schema. It is not a
  migration.

Consequence: **the `drizzle/` folder is an incomplete historical record.** A
fresh environment cannot be reproduced by replaying `0000` + `manual_*` in order
(order is unknown and coverage is partial). Reproduction today = `drizzle-kit
push` from the code schema.

## 4. Going forward — the `0001+` convention

`manual_*.sql` is **deprecated. Do not add new `manual_*` files.**

Every prod-bound schema change:

1. Edit `lib/db/src/schema/*.ts` (add the `export *` to `schema/index.ts` for new
   tables). This is the change of record.
2. Run `drizzle-kit generate` → produces `drizzle/0001_*.sql` (then `0002`, …)
   and updates `drizzle/meta`. Commit the generated SQL **and** the meta
   snapshot alongside the schema change.
3. **Additive-only** for anything touching live data: new columns must be
   `nullable` → backfill → (optional) tighten. **No column drop or rename** in a
   single step. State the rollback in the PR.
4. Keep `lib/db/dist/` out of git (already `.gitignore`d) — it is rebuilt.

### 4.1 Journal baseline restoration (one-time, do at the first real `0001`)

Because the `meta` snapshot still reflects the 50-table `0000` state, the *first*
`drizzle-kit generate` run will emit a large catch-up diff (the ~38 manual-added
tables + alters) that is **already present in prod** and must not be replayed
there. Handle it as a squash-baseline, gated by review:

```bash
# 1. Archive current drizzle/ (0000 + manual_* + meta) to drizzle/_archive/ for history.
# 2. Regenerate a single baseline snapshot from the current (authoritative) schema:
pnpm --filter @workspace/db generate   # emits 0000_baseline reflecting all 88 tables
# 3. Mark that baseline as ALREADY APPLIED in prod (insert its hash into the
#    drizzle migrations tracking table) WITHOUT running its DDL — prod already
#    matches. Verify code↔DB parity first (information_schema table-name diff).
# 4. From here, every change is a clean incremental 0001+, replayable on any
#    fresh environment.
```

Until this baseline step is performed and reviewed, continue syncing dev via
`push` and record the intended change in the schema code (the SSOT) so nothing is
lost.

## 5. Rules of thumb

- Code schema is truth; the DB follows it.
- New table → also add it to `schema/index.ts`.
- Prod-bound change → `generate` a numbered migration + commit the meta snapshot.
- Additive-only near live data; no drop/rename in one step; state rollback.
- Never `push`/`migrate` against prod without intent; local dev is prod-connected.
- No new `manual_*.sql`; no committed `dist/`.
