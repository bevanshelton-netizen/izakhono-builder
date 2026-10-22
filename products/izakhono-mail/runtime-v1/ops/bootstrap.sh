#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.example to .env and set strong secrets." >&2
  exit 1
fi
source .env
: "${MAIL_DOMAIN:?MAIL_DOMAIN missing}"
: "${MAIL_HOSTNAME:?MAIL_HOSTNAME missing}"
: "${MAILBOX:?MAILBOX missing}"
: "${MAILBOX_PASSWORD:?MAILBOX_PASSWORD missing}"
: "${ROUNDCUBE_DB_PASSWORD:?ROUNDCUBE_DB_PASSWORD missing}"

if [[ "$MAILBOX_PASSWORD" == "CHANGE_ME"* || "$ROUNDCUBE_DB_PASSWORD" == "CHANGE_ME"* ]]; then
  echo "Replace placeholder passwords in .env before deployment." >&2
  exit 1
fi

mkdir -p dms-config/{ssl,opendkim,postfix,dovecot,rspamd} mail-data mail-state mail-logs mail-config roundcube-db caddy-data caddy-config

echo "[1/6] Pulling pinned mail runtime..."
docker compose pull

echo "[2/6] Starting mail core and webmail..."
docker compose up -d

echo "[3/6] Waiting for mailserver..."
for i in {1..30}; do
  if docker inspect -f '{{.State.Health.Status}}' izakhono-mailserver 2>/dev/null | grep -q healthy; then break; fi
  sleep 5
done

echo "[4/6] Creating mailbox..."
docker exec izakhono-mailserver setup email add "$MAILBOX" "$MAILBOX_PASSWORD" || true

echo "[5/6] Generating DKIM..."
docker exec izakhono-mailserver setup config dkim domain "$MAIL_DOMAIN" || true
docker compose restart mailserver
sleep 10

echo "[6/6] Runtime status"
docker compose ps

echo
echo "Webmail: https://$MAIL_HOSTNAME"
echo "IMAPS: $MAIL_HOSTNAME:993"
echo "SMTP submission: $MAIL_HOSTNAME:587"
