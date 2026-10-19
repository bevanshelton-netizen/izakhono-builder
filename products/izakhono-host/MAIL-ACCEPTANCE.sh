#!/usr/bin/env bash
set -u

# Read-only mail acceptance gate. Never sends mail, prints secrets, or mutates DNS.
# Usage: MAIL_DOMAIN=example.com ./MAIL-ACCEPTANCE.sh
# Optional: SMTP_HOST, SMTP_PORT (default 587), SMTP_TLS_MODE, DKIM_SELECTOR.
# Set MAIL_ACCEPTANCE_STRICT=1 to turn configuration warnings into failures.

PASS=0
FAIL=0
WARN=0

pass(){ PASS=$((PASS+1)); printf '[PASS] %s\n' "$1"; }
fail(){ FAIL=$((FAIL+1)); printf '[FAIL] %s\n' "$1"; }
warn(){ WARN=$((WARN+1)); printf '[WARN] %s\n' "$1"; }

DOMAIN="${MAIL_DOMAIN:-}"
STRICT="${MAIL_ACCEPTANCE_STRICT:-0}"
SMTP_PORT="${SMTP_PORT:-587}"

if [[ -z "$DOMAIN" ]]; then
  fail 'MAIL_DOMAIN is required'
else
  if [[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ && "$DOMAIN" != .* && "$DOMAIN" != *..* ]]; then
    pass "mail domain format: $DOMAIN"
  else
    fail 'MAIL_DOMAIN has invalid syntax'
  fi
fi

if command -v dig >/dev/null 2>&1 && [[ -n "$DOMAIN" ]]; then
  MX="$(dig +short MX "$DOMAIN" 2>/dev/null || true)"
  if [[ -n "$MX" ]]; then pass 'MX record present'; else warn 'No MX record returned'; fi

  SPF="$(dig +short TXT "$DOMAIN" 2>/dev/null | grep -i 'v=spf1' || true)"
  if [[ -n "$SPF" ]]; then pass 'SPF record present'; else warn 'No SPF TXT record returned'; fi

  DMARC="$(dig +short TXT "_dmarc.$DOMAIN" 2>/dev/null | grep -i 'v=DMARC1' || true)"
  if [[ -n "$DMARC" ]]; then pass 'DMARC record present'; else warn 'No DMARC TXT record returned'; fi

  if [[ -n "${DKIM_SELECTOR:-}" ]]; then
    DKIM="$(dig +short TXT "${DKIM_SELECTOR}._domainkey.$DOMAIN" 2>/dev/null || true)"
    if [[ -n "$DKIM" ]]; then pass "DKIM record present for selector ${DKIM_SELECTOR}"; else warn "No DKIM TXT record returned for selector ${DKIM_SELECTOR}"; fi
  else
    warn 'DKIM_SELECTOR not supplied; DKIM cannot be checked deterministically'
  fi
else
  warn 'dig is unavailable; public DNS checks skipped'
fi

if [[ -n "${SMTP_HOST:-}" ]]; then
  if [[ "$SMTP_PORT" =~ ^[0-9]+$ ]] && (( SMTP_PORT >= 1 && SMTP_PORT <= 65535 )); then
    pass "SMTP endpoint configured: ${SMTP_HOST}:${SMTP_PORT}"
  else
    fail 'SMTP_PORT is invalid'
  fi
else
  if [[ "$STRICT" == '1' ]]; then fail 'SMTP_HOST is not configured'; else warn 'SMTP_HOST is not configured; transactional sending remains gated'; fi
fi

if [[ "$STRICT" == '1' && "$FAIL" -eq 0 && "$WARN" -gt 0 ]]; then
  FAIL=$((FAIL+WARN))
  WARN=0
fi

printf '\nMAIL ACCEPTANCE SUMMARY: PASS=%d FAIL=%d WARN=%d\n' "$PASS" "$FAIL" "$WARN"
if (( FAIL > 0 )); then
  printf 'MAIL ACCEPTANCE: FAILED\n'
  exit 1
fi
printf 'MAIL ACCEPTANCE: %s\n' "$( (( WARN > 0 )) && printf 'PENDING' || printf 'PASSED' )"
