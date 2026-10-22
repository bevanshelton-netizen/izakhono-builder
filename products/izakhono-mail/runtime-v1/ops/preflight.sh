#!/usr/bin/env bash
set -euo pipefail

required_ports=(25 465 587 993 80 443)

command -v docker >/dev/null || { echo 'BLOCKED: Docker is not installed'; exit 1; }
docker compose version >/dev/null || { echo 'BLOCKED: Docker Compose v2 is unavailable'; exit 1; }

for port in "${required_ports[@]}"; do
  if command -v ss >/dev/null && ss -lnt | awk '{print $4}' | grep -Eq ":${port}$"; then
    echo "WARN: local port ${port} already occupied"
  else
    echo "OK: local port ${port} available"
  fi
done

if [[ -f .env ]]; then
  source .env
  : "${MAIL_DOMAIN:?MAIL_DOMAIN missing}"
  : "${MAIL_HOSTNAME:?MAIL_HOSTNAME missing}"
  : "${MAILBOX:?MAILBOX missing}"
  echo "OK: mail configuration present for ${MAILBOX}"
else
  echo 'WARN: .env not created yet'
fi

echo 'PREFLIGHT COMPLETE: provider-neutral runtime can proceed when network/DNS prerequisites are satisfied.'
