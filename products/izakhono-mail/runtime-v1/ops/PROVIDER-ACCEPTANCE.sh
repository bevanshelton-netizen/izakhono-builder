#!/usr/bin/env bash
set -euo pipefail

HOSTNAME="${MAIL_HOSTNAME:-mail.izakhonoafrica.co.za}"
DOMAIN="${MAIL_DOMAIN:-izakhonoafrica.co.za}"

fail=0
check() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "PASS: $label"
  else
    echo "BLOCKED: $label"
    fail=1
  fi
}

command -v dig >/dev/null || { echo "BLOCKED: dig is required"; exit 1; }
command -v nc >/dev/null || { echo "BLOCKED: nc is required"; exit 1; }

check "A record for ${HOSTNAME}" dig +short A "$HOSTNAME"
check "MX record for ${DOMAIN}" dig +short MX "$DOMAIN"
check "SPF record for ${DOMAIN}" bash -c "dig +short TXT '$DOMAIN' | grep -qi 'v=spf1'"
check "PTR resolves to ${HOSTNAME}" bash -c "ip=\$(dig +short A '$HOSTNAME' | head -n1); test -n \"\$ip\" && dig +short -x \"\$ip\" | grep -qi \"${HOSTNAME}.\""

for port in 25 465 587 993; do
  check "TCP ${HOSTNAME}:${port}" nc -z -w 8 "$HOSTNAME" "$port"
done

check "SMTP banner on port 25" bash -c "timeout 10 bash -c '</dev/tcp/$HOSTNAME/25'"
check "HTTPS endpoint" curl -fsSIL --max-time 15 "https://${HOSTNAME}/"

if [[ "$fail" -ne 0 ]]; then
  echo
  echo "PROVIDER ACCEPTANCE: FAIL — do not deploy IZAKHONO MAIL to this runtime."
  exit 2
fi

echo
echo "PROVIDER ACCEPTANCE: PASS — runtime satisfies the network/DNS gate."
