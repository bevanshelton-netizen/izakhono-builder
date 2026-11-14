#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing mail-node .env. Copy .env.example to .env and set the private bind IP and public static IP." >&2
  exit 10
fi

set -a
. ./.env
set +a

: "${STALWART_RECOVERY_ADMIN:?Missing STALWART_RECOVERY_ADMIN}"
: "${STALWART_PUBLIC_URL:?Missing STALWART_PUBLIC_URL}"
: "${MAIL_NODE_BIND_IP:?Missing MAIL_NODE_BIND_IP}"
: "${MAIL_PUBLIC_IP:?Missing MAIL_PUBLIC_IP}"
: "${MAIL_HOST:?Missing MAIL_HOST}"

if [[ "$MAIL_NODE_BIND_IP" == "0.0.0.0" || "$MAIL_NODE_BIND_IP" == "$MAIL_PUBLIC_IP" ]]; then
  echo "Bind the Stalwart HTTP management listener to loopback or a private VPN IP, never the public IP." >&2
  exit 11
fi

if ! docker network inspect izakhono-mail >/dev/null 2>&1; then
  docker network create izakhono-mail >/dev/null
fi

docker compose --env-file .env -f docker-compose.mail.yml config >/dev/null
docker compose --env-file .env -f docker-compose.mail.yml up -d
CID="$(docker compose --env-file .env -f docker-compose.mail.yml ps -q stalwart)"
if [[ -z "$CID" ]]; then
  echo "Stalwart container was not created." >&2
  exit 12
fi

for attempt in $(seq 1 30); do
  HEALTH="$(docker inspect -f '{{.State.Health.Status}}' "$CID" 2>/dev/null || true)"
  if [[ "$HEALTH" == "healthy" ]]; then
    echo "Stalwart container is healthy."
    break
  fi
  if [[ "$attempt" -eq 30 ]]; then
    echo "Stalwart did not become healthy. Inspect docker compose logs." >&2
    docker compose --env-file .env -f docker-compose.mail.yml logs --tail=100 stalwart || true
    exit 13
  fi
  sleep 3
done

echo "MAIL NODE ACTIVATION: CONTAINER HEALTHY"
echo "Public DNS, inbound/outbound delivery, TLS, DKIM and restore acceptance remain separate gates."
