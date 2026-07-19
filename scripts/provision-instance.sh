#!/usr/bin/env bash
#
# provision-instance.sh — bring up a white-label instance database + brand.
#
# White-label instance separation (docs/proposals/WHITELABEL_PILOT_SETUP.md).
# Applies the schema, seeds baseline data, and generates the per-instance brand
# overrides against a SEPARATE database — never the primary/production one.
#
# Usage:
#   DATABASE_URL="postgresql://...pilot..." \
#   BRAND_ORANGE="256 84% 58%" \
#     scripts/provision-instance.sh
#
# Admin user is NOT created here — it is auto-created by the API on first boot
# (ensureAdminExists) from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD. See §Step 2.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ── Optional: load a tenant's config from tenants/<name>/ ────────────────────
# Usage: TENANT=metheim scripts/provision-instance.sh
# Sources config.env (committed, non-secret) + secrets.env (gitignored). Any
# vars already set in the environment take precedence (they are not overwritten).
if [[ -n "${TENANT:-}" ]]; then
  TDIR="$ROOT/tenants/$TENANT"
  [[ -d "$TDIR" ]] || { echo "✖ Unknown tenant: tenants/$TENANT not found." >&2; exit 1; }
  for f in config.env secrets.env; do
    if [[ -f "$TDIR/$f" ]]; then
      # export non-empty KEY=VALUE lines, without clobbering already-set vars
      while IFS='=' read -r k v; do
        [[ "$k" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
        [[ -z "$v" ]] && continue
        [[ -n "${!k:-}" ]] && continue
        export "$k=$v"
      done < <(grep -vE '^\s*#' "$TDIR/$f")
    fi
  done
  echo "→ Loaded tenant config: tenants/$TENANT (config.env$([[ -f "$TDIR/secrets.env" ]] && echo ' + secrets.env'))"
fi

# ── Safety: refuse to run against the primary/production DB ──────────────────
PROD_REF="rdwzpbxrkjlmtwcoiniq"   # primary MillionStay Supabase project ref
: "${DATABASE_URL:?Set DATABASE_URL to the NEW instance database (session pooler URL).}"
if [[ "$DATABASE_URL" == *"$PROD_REF"* ]]; then
  echo "✖ REFUSING: DATABASE_URL points at the primary/production project ($PROD_REF)." >&2
  echo "  Provisioning must target a SEPARATE Supabase project for the new instance." >&2
  exit 1
fi
MASKED="$(printf '%s' "$DATABASE_URL" | sed -E 's|(://[^:]*):[^@]*@|\1:***@|')"
echo "→ Target instance DB: $MASKED"
echo "→ This is NOT the primary project (guard passed)."
echo

# ── 1. Schema ────────────────────────────────────────────────────────────────
echo "── [1/3] Applying schema (drizzle push) ──"
DATABASE_URL="$DATABASE_URL" pnpm --filter @workspace/db push

# ── 2. Baseline seeds (idempotent) ──────────────────────────────────────────
echo "── [2/3] Seeding baseline data ──"
if command -v psql >/dev/null 2>&1; then
  DATABASE_URL="$DATABASE_URL" psql "$DATABASE_URL" -f lib/db/seed/translations-seed.sql
else
  echo "  ⚠ psql not found — SKIPPED translations-seed.sql (run it manually)."
fi
DATABASE_URL="$DATABASE_URL" node artifacts/api-server/scripts/seed-document-templates.mjs
DATABASE_URL="$DATABASE_URL" node artifacts/api-server/scripts/seed-pdf-templates.mjs
# Optional demo data (uncomment for a populated pilot):
# DATABASE_URL="$DATABASE_URL" node artifacts/api-server/scripts/seed-homestay-samples.mjs

# ── 3. Per-instance brand overrides (build-time) ────────────────────────────
echo "── [3/3] Generating brand overrides from BRAND_* env ──"
pnpm --filter @workspace/design-tokens generate-brand

echo
echo "✓ Instance DB provisioned + brand generated."
echo
echo "Next:"
echo "  • Boot the API once against this DB with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD"
echo "    set — ensureAdminExists() creates the first admin. Rotate it after login."
echo "  • Build each front-end with its VITE_* env (VITE_API_URL, VITE_APP_NAME),"
echo "    then deploy (Vercel) + register the instance domain."
echo "  • Set ROOT_DOMAIN + ALLOWED_ORIGINS on the API for the instance domain."
