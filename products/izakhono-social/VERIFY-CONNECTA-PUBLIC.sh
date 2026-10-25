#!/usr/bin/env bash
set -euo pipefail

URL="${1:?Usage: VERIFY-CONNECTA-PUBLIC.sh https://connecta.example}"
REPORT="${CONNECTA_PUBLIC_REPORT:-$HOME/CONNECTA-PUBLIC-VERIFY.txt}"
: > "$REPORT"

fail(){ printf '[FAIL] %s\n' "$*" | tee -a "$REPORT"; exit 1; }
pass(){ printf '[PASS] %s\n' "$*" | tee -a "$REPORT"; }

[[ "$URL" == https://* ]] || fail "Public verification requires HTTPS."

printf 'CONNECTA PUBLIC VERIFICATION\nURL=%s\n' "$URL" | tee -a "$REPORT"

HEALTH="$(curl --fail --silent --show-error --location --max-time 20 --write-out '\nHTTP_STATUS=%{http_code}\n' "$URL/health")" || fail "Public health endpoint is unreachable."
printf '%s\n' "$HEALTH" | tee -a "$REPORT"
grep -q 'HTTP_STATUS=200' <<<"$HEALTH" || fail "Public /health did not return HTTP 200."
pass "External HTTPS /health returned HTTP 200."

HEADERS="$(curl --fail --silent --show-error --head --max-time 20 "$URL/health")" || fail "Could not inspect HTTPS response headers."
printf '%s\n' "$HEADERS" | tee -a "$REPORT"
grep -qi '^strict-transport-security:' <<<"$HEADERS" || fail "HSTS header is missing."
pass "HSTS is present."

printf '\n[PASS] Public health and transport gate passed.\n' | tee -a "$REPORT"
printf 'Report: %s\n' "$REPORT" | tee -a "$REPORT"
