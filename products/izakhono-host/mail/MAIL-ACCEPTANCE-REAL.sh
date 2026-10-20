#!/usr/bin/env bash
set -euo pipefail

# Read-only real mail acceptance probe. No DNS or server mutation.
: "${MAIL_DOMAIN:?set MAIL_DOMAIN}"
: "${MAIL_HOST:?set MAIL_HOST}"
: "${MAIL_TEST_ADDRESS:?set MAIL_TEST_ADDRESS}"

pass(){ printf '[PASS] %s\n' "$1"; }
fail(){ printf '[FAIL] %s\n' "$1"; exit 1; }

command -v dig >/dev/null 2>&1 || fail 'dig is required'
MX="$(dig +short MX "$MAIL_DOMAIN" | sed '/^$/d')"
[[ -n "$MX" ]] || fail "No MX record for $MAIL_DOMAIN"
pass "MX present for $MAIL_DOMAIN"

A="$(dig +short A "$MAIL_HOST" | head -n1)"
AAAA="$(dig +short AAAA "$MAIL_HOST" | head -n1)"
[[ -n "$A" || -n "$AAAA" ]] || fail "No A/AAAA record for $MAIL_HOST"
pass "Mail host resolves"

if command -v openssl >/dev/null 2>&1; then
  timeout 10 openssl s_client -connect "$MAIL_HOST:993" -servername "$MAIL_HOST" </dev/null 2>/dev/null | grep -q 'BEGIN CERTIFICATE\|Server certificate' || fail 'IMAPS TLS handshake failed'
  pass 'IMAPS TLS endpoint responds'
fi

printf '\nREAL MAIL ACCEPTANCE: network prerequisites passed; authenticated send/receive still requires mailbox credentials and an external delivery test.\n'
printf 'TEST ADDRESS: %s\n' "$MAIL_TEST_ADDRESS"
