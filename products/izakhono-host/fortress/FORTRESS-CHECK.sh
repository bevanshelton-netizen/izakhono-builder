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
check 'Firewall/socket tooling available' bash -lc 'command -v ss >/dev/null || command -v nft >/dev/null || command -v ufw >/dev/null'
check 'SSH port is not published by compose' bash -lc '! grep -Fq '"'"'22:22'"'"' docker-compose.owned.yml'
check 'Runtime port is not published by compose' bash -lc '! grep -Fq '"'"'8080:8080'"'"' docker-compose.owned.yml'
check 'DNS TCP/UDP 53 declared' bash -lc 'grep -Fq '"'"'53:53/udp'"'"' docker-compose.owned.yml && grep -Fq '"'"'53:53/tcp'"'"' docker-compose.owned.yml'
check 'HTTP/HTTPS edge declared' bash -lc 'grep -Fq '"'"'80:80'"'"' docker-compose.owned.yml && grep -Fq '"'"'443:443'"'"' docker-compose.owned.yml'
check 'No committed .env file' bash -lc '! test -f .env'
check 'Environment template exists' test -f .env.example
check 'Runtime token is required by compose' bash -lc 'grep -Fq '"'"'HOST_RUNTIME_TOKEN:?set HOST_RUNTIME_TOKEN'"'"' docker-compose.owned.yml
check 'TLS email is required by compose' bash -lc 'grep -Fq '"'"'TLS_EMAIL:?set TLS_EMAIL'"'"' docker-compose.owned.yml

printf '\n'
if (( fail )); then
  printf 'FORTRESS PREFLIGHT: BLOCKED — resolve failed controls before public exposure.\n'
  exit 1
fi
printf 'FORTRESS PREFLIGHT: PASS — baseline controls satisfied.\n'
