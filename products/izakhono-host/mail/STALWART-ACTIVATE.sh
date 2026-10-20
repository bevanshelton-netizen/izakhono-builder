#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
: "${STALWART_RECOVERY_ADMIN:?Set STALWART_RECOVERY_ADMIN in the protected environment}"

export STALWART_RECOVERY_ADMIN
docker compose -f docker-compose.mail.yml config >/dev/null
docker compose -f docker-compose.mail.yml up -d
docker compose -f docker-compose.mail.yml ps

echo 'MAIL SERVICE ACTIVATION: STARTED'
echo 'Next acceptance gate: public DNS + TLS + authenticated mailbox send/receive.'
