#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "BLOCKED: copy .env.example to .env and set owner-controlled secrets." >&2
  exit 1
fi

read_env() {
  local key="$1" line value
  line="$(grep -m1 -E "^${key}=" .env || true)"
  value="${line#*=}"
  value="${value%\"}"; value="${value#\"}"
  value="${value%\'}"; value="${value#\'}"
  printf '%s' "$value"
}

MAIL_DOMAIN="$(read_env MAIL_DOMAIN)"
MAIL_HOSTNAME="$(read_env MAIL_HOSTNAME)"
MAILBOX="$(read_env MAILBOX)"
ROUNDCUBE_DB_PASSWORD="$(read_env ROUNDCUBE_DB_PASSWORD)"
STALWART_RECOVERY_ADMIN="$(read_env STALWART_RECOVERY_ADMIN)"

for name in MAIL_DOMAIN MAIL_HOSTNAME MAILBOX ROUNDCUBE_DB_PASSWORD STALWART_RECOVERY_ADMIN; do
  value="$(read_env "$name")"
  [[ -n "$value" ]] || { echo "BLOCKED: $name is missing from .env" >&2; exit 1; }
done

if [[ "$ROUNDCUBE_DB_PASSWORD" == CHANGE_ME* || "$STALWART_RECOVERY_ADMIN" == *CHANGE_ME* ]]; then
  echo "BLOCKED: replace all placeholder credentials in .env before bootstrap." >&2
  exit 1
fi
if [[ "$MAILBOX" != *@"$MAIL_DOMAIN" ]]; then
  echo "BLOCKED: MAILBOX must belong to MAIL_DOMAIN." >&2
  exit 1
fi

command -v docker >/dev/null || { echo "BLOCKED: Docker is not installed." >&2; exit 1; }
docker compose version >/dev/null || { echo "BLOCKED: Docker Compose v2 is unavailable." >&2; exit 1; }
docker network inspect izakhono-mail >/dev/null 2>&1 || {
  echo "BLOCKED: start the owned IZAKHONO HOST stack first; it creates the izakhono-mail network." >&2
  exit 1
}

echo "[1/6] Checking for an existing Stalwart runtime to prevent duplicate mail engines..."
existing_stalwart="$(docker ps --format '{{.Names}} {{.Image}}' | awk '$2 ~ /^stalwartlabs\/stalwart/ {print $1}')"
if [[ -n "$existing_stalwart" && "$existing_stalwart" != "izakhono-mailserver" ]]; then
  echo "BLOCKED: another Stalwart container is already running: $existing_stalwart" >&2
  echo "Inspect and reconcile its data/network binding before starting the canonical HOST mail service." >&2
  exit 1
fi

if [[ "$existing_stalwart" == "izakhono-mailserver" ]]; then
  existing_volumes="$(docker inspect -f '{{range .Mounts}}{{.Name}} {{end}}' izakhono-mailserver)"
  existing_networks="$(docker inspect -f '{{json .NetworkSettings.Networks}}' izakhono-mailserver)"
  [[ "$existing_volumes" == *"izakhono-mail-etc"* && "$existing_volumes" == *"izakhono-mail-data"* ]] || {
    echo "BLOCKED: existing Stalwart is not using the canonical IZAKHONO mail volumes." >&2
    exit 1
  }
  [[ "$existing_networks" == *"izakhono-mail"* ]] || {
    echo "BLOCKED: existing Stalwart is not attached to the shared izakhono-mail network." >&2
    exit 1
  }
fi

echo "[2/6] Ensuring the shared persistent Stalwart volumes exist..."
docker volume inspect izakhono-mail-etc >/dev/null 2>&1 || docker volume create izakhono-mail-etc >/dev/null
docker volume inspect izakhono-mail-data >/dev/null 2>&1 || docker volume create izakhono-mail-data >/dev/null

echo "[3/6] Validating both Compose configurations..."
docker compose --env-file .env config --quiet
docker compose --env-file .env -f ../../izakhono-host/mail/docker-compose.mail.yml config --quiet

echo "[4/6] Pulling the canonical Stalwart and Roundcube images..."
docker compose --env-file .env -f ../../izakhono-host/mail/docker-compose.mail.yml pull
docker compose --env-file .env pull

echo "[5/6] Starting the single canonical Stalwart service and Roundcube..."
if [[ -z "$existing_stalwart" ]]; then
  docker compose --env-file .env -f ../../izakhono-host/mail/docker-compose.mail.yml up -d
fi
docker compose --env-file .env up -d

for i in {1..30}; do
  if docker inspect -f '{{.State.Running}}' izakhono-mailserver 2>/dev/null | grep -q true; then break; fi
  sleep 2
done
if ! docker inspect -f '{{.State.Running}}' izakhono-mailserver 2>/dev/null | grep -q true; then
  echo "BLOCKED: canonical Stalwart container is not running." >&2
  docker compose --env-file .env -f ../../izakhono-host/mail/docker-compose.mail.yml ps
  exit 1
fi

for i in {1..30}; do
  if docker inspect -f '{{.State.Health.Status}}' izakhono-roundcube 2>/dev/null | grep -q healthy; then break; fi
  sleep 2
done
if ! docker inspect -f '{{.State.Health.Status}}' izakhono-roundcube 2>/dev/null | grep -q healthy; then
  echo "BLOCKED: Roundcube did not become healthy." >&2
  docker compose --env-file .env logs --tail=100 roundcube roundcube-db
  exit 1
fi

echo "[6/6] Runtime status"
docker compose --env-file .env -f ../../izakhono-host/mail/docker-compose.mail.yml ps
docker compose --env-file .env ps

echo
echo "Stalwart bootstrap/admin: http://127.0.0.1:18081 (loopback only; use an SSH tunnel)"
echo "Stalwart JMAP/API after setup: https://127.0.0.1:18080"
echo "Webmail: https://webmail.izakhonoafrica.co.za"
echo "IMAPS: $MAIL_HOSTNAME:993"
echo "SMTP submission: $MAIL_HOSTNAME:587"
echo
echo "No mailbox was created by this script. Complete owner-controlled Stalwart setup, configure ACME/DKIM, publish DNS, verify DNS, then use the IZAKHONO Provisioner."
