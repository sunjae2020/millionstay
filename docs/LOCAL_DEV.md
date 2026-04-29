# Local Development

Run everything on your laptop. Push to deploy 2-3× per day, not per change.

## Quick start

```bash
./scripts/dev.sh
```

That spins up three processes concurrently:

| Service         | URL                       | Watches    |
| --------------- | ------------------------- | ---------- |
| api-server      | http://localhost:8080     | (no HMR)   |
| million-stay-web| http://localhost:5173     | Vite HMR   |
| property-admin  | http://localhost:5174     | Vite HMR   |

`Ctrl+C` once stops all three.

Need only a subset?

```bash
./scripts/dev.sh api          # backend only
./scripts/dev.sh web          # guest web only
./scripts/dev.sh api web      # backend + guest web (skip admin)
```

## What's where

| File | Purpose | Committed? |
| --- | --- | --- |
| `.env.local` (root) | CLI tokens (Supabase, GitHub, Cloudflare) | ❌ gitignored |
| `artifacts/api-server/.env` | Local backend runtime config | ❌ gitignored |
| `artifacts/million-stay-web/.env.local` | `VITE_API_URL=http://localhost:8080` | ❌ gitignored |
| `artifacts/property-admin/.env.local` | `VITE_API_URL=http://localhost:8080` | ❌ gitignored |

The DB pointer in `artifacts/api-server/.env` is the **same Supabase prod database** via Supavisor session pooler. All local work uses real production data — be careful with destructive queries.

## Daily workflow

```
[edit code] → [browser auto-reloads] → [verify] → [git commit]   ← repeat
                                                       ↓
                                          (locally tested commits pile up)
                                                       ↓
                                                 [git push]      ← 2-3× per day
                                                       ↓
                              Railway auto-builds + Vercel auto-builds
                                                       ↓
                              ./scripts/verify-prod.sh (smoke test)
```

## When to push

Push when **all** of these are true:

1. Local browser shows the change working
2. `pnpm --filter @workspace/api-server typecheck` passes (or you reviewed the failures)
3. You're at a stable commit boundary (not mid-refactor)

Don't push to fix-by-deploy. If something fails locally and you don't know why, it'll fail in prod too — debug locally first.

## Common commands

```bash
# Restart only the backend (after backend code change without HMR)
./scripts/dev.sh api    # in a fresh terminal; the other terminal keeps web/admin running

# Type-check before pushing
pnpm --filter @workspace/api-server typecheck
pnpm --filter @workspace/million-stay-web typecheck

# Smoke-test prod after deploy
curl -s https://workspaceapi-server-production-ff8e.up.railway.app/api/v1/public/spaces?limit=1 | head -c 200

# Direct DB query (Supabase prod)
PGPASSWORD='Leno2016!!123' /opt/homebrew/opt/libpq/bin/psql \
  "postgresql://postgres.rdwzpbxrkjlmtwcoiniq@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require" \
  -c "SELECT count(*) FROM spaces;"
```

## What runs where

| Concern                | Local | Prod |
| ---------------------- | ----- | ---- |
| Code execution         | localhost:8080 | Railway |
| Static SPA serving     | Vite dev server (5173/5174) | Vercel |
| Database               | Supabase (same DB, pooler URL) | Supabase (same) |
| CORS allow-list        | `localhost:5173,5174` | `millionstay-web.vercel.app,...` |
| `NODE_ENV`             | `development` | `production` |
| Static asset bundling  | Vite dev (un-minified) | Vite prod build |
| Secrets                | `artifacts/api-server/.env` | Railway env vars |

## Troubleshooting

**`Error: PORT environment variable is required`**
You ran `pnpm --filter @workspace/api-server start` directly without sourcing `.env`. Use `./scripts/dev.sh api` instead, or `set -a; source artifacts/api-server/.env; set +a` first.

**`connect ENETUNREACH 2406:...`**
Your `DATABASE_URL` is pointing to the IPv6 direct connection. Switch to the pooler URL in `artifacts/api-server/.env` (Supavisor `aws-1-ap-southeast-1.pooler.supabase.com:5432`).

**`self-signed certificate in certificate chain`**
The pooler URL needs `?sslmode=require&uselibpqcompat=true` in the connection string AND the code in `lib/db/src/index.ts` must set `ssl: { rejectUnauthorized: false }` for `supabase.` hosts. Both are already in place.

**Frontend gets 404 on `/api/v1/...`**
Vite dev server proxies nothing by default — the frontend hits the same origin. Make sure `VITE_API_URL=http://localhost:8080` is set in `artifacts/<app>/.env.local`, and that `setBaseUrl(VITE_API_URL)` is called at module load (already wired in `million-stay-web/src/lib/store.ts`).

**Port already in use**
Another `pnpm dev` is still running. `lsof -ti:8080 | xargs kill` then retry.
