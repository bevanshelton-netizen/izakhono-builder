#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source .env
: "${MAIL_HOSTNAME:?MAIL_HOSTNAME missing}"

# docker-mailserver reads the certificate from ./letsencrypt.
# Caddy owns TCP 80/443, so briefly stop it for Certbot HTTP-01 renewal.
docker compose stop caddy >/dev/null 2>&1 || true
docker rm -f izakhono-mail-certbot >/dev/null 2>&1 || true
docker run --name izakhono-mail-certbot --rm \
  -p 80:80 \
  -v "$(pwd)/letsencrypt:/etc/letsencrypt" \
  -v "$(pwd)/certbot-logs:/var/log/letsencrypt" \
  certbot/certbot:latest renew --non-interactive

docker compose up -d caddy
docker compose restart mailserver

echo "Certificate renewal check complete for $MAIL_HOSTNAME"
