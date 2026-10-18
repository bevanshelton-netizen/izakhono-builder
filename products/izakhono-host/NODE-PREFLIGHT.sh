#!/usr/bin/env bash
set -Eeuo pipefail

fail=0
check() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then
    printf 'PASS  %s\n' "$label"
  else
    printf 'FAIL  %s\n' "$label"
    fail=1
  fi
}

printf '\nIZAKHONO NODE PREFLIGHT\n\n'

check 'Docker installed' command -v docker
check 'Docker Compose available' docker compose version
check 'Port 80 free/owned by Docker' bash -c '! ss -lnt "sport = :80" | grep -q LISTEN || docker ps --format "{{.Ports}}" | grep -q "0.0.0.0:80->"'
check 'Port 443 free/owned by Docker' bash -c '! ss -lnt "sport = :443" | grep -q LISTEN || docker ps --format "{{.Ports}}" | grep -q "0.0.0.0:443->"'
check 'Port 53 UDP available' bash -c '! ss -lun "sport = :53" | grep -q "\*:53" || docker ps --format "{{.Ports}}" | grep -q "53->53/udp"'
check 'Port 53 TCP available' bash -c '! ss -ltn "sport = :53" | grep -q LISTEN || docker ps --format "{{.Ports}}" | grep -q "53->53/tcp"'
check 'IPv4 default route' ip -4 route show default
check 'IPv6 capability' ip -6 addr show
check 'Persistent storage' bash -c 'test -w /var/lib && test -w /opt'

if [[ -f .env ]]; then
  check 'Runtime token configured' bash -c 'grep -q "^HOST_RUNTIME_TOKEN=" .env && ! grep -q "replace-with" .env'
  check 'TLS email configured' bash -c 'grep -q "^TLS_EMAIL=" .env && ! grep -q "ops@example.com" .env'
else
  printf 'WARN  .env not present — bootstrap-owned.sh will create it.\n'
fi

printf '\n'
if (( fail )); then
  echo 'NODE PREFLIGHT: NOT READY'
  exit 1
fi

echo 'NODE PREFLIGHT: READY'
