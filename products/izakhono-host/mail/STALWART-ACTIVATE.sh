#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
HOST_ROOT="$(cd "$ROOT/.." && pwd)"
cd "$HOST_ROOT"

if [[ ! -f .env ]]; then
  echo "Missing HOST .env. Populate it from the approved FORTRESS/owner secret store first." >&2
  exit 10
fi

set -a
. ./.env
set +a

: "${HOST_RUNTIME_TOKEN:?Missing HOST_RUNTIME_TOKEN}"
: "${TLS_EMAIL:?Missing TLS_EMAIL}"
: "${POSTGRES_PASSWORD:?Missing POSTGRES_PASSWORD}"
: "${MINIO_ROOT_USER:?Missing MINIO_ROOT_USER}"
: "${MINIO_ROOT_PASSWORD:?Missing MINIO_ROOT_PASSWORD}"
: "${IZAKHONO_MAIL_API_TOKEN:?Missing IZAKHONO_MAIL_API_TOKEN}"
: "${SMTP_USER:?Missing dedicated Stalwart submission identity}"
: "${SMTP_PASS:?Missing dedicated Stalwart submission password}"
: "${STALWART_PUBLIC_URL:?Missing STALWART_PUBLIC_URL}"
: "${STALWART_API_KEY:?Missing STALWART_API_KEY}"
: "${CONTROL_PLANE_TOKEN:?Missing CONTROL_PLANE_TOKEN}"
: "${MAIL_HANDOVER_ENCRYPTION_KEY:?Missing MAIL_HANDOVER_ENCRYPTION_KEY}"
: "${MAIL_ALLOWED_DOMAINS:?Missing MAIL_ALLOWED_DOMAINS}"

MAIL_MODE="${MAIL_MODE:-local}"
export SMTP_HOST="${SMTP_HOST:-stalwart}"
export SMTP_PORT="${SMTP_PORT:-465}"
export SMTP_TLS_MODE="${SMTP_TLS_MODE:-tls}"

if [[ "$SMTP_HOST" == "localhost" || "$SMTP_HOST" == "127.0.0.1" || "$SMTP_HOST" == "0.0.0.0" ]]; then
  echo "SMTP_HOST must be the Stalwart service name or a private mail-node address, not loopback." >&2
  exit 11
fi
if [[ ! -s "$ROOT/secrets/roundcube_db_password" || ! -s "$ROOT/secrets/roundcube_des_key" ]]; then
  echo "Create mail/secrets/roundcube_db_password and mail/secrets/roundcube_des_key first." >&2
  exit 13
fi
if [[ "$SMTP_PORT" != "465" || "$SMTP_TLS_MODE" != "tls" ]]; then
  echo "Use Stalwart implicit TLS: SMTP_PORT=465 and SMTP_TLS_MODE=tls." >&2
  exit 12
fi

echo "[1/4] Validate owned HOST stack"
docker compose --env-file .env -f docker-compose.owned.yml config >/dev/null

echo "[2/4] Start/refresh owned HOST stack and private mail network"
docker compose --env-file .env -f docker-compose.owned.yml up -d

echo "[3/4] Validate and activate Stalwart mail plane"
if [[ "$MAIL_MODE" == "local" ]]; then
  : "${STALWART_RECOVERY_ADMIN:?Missing STALWART_RECOVERY_ADMIN for local mail mode}"
  cd "$ROOT"
  docker compose -f docker-compose.mail.yml config >/dev/null
  docker compose -f docker-compose.mail.yml up -d
  docker compose -f docker-compose.mail.yml ps
elif [[ "$MAIL_MODE" == "remote" ]]; then
  echo "Using dedicated remote mail node at $SMTP_HOST; local Stalwart stack will not be started."
else
  echo "MAIL_MODE must be local or remote." >&2
  exit 15
fi

echo "[4/4] Confirm HOST bridge health"
cd "$HOST_ROOT"
docker compose --env-file .env -f docker-compose.owned.yml ps mail-bridge mail-control-plane roundcube

for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8082/api/ready >/dev/null; then
    echo "Stalwart management API is ready."
    break
  fi
  if [[ "$attempt" -eq 30 ]]; then
    echo "Mail control plane did not become ready; inspect mail-control-plane and Stalwart logs." >&2
    exit 14
  fi
  sleep 3
done

echo
echo "MAIL SERVICE ACTIVATION: CONTAINERS STARTED"
echo "This is not public LIVE certification."
echo "Next gate: public DNS + TLS + authenticated inbound/outbound + IMAP + SPF/DKIM/DMARC acceptance."
