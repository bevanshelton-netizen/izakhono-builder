#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

export NODE_NAME="${NODE_NAME:-NODE01}"
export NAV_DOMAIN="${NAV_DOMAIN:-nav.izakhono.africa}"
export IZAKHONO_RELEASE="${IZAKHONO_RELEASE:-nav-$(git rev-parse --short HEAD)}"

printf '[NAV][%s] release=%s domain=%s\n' "$NODE_NAME" "$IZAKHONO_RELEASE" "$NAV_DOMAIN"
printf '[NAV][%s] preflight...\n' "$NODE_NAME"
./infra/contabo/preflight-nav.sh

printf '[NAV][%s] building owned runtime...\n' "$NODE_NAME"
docker compose -f infra/contabo/nav-compose.yml build nav

printf '[NAV][%s] starting NAV + owned TLS edge...\n' "$NODE_NAME"
docker compose -f infra/contabo/nav-compose.yml up -d

printf '[NAV][%s] local health...\n' "$NODE_NAME"
curl -fsS http://127.0.0.1:8080/health
printf '\n[NAV][%s] local readiness...\n' "$NODE_NAME"
curl -fsS http://127.0.0.1:8080/ready

printf '\n[NAV][%s] local smoke test...\n' "$NODE_NAME"
NAV_URL=http://127.0.0.1:8080 ./infra/contabo/nav-smoke-test.sh

printf '\n[NAV][%s] deployment complete. Public TLS domain: %s\n' "$NODE_NAME" "$NAV_DOMAIN"
