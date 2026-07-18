#!/usr/bin/env bash
# Guard: lib/design-tokens/src/brand.overrides.css must stay EMPTY in the repo.
#
# It is generated per white-label instance at build time by
# scripts/generate-brand.mjs (spec §2.4) and its non-empty output must never be
# committed — a committed override silently re-themes ALL apps (it is imported
# after brand.css in every app's index.css). See WHITELABEL_INSTANCE_SEPARATION.md.
#
# Rejects a commit whose staged brand.overrides.css declares any custom property
# (a `--foo:` line inside :root). The empty default has none.
#
# Bypass (only for an intentional primary-brand change): git commit --no-verify

set -e

FILE="lib/design-tokens/src/brand.overrides.css"

# Only act if the file is staged.
if ! git diff --cached --name-only | grep -qx "$FILE"; then
  exit 0
fi

# Inspect the staged blob (index version), ignoring comment/blank lines.
staged=$(git show ":$FILE" 2>/dev/null || true)
decls=$(printf '%s\n' "$staged" | grep -E '^\s*--[A-Za-z]' || true)

if [ -n "$decls" ]; then
  echo "✖ Refusing to commit a non-empty $FILE" >&2
  echo "  It must stay empty (:root {}) — the primary MillionStay default." >&2
  echo "  Per-instance overrides are generated at build time, never committed:" >&2
  echo "    pnpm --filter @workspace/design-tokens generate-brand   # no env → empty" >&2
  echo "  Offending declarations:" >&2
  printf '%s\n' "$decls" | sed 's/^/    /' >&2
  echo "  (Intentional primary-brand change? bypass with: git commit --no-verify)" >&2
  exit 1
fi

exit 0
