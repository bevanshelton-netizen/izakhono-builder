#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

printf '[NAV] preflight: checking required commands...\n'
command -v docker >/dev/null || { echo '[NAV] ERROR: docker is required'; exit 1; }
command -v curl >/dev/null || { echo '[NAV] ERROR: curl is required'; exit 1; }

docker compose version >/dev/null || { echo '[NAV] ERROR: docker compose is required'; exit 1; }

printf '[NAV] preflight: checking deployment files...\n'
for file in \
  infra/contabo/nav-compose.yml \
  infra/contabo/nav-Caddyfile \
  infra/contabo/deploy-nav.sh \
  infra/contabo/verify-nav.sh \
  apps/izakhono-nav/Dockerfile \
  apps/izakhono-nav/server.js \
  apps/izakhono-nav/manifest.webmanifest \
  apps/izakhono-nav/sw.js
 do
  test -f "$file" || { echo "[NAV] ERROR: missing $file"; exit 1; }
done

printf '[NAV] preflight: validating compose configuration...\n'
docker compose -f infra/contabo/nav-compose.yml config >/dev/null

printf '[NAV] preflight: checking AI configuration state...\n'
if [[ -n "${IZAKHONO_AI_CHAT_ENDPOINT:-}" && -n "${IZAKHONO_AI_API_KEY:-}" ]]; then
  printf '[NAV] AI provider credentials are present in environment.\n'
else
  printf '[NAV] AI provider credentials are not configured; runtime will remain safely unavailable for live AI.\n'
fi

printf '[NAV] preflight passed.\n'
