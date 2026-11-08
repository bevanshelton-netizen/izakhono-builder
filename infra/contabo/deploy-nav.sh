#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
# Single deployment path: the owned Valhalla + Nominatim + Martin stack,
# served through the NODE01 Caddy TLS edge.
exec ./infra/node01/deploy-nav-node01.sh
