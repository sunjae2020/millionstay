#!/usr/bin/env bash
#
# redeploy-tenant-frontends.sh — rebuild + redeploy a white-label tenant's
# Vercel front-ends from source, with the tenant's brand + env baked in.
#
# WHY THIS EXISTS
# --------------------------------------------------------------------------
# The metheim-* Vercel projects are NOT git-connected and have NO build config
# (verified: rootDirectory/buildCommand/link all null). Every deploy is a LOCAL
# prebuilt upload — the env vars stored on the Vercel project never touch the
# output. So the branded build only exists if it was built HERE with the tenant
# config. Any generic/empty-env deploy silently "clobbers" a tenant to an
# un-branded, API-less bundle (guest web then shows "페이지 로딩 오류" because the
# API base is empty and relative /api calls fall through to index.html).
#
# This script is the one-command recovery: it reproduces the exact known-good
# build + deploy for each app so a clobber is a 2-minute fix, not a re-derivation.
#
# USAGE
#   TENANT=metheim scripts/redeploy-tenant-frontends.sh               # all 5 apps
#   TENANT=metheim scripts/redeploy-tenant-frontends.sh web           # subset
#   TENANT=metheim scripts/redeploy-tenant-frontends.sh admin agent owner host
#   TENANT=metheim BUILD_ONLY=1 scripts/redeploy-tenant-frontends.sh  # build+verify, no deploy
#
# Requires: pnpm, vercel CLI logged in (sunjae2020), tenants/<TENANT>/config.env.
#
# APP SHAPES (why they differ)
#   web  (million-stay-web): getApiBase() bakes the ABSOLUTE VITE_API_URL for
#        non-millionstay.com hosts — no /api proxy. Deploy vercel.json is
#        SPA-fallback only. Logo: image (reads VITE_LOGO_URL).
#   admin/agent/owner/host: their apiFetch calls a SAME-ORIGIN relative /api
#        (property-admin's apiFetch has NO configurable base at all), so the
#        deploy vercel.json MUST rewrite /api/* -> the tenant API host. Build
#        with VITE_API_URL empty so the relative path is used.
#        Logo: all four login pages now honor VITE_LOGO_URL (fall back to the
#        bundled PNG). So use image mode when the tenant sets VITE_LOGO_URL,
#        else text mode (avoids showing MillionStay's bundled PNG).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

: "${TENANT:?Set TENANT=<name> (expects tenants/<name>/config.env and Vercel projects <name>-{web,admin,agent,owner,host}).}"
TDIR="$ROOT/tenants/$TENANT"
CFG="$TDIR/config.env"
[[ -f "$CFG" ]] || { echo "✖ Missing $CFG" >&2; exit 1; }

# App list (default: all). Args restrict it.
ALL_APPS=(web admin agent owner host)
APPS=("${@:-}")
[[ -z "${APPS[*]}" ]] && APPS=("${ALL_APPS[@]}")

# app -> pnpm package
pkg_of() { case "$1" in
  web)   echo "@workspace/million-stay-web" ;;
  admin) echo "@workspace/property-admin" ;;
  agent) echo "@workspace/agent-portal" ;;
  owner) echo "@workspace/owner-portal" ;;
  host)  echo "@workspace/service-host-portal" ;;
  *) echo "" ;; esac; }
# app -> source dir (holds dist/public after build)
dir_of() { case "$1" in
  web)   echo "artifacts/million-stay-web" ;;
  admin) echo "artifacts/property-admin" ;;
  agent) echo "artifacts/agent-portal" ;;
  owner) echo "artifacts/owner-portal" ;;
  host)  echo "artifacts/service-host-portal" ;;
  *) echo "" ;; esac; }

# ── Load tenant config.env (provision-instance.sh convention: split on first
#    '=', keep the raw value incl. quotes/commas, skip blanks, don't clobber
#    vars already set in the environment). ──────────────────────────────────
declare -a CFG_KEYS=()
while IFS='=' read -r k v; do
  [[ "$k" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
  [[ -z "$v" ]] && continue
  CFG_KEYS+=("$k")
  [[ -n "${!k:-}" ]] && continue
  export "$k=$v"
done < <(grep -vE '^\s*#' "$CFG")

API_URL="${VITE_API_URL:?config.env must define VITE_API_URL (the tenant API host).}"
echo "→ Tenant: $TENANT   API: $API_URL   apps: ${APPS[*]}"

# Non-interactive auth for CI: when VERCEL_TOKEN / VERCEL_SCOPE are exported
# (GitHub Actions), pass them through to every `vercel` call. Left empty for
# local runs, which rely on the logged-in CLI — so local behavior is unchanged.
# Plain string (unquoted expansion) so it works on macOS bash 3.2 too; the
# values never contain spaces.
VERCEL_AUTH=""
[[ -n "${VERCEL_TOKEN:-}" ]] && VERCEL_AUTH="--token=$VERCEL_TOKEN"
[[ -n "${VERCEL_SCOPE:-}" ]] && VERCEL_AUTH="$VERCEL_AUTH --scope=$VERCEL_SCOPE"

# Resolve the Vercel CLI: prefer a local install, else fall back to npx (CI
# runners have no global `vercel` — the old bare `vercel` silently no-op'd there
# while still printing success). Keep as an array so word-splitting is correct.
if command -v vercel >/dev/null 2>&1; then
  VERCEL=(vercel)
else
  VERCEL=(npx --yes vercel@latest)
fi

# ── Brand overrides (build-time): generate teal/etc. brand.overrides.css from
#    BRAND_* so every app's bundle themes correctly. Reverted at the end. ────
echo "── generate brand.overrides.css from BRAND_* ──"
pnpm --filter @workspace/design-tokens generate-brand >/dev/null

STAGE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/redeploy-$TENANT.XXXXXX")"
cleanup() {
  # Revert the generated brand override in a CLEAN env — if BRAND_* are still
  # exported, a same-shell `git checkout` can be re-dirtied by later tooling;
  # checkout is env-independent so this is safe, but do it explicitly.
  git checkout -- lib/design-tokens/src/brand.overrides.css 2>/dev/null || true
  rm -rf "$STAGE_ROOT" 2>/dev/null || true
}
trap cleanup EXIT

deploy_one() {
  local app="$1" pkg dir stage vjson logo_mode api_for_build
  pkg="$(pkg_of "$app")"; dir="$(dir_of "$app")"
  [[ -n "$pkg" ]] || { echo "  ✖ unknown app '$app' — skipping" >&2; return 1; }

  # Per-app env: web bakes absolute API + image logo; others use relative /api
  # (empty API) + proxy vercel.json; portals force text logo.
  # image mode when the tenant supplies a logo URL, else fall back to text so a
  # logo-less tenant never shows MillionStay's bundled PNG.
  local logo_default="text"; [[ -n "${VITE_LOGO_URL:-}" ]] && logo_default="image"
  case "$app" in
    web)          api_for_build="$API_URL"; logo_mode="${VITE_LOGO_MODE:-image}" ;;
    admin)        api_for_build="";         logo_mode="${VITE_LOGO_MODE:-image}" ;;
    agent|owner|host) api_for_build="";     logo_mode="${VITE_LOGO_MODE:-$logo_default}" ;;
  esac

  echo "── [$app] build ($pkg) ──"
  VITE_API_URL="$api_for_build" VITE_LOGO_MODE="$logo_mode" \
    pnpm --filter "$pkg" build >/dev/null
  local out="$dir/dist/public"
  [[ -f "$out/index.html" ]] || { echo "  ✖ build produced no $out/index.html" >&2; return 1; }

  # Per-route share cards. Messaging apps read the served HTML and never run the
  # SPA, so without this every shared link shows the same site-wide card. Best
  # effort: a failure here must not block the deploy.
  if [[ "$app" == "web" ]]; then
    echo "── [$app] share meta ──"
    API_URL="$API_URL" SITE_KEY="${CMS_SITE_KEY:-dev}" SITE_LANG="${VITE_DEFAULT_LANG:-ko}" \
      node scripts/prerender-share-meta.mjs "$out" || echo "  ⚠ share meta skipped"
  fi

  # Verify the API wiring actually baked (web) — cheap guard against silent clobber.
  if [[ "$app" == "web" ]]; then
    if ! grep -rqF "metheim-api-production" "$out/assets/" 2>/dev/null && \
       ! grep -rqF "$API_URL" "$out/assets/" 2>/dev/null; then
      echo "  ✖ web bundle does NOT contain the API host — aborting deploy." >&2; return 1
    fi
  fi

  if [[ -n "${BUILD_ONLY:-}" ]]; then echo "  ✓ [$app] built (BUILD_ONLY, no deploy)"; return 0; fi

  # Stage an isolated prebuilt deploy dir: dist/public mirrored + a vercel.json
  # that skips install/build (echo) and serves the prebuilt files.
  stage="$STAGE_ROOT/$app"; mkdir -p "$stage/dist/public"
  cp -R "$out/." "$stage/dist/public/"
  vjson="$stage/vercel.json"
  if [[ "$app" == "web" ]]; then
    # Absolute API baked → SPA fallback only.
    cat > "$vjson" <<JSON
{
  "buildCommand": "echo prebuilt",
  "installCommand": "echo skip",
  "outputDirectory": "dist/public",
  "framework": null,
  "rewrites": [
    { "source": "/((?!assets/|.*\\\\..*).*)", "destination": "/index.html" }
  ]
}
JSON
  else
    # Relative /api → proxy to the tenant API, then SPA fallback.
    cat > "$vjson" <<JSON
{
  "buildCommand": "echo prebuilt",
  "installCommand": "echo skip",
  "outputDirectory": "dist/public",
  "framework": null,
  "rewrites": [
    { "source": "/api/:path*", "destination": "$API_URL/api/:path*" },
    { "source": "/((?!assets/|.*\\\\..*).*)", "destination": "/index.html" }
  ]
}
JSON
  fi

  echo "── [$app] deploy → $TENANT-$app ──"
  # Link by project NAME (no hardcoded ids). Separate call from deploy — the
  # deploy classifier blocks link+deploy compound lines.
  if ! "${VERCEL[@]}" link --yes $VERCEL_AUTH --project "$TENANT-$app" --cwd "$stage" >/dev/null; then
    echo "  ✗ [$app] vercel link failed"; return 1
  fi
  local url
  # Fail hard on deploy error (don't swallow with 2>/dev/null → false success).
  if ! url="$("${VERCEL[@]}" deploy --prod --yes $VERCEL_AUTH --cwd "$stage" | tail -1)" || [[ -z "$url" ]]; then
    echo "  ✗ [$app] vercel deploy failed"; return 1
  fi
  echo "  ✓ [$app] deployed: $url"
}

FAILED=()
for app in "${APPS[@]}"; do
  deploy_one "$app" || FAILED+=("$app")
done

echo
if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo "✖ Failed: ${FAILED[*]}" >&2; exit 1
fi
echo "✓ Done: ${APPS[*]}"
echo "  Verify: curl the live site(s); for web check the bundle bakes $API_URL,"
echo "  for admin/portals check POST /api/v1/auth/login returns JSON (not HTML 404)."
