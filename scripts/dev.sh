#!/usr/bin/env bash
# Local dev — runs api-server (8080) + million-stay-web (5173) + property-admin (5174)
# concurrently with one Ctrl+C to stop all three.
#
# Usage:
#   ./scripts/dev.sh           # all three
#   ./scripts/dev.sh api       # only backend
#   ./scripts/dev.sh web       # only guest web
#   ./scripts/dev.sh admin     # only property-admin
#   ./scripts/dev.sh api web   # subset

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Load .env.local for tooling tokens (Supabase, GitHub, Cloudflare).
if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

# Load api-server local env.
if [ -f artifacts/api-server/.env ]; then
  set -a
  # shellcheck disable=SC1091
  source artifacts/api-server/.env
  set +a
fi

PIDS=()
trap 'echo; echo "Stopping..."; for pid in "${PIDS[@]:-}"; do kill "$pid" 2>/dev/null || true; done; exit 0' INT TERM

run_api() {
  echo "→ api-server  http://localhost:${PORT:-8080}"
  pnpm --filter @workspace/api-server dev &
  PIDS+=($!)
}

run_web() {
  echo "→ guest-web   http://localhost:5173"
  pnpm --filter @workspace/million-stay-web dev &
  PIDS+=($!)
}

run_admin() {
  echo "→ property-admin   http://localhost:5174"
  PORT=5174 pnpm --filter @workspace/property-admin dev &
  PIDS+=($!)
}

# Default: all
TARGETS=("$@")
if [ ${#TARGETS[@]} -eq 0 ]; then
  TARGETS=(api web admin)
fi

for t in "${TARGETS[@]}"; do
  case "$t" in
    api)   run_api ;;
    web)   run_web ;;
    admin) run_admin ;;
    *) echo "Unknown target: $t (use api|web|admin)" >&2; exit 1 ;;
  esac
done

wait
