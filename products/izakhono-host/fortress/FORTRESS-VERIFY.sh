#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
failed=0
pass(){ printf 'PASS  %s\n' "$1"; }
fail(){ printf 'FAIL  %s\n' "$1"; failed=1; }
printf '\nIZAKHONO FORTRESS — SECURITY RELEASE GATE\n\n'
command -v docker >/dev/null 2>&1 && pass 'Docker available' || fail 'Docker available'
docker compose version >/dev/null 2>&1 && pass 'Docker Compose available' || fail 'Docker Compose available'
command -v ss >/dev/null 2>&1 || command -v nft >/dev/null 2>&1 || command -v ufw >/dev/null 2>&1 && pass 'Socket/firewall tooling available' || fail 'Socket/firewall tooling available'
if grep -Fq '22:22' docker-compose.owned.yml; then fail 'SSH port is not published by compose'; else pass 'SSH port is not published by compose'; fi
if grep -Fq '8080:8080' docker-compose.owned.yml; then fail 'Runtime port is not published by compose'; else pass 'Runtime port is not published by compose'; fi
grep -Fq '53:53/udp' docker-compose.owned.yml && grep -Fq '53:53/tcp' docker-compose.owned.yml && pass 'DNS TCP/UDP 53 declared' || fail 'DNS TCP/UDP 53 declared'
grep -Fq '80:80' docker-compose.owned.yml && grep -Fq '443:443' docker-compose.owned.yml && pass 'HTTP/HTTPS edge declared' || fail 'HTTP/HTTPS edge declared'
test ! -f .env && pass 'No committed .env file' || fail 'No committed .env file'
test -f .env.example && pass 'Environment template exists' || fail 'Environment template exists'
grep -Fq 'HOST_RUNTIME_TOKEN:?set HOST_RUNTIME_TOKEN' docker-compose.owned.yml && pass 'Runtime token required' || fail 'Runtime token required'
grep -Fq 'TLS_EMAIL:?set TLS_EMAIL' docker-compose.owned.yml && pass 'TLS email required' || fail 'TLS email required'
printf '\n'
if [ "$failed" -ne 0 ]; then printf 'FORTRESS RELEASE GATE: BLOCKED\n'; exit 1; fi
printf 'FORTRESS RELEASE GATE: PASS\n'
