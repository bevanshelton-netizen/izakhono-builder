#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

command -v docker >/dev/null || { echo '[NAV] ERROR: docker is required'; exit 1; }
command -v curl >/dev/null || { echo '[NAV] ERROR: curl is required'; exit 1; }
docker compose version >/dev/null || { echo '[NAV] ERROR: Docker Compose v2 is required'; exit 1; }

for file in \
  products/izakhono-nav/engine/Dockerfile \
  products/izakhono-nav/engine/server.js \
  products/izakhono-nav/stack/compose.yaml \
  products/izakhono-nav/stack/scripts/activate.sh \
  products/izakhono-nav/stack/scripts/verify.sh \
  infra/contabo/nav-compose.yml \
  infra/contabo/nav-Caddyfile \
  infra/contabo/production-verify-nav.js
do
  test -f "$file" || { echo "[NAV] ERROR: missing $file"; exit 1; }
done

docker compose -f infra/contabo/nav-compose.yml config --quiet
./products/izakhono-nav/stack/scripts/preflight.sh

echo '[NAV] owned-stack and public-edge preflight passed.'
