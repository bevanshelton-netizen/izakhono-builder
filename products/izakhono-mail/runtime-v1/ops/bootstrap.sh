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
: "${ACME_EMAIL:?ACME_EMAIL missing}"

if [[ "$MAILBOX_PASSWORD" == "CHANGE_ME"* || "$ROUNDCUBE_DB_PASSWORD" == "CHANGE_ME"* ]]; then
  echo "Replace placeholder passwords in .env before deployment." >&2
  exit 1
fi

mkdir -p dms-config/{ssl,opendkim,postfix,dovecot,rspamd} mail-data mail-state mail-logs mail-config roundcube-db caddy-data caddy-config letsencrypt certbot-logs

echo "[1/7] Pulling pinned mail runtime..."
docker compose pull

echo "[2/7] Checking required public DNS before ACME..."
getent hosts "$MAIL_HOSTNAME" >/dev/null || { echo "DNS for $MAIL_HOSTNAME is not resolving on this node." >&2; exit 1; }

echo "[3/7] Provisioning/renewing Let's Encrypt certificate..."
# Caddy owns ports 80/443, so stop it while Certbot uses HTTP-01 on port 80.
docker compose stop caddy >/dev/null 2>&1 || true
docker rm -f izakhono-mail-certbot >/dev/null 2>&1 || true
docker run --name izakhono-mail-certbot --rm \
  -p 80:80 \
  -v "$(pwd)/letsencrypt:/etc/letsencrypt" \
  -v "$(pwd)/certbot-logs:/var/log/letsencrypt" \
  certbot/certbot:latest certonly --standalone --non-interactive --agree-tos \
  --email "$ACME_EMAIL" --keep-until-expiring -d "$MAIL_HOSTNAME"

echo "[4/7] Starting mail core and webmail..."
docker compose up -d

echo "[5/7] Waiting for mailserver..."
for i in {1..30}; do
  if docker inspect -f '{{.State.Health.Status}}' izakhono-mailserver 2>/dev/null | grep -q healthy; then break; fi
  sleep 5
done
if ! docker inspect -f '{{.State.Health.Status}}' izakhono-mailserver 2>/dev/null | grep -q healthy; then
  echo "Mailserver did not become healthy." >&2
  docker compose ps
  exit 1
fi

echo "[6/7] Creating mailbox and DKIM..."
docker exec izakhono-mailserver setup email add "$MAILBOX" "$MAILBOX_PASSWORD" || true
docker exec izakhono-mailserver setup config dkim domain "$MAIL_DOMAIN" || true
docker compose restart mailserver
sleep 10

echo "[7/7] Runtime status"
docker compose ps
echo
echo "Webmail: https://$MAIL_HOSTNAME"
echo "IMAPS: $MAIL_HOSTNAME:993"
echo "SMTP submission: $MAIL_HOSTNAME:587"
echo "Certificate: letsencrypt/$MAIL_HOSTNAME"
