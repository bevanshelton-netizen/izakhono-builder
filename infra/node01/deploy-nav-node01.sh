#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

export NODE_NAME="${NODE_NAME:-NODE01}"
export NAV_DOMAIN="${NAV_DOMAIN:-nav.izakhono.africa}"
export NAV_RUNTIME_ID="${NAV_RUNTIME_ID:-NODE01}"
export NAV_RELEASE_ID="${NAV_RELEASE_ID:-IZAKHONO-NAV-$(git rev-parse --short HEAD)}"

printf '[NAV][%s] release=%s domain=%s\n' "$NODE_NAME" "$NAV_RELEASE_ID" "$NAV_DOMAIN"
printf '[NAV][%s] validating owned stack and edge...\n' "$NODE_NAME"
./infra/contabo/preflight-nav.sh

printf '[NAV][%s] activating owned routing, search, tiles and web gateway...\n' "$NODE_NAME"
./products/izakhono-nav/stack/scripts/activate.sh

printf '[NAV][%s] starting public TLS edge...\n' "$NODE_NAME"
docker compose -f infra/contabo/nav-compose.yml up -d --remove-orphans

printf '[NAV][%s] verifying local owned services...\n' "$NODE_NAME"
NAV_ENGINE_VERIFY_URL=http://127.0.0.1:8788 NAV_WEB_VERIFY_URL=http://127.0.0.1:8787 \
  ./products/izakhono-nav/stack/scripts/verify.sh

printf '[NAV][%s] verifying public HTTPS...\n' "$NODE_NAME"
for attempt in $(seq 1 20); do
  if curl -fsS --max-time 8 "https://$NAV_DOMAIN/health" >/dev/null; then break; fi
  if [[ "$attempt" -eq 20 ]]; then echo '[NAV] public HTTPS did not become ready' >&2; exit 1; fi
  sleep 3
done
node infra/contabo/production-verify-nav.js "https://$NAV_DOMAIN"

printf '[NAV][%s] owned NAV stack and public edge passed deployment checks.\n' "$NODE_NAME"
