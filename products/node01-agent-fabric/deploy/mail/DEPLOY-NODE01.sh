#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo 'ERROR: create .env from .env.example and provide production values.' >&2
  exit 2
fi

set -a
source .env
set +a

: "${MAIL_DOMAIN:?MAIL_DOMAIN is required}"
: "${MAIL_HOSTNAME:?MAIL_HOSTNAME is required}"
: "${ADMIN_MAILBOX:?ADMIN_MAILBOX is required}"

mkdir -p data/mail data/state data/config data/ssl data/log
chmod 700 data data/config data/ssl

echo 'Starting NODE01 mail runtime...'
docker compose pull
docker compose up -d

echo 'Waiting for the mail runtime health gate...'
for _ in {1..40}; do
  if docker inspect --format '{{.State.Health.Status}}' node01-mailserver 2>/dev/null | grep -qx healthy; then
    break
  fi
  sleep 5
done

status="$(docker inspect --format '{{.State.Health.Status}}' node01-mailserver 2>/dev/null || true)"
if [[ "$status" != healthy ]]; then
  docker compose ps
  docker compose logs --tail=120 mailserver || true
  echo 'ERROR: NODE01 mail runtime did not reach healthy state.' >&2
  exit 3
fi

echo 'Runtime healthy. Next required steps are mailbox creation, DNS publication, and external acceptance testing.'
echo 'No LIVE claim is made by this script.'