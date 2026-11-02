#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

export IZAKHONO_RELEASE="${IZAKHONO_RELEASE:-nav-$(git rev-parse --short HEAD)}"
export NAV_DOMAIN="${NAV_DOMAIN:-nav.izakhono.africa}"

printf '[NAV] release=%s domain=%s\n' "$IZAKHONO_RELEASE" "$NAV_DOMAIN"
printf '[NAV] running preflight...\n'
./infra/contabo/preflight-nav.sh
printf '[NAV] building owned runtime...\n'
docker compose -f infra/contabo/nav-compose.yml build nav
printf '[NAV] starting owned runtime + TLS edge...\n'
docker compose -f infra/contabo/nav-compose.yml up -d
printf '[NAV] checking local health...\n'
curl -fsS http://127.0.0.1:8080/health
printf '\n[NAV] checking local readiness...\n'
curl -fsS http://127.0.0.1:8080/ready
printf '\n[NAV] running local smoke test...\n'
NAV_URL=http://127.0.0.1:8080 ./infra/contabo/nav-smoke-test.sh
printf '\n[NAV] owned runtime is running. Public TLS is handled by Caddy for %s.\n' "$NAV_DOMAIN"
