#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
docker compose --env-file "$HERE/.env" -f "$HERE/compose.yaml" down
