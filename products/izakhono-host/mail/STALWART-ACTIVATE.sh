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
: "${STALWART_RECOVERY_ADMIN:?Missing STALWART_RECOVERY_ADMIN}"
: "${SMTP_USER:?Missing dedicated Stalwart submission identity}"
: "${SMTP_PASS:?Missing dedicated Stalwart submission password}"

export SMTP_HOST="${SMTP_HOST:-stalwart}"
export SMTP_PORT="${SMTP_PORT:-465}"
export SMTP_TLS_MODE="${SMTP_TLS_MODE:-tls}"

if [[ "$SMTP_HOST" != "stalwart" ]]; then
  echo "SMTP_HOST must resolve to the Stalwart service on the private izakhono-mail network." >&2
  exit 11
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
cd "$ROOT"
docker compose -f docker-compose.mail.yml config >/dev/null
docker compose -f docker-compose.mail.yml up -d
docker compose -f docker-compose.mail.yml ps

echo "[4/4] Confirm HOST bridge health"
cd "$HOST_ROOT"
docker compose --env-file .env -f docker-compose.owned.yml ps mail-bridge

echo
echo "MAIL SERVICE ACTIVATION: CONTAINERS STARTED"
echo "This is not public LIVE certification."
echo "Next gate: public DNS + TLS + authenticated inbound/outbound + IMAP + SPF/DKIM/DMARC acceptance."
