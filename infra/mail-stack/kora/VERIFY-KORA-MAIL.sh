#!/usr/bin/env bash
set -euo pipefail

DOMAIN="streamkoraafrica.com"
MAIL_HOST="mail.${DOMAIN}"
MAILBOX="info@${DOMAIN}"

fail(){ echo "FAIL: $*" >&2; exit 1; }
need(){ command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"; }
need dig
need openssl
need timeout

check_txt(){
  local name="$1" pattern="$2"
  local value
  value="$(dig +short TXT "$name" | tr -d '"' | tr '\n' ' ')"
  [[ "$value" == *"$pattern"* ]] || fail "TXT check failed for ${name}: expected ${pattern}"
  echo "PASS TXT ${name}"
}

ip="$(dig +short A "$MAIL_HOST" | head -n1)"
[[ -n "$ip" ]] || fail "no A record for ${MAIL_HOST}"
echo "PASS A ${MAIL_HOST} -> ${ip}"

mx="$(dig +short MX "$DOMAIN" | sort -n | head -n1)"
[[ "$mx" == *"${MAIL_HOST}."* ]] || fail "primary MX is not ${MAIL_HOST}: ${mx:-none}"
echo "PASS MX ${DOMAIN} -> ${mx}"

check_txt "$DOMAIN" "v=spf1"
check_txt "_dmarc.${DOMAIN}" "v=DMARC1"
check_txt "mail._domainkey.${DOMAIN}" "v=DKIM1"

smtp="$(timeout 10 openssl s_client -connect "${MAIL_HOST}:587" -starttls smtp -servername "$MAIL_HOST" -verify_return_error </dev/null 2>&1 || true)"
grep -Eq 'Verify return code: 0 \(ok\)' <<<"$smtp" || fail "587 STARTTLS certificate verification failed"
grep -Eq '250[- ].*' <<<"$smtp" || fail "587 SMTP EHLO response not observed"
echo "PASS SMTP STARTTLS ${MAIL_HOST}:587"

imap="$(timeout 10 openssl s_client -connect "${MAIL_HOST}:993" -servername "$MAIL_HOST" -verify_return_error </dev/null 2>&1 || true)"
grep -Eq 'Verify return code: 0 \(ok\)' <<<"$imap" || fail "993 TLS certificate verification failed"
grep -Eq '\* OK' <<<"$imap" || fail "993 IMAP greeting not observed"
echo "PASS IMAP TLS ${MAIL_HOST}:993"

echo ""
echo "KORA MAIL STATIC ACCEPTANCE PASSED"
echo "Mailbox: ${MAILBOX}"
echo "The following still require real external evidence and are intentionally NOT inferred:"
echo "  1. external inbound message received by ${MAILBOX}"
echo "  2. external outbound message accepted by a third-party mailbox"
echo "  3. reply returned to ${MAILBOX} and delivered back"
echo "  4. SPF/DKIM/DMARC authentication observed on a real outbound message"
echo "Only those four live-message checks may promote domain-readiness to LIVE_VERIFIED."
