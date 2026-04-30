#!/usr/bin/env bash
# Static privacy/security checks. Run pre-commit and in CI.
# Exit non-zero on any violation.
#
# Usage:
#   ./scripts/check-privacy.sh                # check whole repo
#   ./scripts/check-privacy.sh --staged       # only files staged for commit
#
# Override on a specific file with the marker `// privacy-skip: <reason>`.

set -uo pipefail

REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$REPO"

MODE=${1:-all}
RED='\033[0;31m'; YEL='\033[0;33m'; GRN='\033[0;32m'; NC='\033[0m'
FAIL=0

# Files to scan (TypeScript/JavaScript only, exclude generated/node_modules).
if [ "$MODE" = "--staged" ]; then
  FILES=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|tsx|js|mjs)$' | grep -v -E '(^|/)(node_modules|dist|.next|generated)/' || true)
else
  FILES=$(find artifacts lib -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.mjs' \) \
    -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/.next/*' -not -path '*/generated/*' 2>/dev/null || true)
fi

[ -z "$FILES" ] && { echo "No files to check."; exit 0; }

echo "Scanning $(echo "$FILES" | wc -l | tr -d ' ') file(s)..."
echo

fail() { echo -e "${RED}✗${NC} $1"; FAIL=1; }
warn() { echo -e "${YEL}⚠${NC} $1"; }
ok()   { echo -e "${GRN}✓${NC} $1"; }

# ─── 1. Hardcoded secrets ───────────────────────────────────
echo "─── 1. Hardcoded secret patterns"
SECRET_HITS=$(echo "$FILES" | xargs grep -nE '(pk_(live|test)_[A-Za-z0-9]{20,}|sk_(live|test)_[A-Za-z0-9]{20,}|whsec_[A-Za-z0-9]{20,}|re_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|cfut_[A-Za-z0-9]{30,}|sbp_[A-Za-z0-9]{30,}|Bearer\s+[A-Za-z0-9\._-]{20,}|eyJ[A-Za-z0-9_-]{30,})' 2>/dev/null || true)
if [ -n "$SECRET_HITS" ]; then
  while IFS= read -r line; do
    file=${line%%:*}
    if grep -q "privacy-skip" "$file" 2>/dev/null; then continue; fi
    fail "potential secret in $line"
  done <<< "$SECRET_HITS"
else
  ok "no hardcoded secrets"
fi
echo

# ─── 2. Console.log of PII ──────────────────────────────────
echo "─── 2. PII via console.log (variable interpolation only)"
# Match ONLY actual variable use, not the word in a string literal:
#   - `${...password...}` template interpolation
#   - `console.log(password)` or `console.log(x, password)` direct variable
# Avoids false positives like "password reset link" or "Failed to revoke ... password reset:".
PII_VARS='password|passwordHash|password_hash|passport|passport_no|tfn|medicare|driver_licen[cs]e|credit_card|card_number|cvv|cvc|date_of_birth|bank_account'
# Two patterns:
# 1. ${someName.password} or ${password} inside a template literal
# 2. console.log(password) or console.log(x, password) — actual variable arg
PII_LOG=$(echo "$FILES" | xargs grep -nE "console\.(log|info|debug|warn|error)\([^)]*(\\\$\{[^}]*\\.?(${PII_VARS})\\b|[,(]\\s*(${PII_VARS})\\b\\s*[,)])" 2>/dev/null || true)
if [ -n "$PII_LOG" ]; then
  while IFS= read -r line; do
    file=${line%%:*}
    if grep -q "privacy-skip" "$file" 2>/dev/null; then continue; fi
    fail "PII via console in $line"
  done <<< "$PII_LOG"
else
  ok "no PII in console calls"
fi
echo

# ─── 3. PII fields not in logger redact list ────────────────
echo "─── 3. PII column names vs logger redact list"
SCHEMA_DIR=lib/db/src/schema
if [ -d "$SCHEMA_DIR" ]; then
  PII_COLS=$(grep -hE '(passport|tfn|medicare|driver_licen[cs]e|credit_card|card_number|cvv|cvc|bank_account|date_of_birth|dob)' "$SCHEMA_DIR"/*.ts 2>/dev/null | grep -oE '"(passport[a-z_]*|tfn|medicare[a-z_]*|driver_licen[cs]e[a-z_]*|credit_card[a-z_]*|card_number|cvv|cvc|bank_account[a-z_]*|date_of_birth|dob)"' | tr -d '"' | sort -u)
  REDACT_FILE=artifacts/api-server/src/lib/logger.ts
  for col in $PII_COLS; do
    if ! grep -qE "\"\\*\\.${col}\"|\"${col}\"" "$REDACT_FILE" 2>/dev/null; then
      fail "PII column '$col' (in DB schema) is NOT in $REDACT_FILE redact list"
    fi
  done
  [ -z "$PII_COLS" ] || ok "all PII columns in schema present in redact list"
fi
echo

# ─── 4. Mutations without audit log (heuristic) ─────────────
echo "─── 4. db.insert/update/delete without nearby logAction (heuristic)"
ROUTE_FILES=$(echo "$FILES" | tr ' ' '\n' | grep -E 'routes/.+\.ts$' || true)
if [ -n "$ROUTE_FILES" ]; then
  for f in $ROUTE_FILES; do
    [ "$f" = "artifacts/api-server/src/routes/public.ts" ] && continue
    [ "$f" = "artifacts/api-server/src/routes/health.ts" ] && continue
    if grep -q "privacy-skip" "$f" 2>/dev/null; then continue; fi

    MUTATIONS=$(grep -nE "db\.(insert|update|delete)" "$f" 2>/dev/null | wc -l | tr -d ' ')
    [ "${MUTATIONS:-0}" -eq 0 ] && continue

    HAS_AUDIT=$(grep -cE "logAction\b" "$f" 2>/dev/null | head -1 | tr -d ' ')
    HAS_AUDIT=${HAS_AUDIT:-0}

    if [ "$HAS_AUDIT" -eq 0 ]; then
      warn "$f has $MUTATIONS mutation(s) but no logAction call"
    fi
  done
fi
echo

# ─── 5. Routes outside public.ts without auth middleware ────
echo "─── 5. Authenticated routes missing requireAuth middleware"
for f in $ROUTE_FILES; do
  base=$(basename "$f")
  case "$base" in
    public.ts|health.ts|auth.ts|guest-auth.ts|partner-auth.ts|stripe.ts|privacy.ts|dev-migration.ts) continue ;;
  esac
  if grep -q "privacy-skip" "$f" 2>/dev/null; then continue; fi

  HANDLERS=$(grep -cE 'router\.(post|put|patch|delete)' "$f" 2>/dev/null | head -1 | tr -d ' ')
  HANDLERS=${HANDLERS:-0}
  HAS_AUTH=$(grep -cE "(requireAuth|requireGuestAuth|requirePartnerAuth|router\.use\([^)]*require)" "$f" 2>/dev/null | head -1 | tr -d ' ')
  HAS_AUTH=${HAS_AUTH:-0}
  if [ "$HANDLERS" -gt 0 ] && [ "$HAS_AUTH" -eq 0 ]; then
    warn "$f has $HANDLERS write handler(s) — verify it is mounted after requireAuth in app.ts"
  fi
done
echo

# ─── 6. Insecure cookies ────────────────────────────────────
echo "─── 6. Cookies missing httpOnly"
COOKIE_HITS=$(echo "$FILES" | xargs grep -nE 'res\.cookie\(' 2>/dev/null || true)
if [ -n "$COOKIE_HITS" ]; then
  while IFS=: read -r f n line; do
    if grep -q "privacy-skip" "$f" 2>/dev/null; then continue; fi
    block=$(sed -n "${n},$((n+10))p" "$f" 2>/dev/null)
    if ! echo "$block" | grep -q "httpOnly:\s*true"; then
      fail "$f:$n cookie missing httpOnly: true"
    fi
  done <<< "$COOKIE_HITS"
else
  ok "no res.cookie calls (or all use httpOnly)"
fi
echo

# ─── 7. Raw SQL string concat ───────────────────────────────
echo "─── 7. Raw SQL with string concatenation"
SQL_HITS=$(echo "$FILES" | xargs grep -nE 'sql\.raw\([^)]*(\$\{|\+\s)' 2>/dev/null || true)
if [ -n "$SQL_HITS" ]; then
  while IFS= read -r line; do
    file=${line%%:*}
    if grep -q "privacy-skip" "$file" 2>/dev/null; then continue; fi
    fail "$line — sql.raw with interpolation (use parameterised query)"
  done <<< "$SQL_HITS"
else
  ok "no risky sql.raw patterns"
fi
echo

# ─── Summary ────────────────────────────────────────────────
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GRN}═══ PASS — privacy/security checks clean ═══${NC}"
  exit 0
else
  echo -e "${RED}═══ FAIL — fix the above before committing ═══${NC}"
  echo "To bypass on a specific file: add '// privacy-skip: <reason>' near the top."
  echo "To bypass the whole commit (rare): 'git commit --no-verify'."
  exit 1
fi
