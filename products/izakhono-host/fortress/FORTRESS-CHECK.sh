#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0
check(){
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then printf 'PASS  %s\n' "$label"; else printf 'FAIL  %s\n' "$label"; fail=1; fi
}

printf '\nIZAKHONO FORTRESS — HOST SECURITY PREFLIGHT\n\n'

check 'Docker available' docker version
check 'Docker Compose available' docker compose version
check 'Firewall tooling available' bash -lc 'command -v ss >/dev/null || command -v nft >/dev/null || command -v ufw >/dev/null'
check 'SSH service not exposed through compose by default' bash -lc '! grep -RqsE '"'"'^[[:space:]]*-[[:space:]]*"?22:22'"'"' docker-compose.owned.yml'
check 'Runtime binds only to internal compose network' bash -lc '! grep -nE '"'"'^[[:space:]]*-[[:space:]]*"?8080:8080'"'"' docker-compose.owned.yml >/dev/null'
check 'DNS TCP/UDP 53 declared' bash -lc 'grep -q '"'"'"53:53/udp"'"'"' docker-compose.owned.yml && grep -q '"'"'"53:53/tcp"'"'"' docker-compose.owned.yml'
check 'HTTP/HTTPS edge declared' bash -lc 'grep -q '"'"'"80:80"'"'"' docker-compose.owned.yml && grep -q '"'"'"443:443"'"'"' docker-compose.owned.yml'
check 'No committed .env file' bash -lc '! test -f .env'
check 'Environment template exists' test -f .env.example
check 'Runtime token is required by compose' bash -lc 'grep -q '"'"'HOST_RUNTIME_TOKEN:?set HOST_RUNTIME_TOKEN'"'"' docker-compose.owned.yml
check 'TLS email is required by compose' bash -lc 'grep -q '"'"'TLS_EMAIL:?set TLS_EMAIL'"'"' docker-compose.owned.yml

printf '\n'
if (( fail )); then
  printf 'FORTRESS PREFLIGHT: BLOCKED — resolve failed controls before public exposure.\n'
  exit 1
fi
printf 'FORTRESS PREFLIGHT: PASS — baseline controls satisfied.\n'
