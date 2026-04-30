#!/usr/bin/env bash
# Privacy coverage tests — verify high-level invariants.
# Distinct from check-privacy.sh: these are stronger guarantees that should
# always hold, run in CI to block merge.
#
# Tests:
#   1. Every guest_* DB schema is covered by /v1/guest/me/export
#   2. Every PII column name in any DB schema appears in logger.ts redact list
#   3. The Privacy Act compliance doc references all third-party vendors that
#      have an API_KEY env var

set -uo pipefail

REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$REPO"

RED='\033[0;31m'; YEL='\033[0;33m'; GRN='\033[0;32m'; NC='\033[0m'
FAIL=0
fail() { echo -e "${RED}✗${NC} $1"; FAIL=1; }
ok()   { echo -e "${GRN}✓${NC} $1"; }

# ─── Test 1: DSAR /me/export covers all guest_* tables ──────
echo "─── Test 1: APP 12 — /v1/guest/me/export covers all guest_* tables"
GUEST_TABLES=$(grep -lE 'pgTable\("guest_' lib/db/src/schema/*.ts 2>/dev/null | xargs -I {} basename {} .ts | tr -d '\n' | sed 's/_/ /g')
EXPORT_FILE=artifacts/api-server/src/routes/guest-portal.ts
if ! grep -qE 'router\.(get|post)\("/v1/guest/me/export"' "$EXPORT_FILE"; then
  fail "no /v1/guest/me/export route in $EXPORT_FILE"
else
  EXPORT_BLOCK=$(awk '/me\/export/,/^}\);/' "$EXPORT_FILE")
  for f in lib/db/src/schema/guest_*.ts; do
    [ -f "$f" ] || continue
    # Extract table variable name (e.g. guestUsersTable, guestEmergencyContactsTable)
    TABLE_VAR=$(grep -E 'export const \w+Table = pgTable' "$f" | head -1 | grep -oE '\w+Table' | head -1)
    [ -z "$TABLE_VAR" ] && continue
    if echo "$EXPORT_BLOCK" | grep -q "$TABLE_VAR"; then
      ok "exported: $TABLE_VAR"
    else
      fail "$TABLE_VAR is in lib/db/src/schema but NOT referenced in /me/export"
    fi
  done
fi
echo

# ─── Test 2: PII column names → logger redact list ──────────
echo "─── Test 2: APP 11 — every PII column name appears in logger.ts redact list"
LOGGER=artifacts/api-server/src/lib/logger.ts
PII_COLS=$(grep -hE '"(passport|tfn|medicare|driver_licen[cs]e|credit_card|card_number|cvv|cvc|bank_account|date_of_birth|dob|password)' lib/db/src/schema/*.ts 2>/dev/null | grep -oE '"[a-z_]+"' | tr -d '"' | sort -u)
for col in $PII_COLS; do
  if grep -qE "\"\\*\\.${col}\"|\"${col}\"" "$LOGGER"; then
    ok "redacted: $col"
  else
    fail "$col is in DB schema but NOT in $LOGGER redact list"
  fi
done
echo

# ─── Test 3: third-party vendors documented ─────────────────
echo "─── Test 3: APP 8 — every *_API_KEY / *_SECRET_KEY referenced in code is in PRIVACY_COMPLIANCE.md"
COMPLIANCE_DOC=docs/PRIVACY_COMPLIANCE.md
[ -f "$COMPLIANCE_DOC" ] || fail "$COMPLIANCE_DOC missing"
VENDOR_KEYS=$(grep -rhEo '\b(RESEND|STRIPE|SUPABASE|CLOUDINARY|MAILGUN|TWILIO|SENDGRID|ANTHROPIC|OPENAI|GOOGLE_MAPS)_(API_KEY|SECRET_KEY|ACCESS_TOKEN)' artifacts/ lib/ 2>/dev/null | sort -u)
for key in $VENDOR_KEYS; do
  vendor=$(echo "$key" | cut -d_ -f1 | tr '[:upper:]' '[:lower:]')
  if grep -qiE "(^|[^a-z])${vendor}([^a-z]|$)" "$COMPLIANCE_DOC"; then
    ok "documented: $vendor (via $key)"
  else
    fail "vendor '$vendor' (env: $key) is used in code but NOT mentioned in $COMPLIANCE_DOC"
  fi
done
echo

# ─── Summary ────────────────────────────────────────────────
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GRN}═══ PASS — privacy coverage clean ═══${NC}"
  exit 0
else
  echo -e "${RED}═══ FAIL ═══${NC}"
  exit 1
fi
