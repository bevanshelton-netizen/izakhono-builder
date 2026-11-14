#!/usr/bin/env bash
set -Eeuo pipefail

: "${MAIL_DOMAIN:?Set MAIL_DOMAIN}"
: "${MAIL_HOST:?Set MAIL_HOST}"
: "${MAIL_PUBLIC_IP:?Set the verified static public IPv4 address}"
: "${MAIL_TEST_ADDRESS:?Set MAIL_TEST_ADDRESS}"
: "${DKIM_SELECTOR:?Set DKIM_SELECTOR from the live Stalwart DKIM configuration}"

fail=0
pass() { printf 'PASS  %s\n' "$1"; }
warn() { printf 'WARN  %s\n' "$1"; }
bad() { printf 'FAIL  %s\n' "$1"; fail=1; }

command -v dig >/dev/null 2>&1 || { echo "dig is required (install dnsutils)." >&2; exit 2; }
command -v openssl >/dev/null 2>&1 || { echo "openssl is required." >&2; exit 2; }
command -v curl >/dev/null 2>&1 || { echo "curl is required." >&2; exit 2; }

MX_TARGET="$(dig +short MX "$MAIL_DOMAIN" | sort -n | awk 'NR==1 {print $2}' | sed 's/\.$//')"
[[ "$MX_TARGET" == "$MAIL_HOST" ]] && pass "MX points to $MAIL_HOST" || bad "MX target is '$MX_TARGET', expected $MAIL_HOST"

A_RECORD="$(dig +short A "$MAIL_HOST" | head -n1 || true)"
[[ "$A_RECORD" == "$MAIL_PUBLIC_IP" ]] && pass "Mail A record matches static public IP" || bad "Mail A record '$A_RECORD' does not match $MAIL_PUBLIC_IP"

for service_host in "webmail.$MAIL_DOMAIN" "autoconfig.$MAIL_DOMAIN" "autodiscover.$MAIL_DOMAIN" "mta-sts.$MAIL_DOMAIN"; do
  service_ip="$(dig +short A "$service_host" | head -n1 || true)"
  [[ "$service_ip" == "$MAIL_PUBLIC_IP" ]] && pass "$service_host resolves to mail edge" || bad "$service_host resolves to '$service_ip', expected $MAIL_PUBLIC_IP"
done

PTR="$(dig +short -x "$MAIL_PUBLIC_IP" | sed 's/\.$//' | head -n1 || true)"
[[ "$PTR" == "$MAIL_HOST" ]] && pass "Reverse DNS/PTR matches $MAIL_HOST" || bad "PTR is '$PTR', expected $MAIL_HOST"

SPF="$(dig +short TXT "$MAIL_DOMAIN" | tr -d '"' | grep -m1 'v=spf1' || true)"
[[ -n "$SPF" ]] && pass "SPF record exists: $SPF" || bad "SPF record missing"
DMARC="$(dig +short TXT "_dmarc.$MAIL_DOMAIN" | tr -d '"' | grep -m1 'v=DMARC1' || true)"
[[ -n "$DMARC" ]] && pass "DMARC record exists" || bad "DMARC record missing"
DKIM="$(dig +short TXT "$DKIM_SELECTOR._domainkey.$MAIL_DOMAIN" | tr -d '"' | grep -m1 'v=DKIM1' || true)"
[[ -n "$DKIM" ]] && pass "DKIM selector record exists" || bad "DKIM record missing for selector $DKIM_SELECTOR"
MTA_STS="$(dig +short TXT "_mta-sts.$MAIL_DOMAIN" | tr -d '"' | grep -m1 'v=STSv1' || true)"
[[ -n "$MTA_STS" ]] && pass "MTA-STS DNS policy record exists" || bad "MTA-STS DNS record missing"
TLS_RPT="$(dig +short TXT "_smtp._tls.$MAIL_DOMAIN" | tr -d '"' | grep -m1 'v=TLSRPTv1' || true)"
[[ -n "$TLS_RPT" ]] && pass "TLS reporting DNS record exists" || bad "TLS reporting DNS record missing"

test_tls() {
  local label="$1" host="$2" port="$3" mode="${4:-}"
  local args=()
  if [[ "$mode" == "smtp" ]]; then args+=( -starttls smtp ); fi
  if timeout 15 openssl s_client -brief -verify_return_error -verify_hostname "$host" -connect "$host:$port" "${args[@]}" </dev/null >/tmp/izakhono-mail-tls-check.log 2>&1; then
    pass "$label TLS handshake and hostname verification"
  else
    bad "$label TLS handshake or certificate verification failed"
    sed -n '1,8p' /tmp/izakhono-mail-tls-check.log || true
  fi
}

test_tls "SMTP submission 465" "$MAIL_HOST" 465
test_tls "IMAPS 993" "$MAIL_HOST" 993
if timeout 15 openssl s_client -brief -starttls smtp -verify_return_error -verify_hostname "$MAIL_HOST" -connect "$MAIL_HOST:25" </dev/null >/tmp/izakhono-mail-smtp25-check.log 2>&1; then
  pass "SMTP port 25 STARTTLS handshake from this node"
else
  warn "Local SMTP port 25 test failed; confirm inbound port 25 from an independent external network"
fi

if curl -fsS --max-time 15 "https://$MAIL_HOST/" -o /dev/null; then
  pass "Stalwart HTTPS endpoint is reachable"
else
  bad "Stalwart HTTPS endpoint is not reachable"
fi
if curl -fsS --max-time 15 "https://webmail.$MAIL_DOMAIN/" -o /dev/null; then
  pass "Roundcube webmail HTTPS endpoint is reachable"
else
  bad "Roundcube webmail HTTPS endpoint is not reachable"
fi
if curl -fsS --max-time 15 "https://mta-sts.$MAIL_DOMAIN/.well-known/mta-sts.txt" | grep -q 'version: STSv1'; then
  pass "MTA-STS policy file is served"
else
  bad "MTA-STS policy file is not served correctly"
fi

if timeout 8 bash -c 'exec 3<>/dev/tcp/gmail-smtp-in.l.google.com/25' 2>/dev/null; then
  pass "Outbound TCP port 25 is reachable"
else
  bad "Outbound TCP port 25 is blocked or unreachable"
fi

echo
echo "Configured mailbox target: $MAIL_TEST_ADDRESS"
echo "An inbound SMTP test from an independent external network is still required."
echo "A real send/receive test to independent providers is required before LIVE_VERIFIED."
echo "Do not cut over MX or replace the existing provider's SPF until all existing senders have been inventoried and merged."
exit "$fail"
