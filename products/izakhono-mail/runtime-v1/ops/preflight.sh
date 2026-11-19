#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

read_env() {
  local key="$1" line value
  line="$(grep -m1 -E "^${key}=" .env 2>/dev/null || true)"
  value="${line#*=}"
  value="${value%\"}"; value="${value#\"}"
  value="${value%\'}"; value="${value#\'}"
  printf '%s' "$value"
}

command -v docker >/dev/null || { echo "BLOCKED: Docker is not installed."; exit 1; }
docker compose version >/dev/null || { echo "BLOCKED: Docker Compose v2 is unavailable."; exit 1; }

if [[ ! -f .env ]]; then
  echo "BLOCKED: .env is missing; copy .env.example and set secrets."
  exit 1
fi

for key in MAIL_DOMAIN MAIL_HOSTNAME MAILBOX ROUNDCUBE_DB_PASSWORD STALWART_RECOVERY_ADMIN; do
  value="$(read_env "$key")"
  if [[ -z "$value" ]]; then
    echo "BLOCKED: $key is missing from .env"
    exit 1
  fi
done

for key in ROUNDCUBE_DB_PASSWORD STALWART_RECOVERY_ADMIN; do
  value="$(read_env "$key")"
  if [[ "$value" == *CHANGE_ME* ]]; then
    echo "BLOCKED: replace placeholder value for $key"
    exit 1
  fi
done

mailbox="$(read_env MAILBOX)"
domain="$(read_env MAIL_DOMAIN)"
if [[ "$mailbox" != *@"$domain" ]]; then
  echo "BLOCKED: MAILBOX must belong to MAIL_DOMAIN"
  exit 1
fi

docker network inspect izakhono-mail >/dev/null 2>&1 || {
  echo "BLOCKED: start IZAKHONO HOST first to create the shared izakhono-mail network."
  exit 1
}
echo "OK: shared IZAKHONO mail network exists"

required_ports=(25 465 587 993)
for port in "${required_ports[@]}"; do
  if command -v ss >/dev/null && ss -lnt | awk '{print $4}' | grep -Eq ":${port}$"; then
    echo "WARN: TCP port ${port} is already occupied; inspect before activation."
  else
    echo "OK: TCP port ${port} is available."
  fi
done

mail_host="$(read_env MAIL_HOSTNAME)"
webmail_host="$(read_env WEBMAIL_HOSTNAME)"
for host in "$mail_host" "$webmail_host"; do
  if getent hosts "$host" >/dev/null 2>&1; then
    echo "OK: DNS resolves $host"
  else
    echo "WARN: public DNS for $host is not resolving on this execution environment."
  fi
done

if [[ -z "$(read_env STALWART_PROVISIONER_API_KEY)" || "$(read_env STALWART_PROVISIONER_API_KEY)" == *CHANGE_ME* ]]; then
  echo "WARN: restricted Stalwart JMAP provisioner credentials must be set after first-run setup."
fi
if [[ -z "$(read_env AGE_RECIPIENT)" ]]; then
  echo "WARN: encrypted backup is blocked until AGE_RECIPIENT is configured."
fi

echo "PREFLIGHT COMPLETE: shared Stalwart/Roundcube software prerequisites checked; public mail readiness remains evidence-gated."
