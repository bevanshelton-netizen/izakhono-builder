#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
set -a; source "$HERE/.env"; set +a
docker compose --env-file "$HERE/.env" -f "$HERE/compose.yaml" ps
echo
curl -sS "http://127.0.0.1:${NAV_ENGINE_PORT:-8788}/api/health" || true
echo
