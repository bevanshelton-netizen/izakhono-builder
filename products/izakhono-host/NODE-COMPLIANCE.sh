#!/usr/bin/env bash
set -Eeuo pipefail

# IZAKHONO NODE01 Compliance Gate
# This is a read-only acceptance check. It never exposes secrets and never
# mutates host state. A node is COMPLIANT only when every required gate passes.

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

fail=0
pass_count=0
fail_count=0
warn_count=0

pass() { printf 'PASS  %s\n' "$1"; pass_count=$((pass_count+1)); }
fail() { printf 'FAIL  %s\n' "$1"; fail_count=$((fail_count+1)); fail=1; }
warn() { printf 'WARN  %s\n' "$1"; warn_count=$((warn_count+1)); }

check_cmd() {
  local label="$1" cmd="$2"
  if command -v "$cmd" >/dev/null 2>&1; then pass "$label"; else fail "$label"; fi
}

check_port_owned_or_free() {
  local label="$1" proto="$2" port="$3" mapping="$4"
  if ! ss -l"$proto" "sport = :$port" 2>/dev/null | grep -q LISTEN; then
    pass "$label (free)"
  elif docker ps --format '{{.Ports}}' | grep -q "$mapping"; then
    pass "$label (Docker-owned)"
  else
    fail "$label (occupied by non-Docker process)"
  fi
}

printf '\nIZAKHONO NODE01 COMPLIANCE GATE\n'
printf 'Node: %s\n' "$(hostname 2>/dev/null || echo unknown)"
printf 'UTC:  %s\n\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

check_cmd 'Docker installed' docker
check_cmd 'Docker Compose available' docker
check_cmd 'ss networking utility available' ss
check_cmd 'curl available' curl
check_cmd 'Python available' python3

if docker info >/dev/null 2>&1; then pass 'Docker daemon reachable'; else fail 'Docker daemon reachable'; fi
if docker compose version >/dev/null 2>&1; then pass 'Docker Compose operational'; else fail 'Docker Compose operational'; fi

if [[ -f docker-compose.owned.yml ]]; then pass 'Owned compose definition present'; else fail 'Owned compose definition present'; fi
if [[ -f .env ]]; then
  pass '.env present'
  if grep -q '^HOST_RUNTIME_TOKEN=' .env && ! grep -q 'replace-with' .env; then pass 'Runtime secret configured'; else fail 'Runtime secret configured'; fi
  if grep -q '^TLS_EMAIL=' .env && ! grep -q 'ops@example.com' .env; then pass 'TLS email configured'; else fail 'TLS email configured'; fi
else
  fail '.env present for activation'
fi

check_port_owned_or_free 'HTTP :80' t 80 '0.0.0.0:80->'
check_port_owned_or_free 'HTTPS :443' t 443 '0.0.0.0:443->'

if ! ss -lun 'sport = :53' 2>/dev/null | grep -q '\*:53'; then
  pass 'DNS UDP :53 (free)'
elif docker ps --format '{{.Ports}}' | grep -q '53->53/udp'; then
  pass 'DNS UDP :53 (Docker-owned)'
else
  fail 'DNS UDP :53 (non-Docker listener)'
fi

if ! ss -ltn 'sport = :53' 2>/dev/null | grep -q LISTEN; then
  pass 'DNS TCP :53 (free)'
elif docker ps --format '{{.Ports}}' | grep -q '53->53/tcp'; then
  pass 'DNS TCP :53 (Docker-owned)'
else
  fail 'DNS TCP :53 (non-Docker listener)'
fi

if ip -4 route show default >/dev/null 2>&1; then pass 'IPv4 default route'; else fail 'IPv4 default route'; fi
if ip -6 addr show scope global | grep -q 'inet6'; then pass 'Global IPv6 address'; else warn 'Global IPv6 address not present'; fi
if getent hosts github.com >/dev/null 2>&1; then pass 'Outbound DNS resolution'; else fail 'Outbound DNS resolution'; fi
if curl -fsS --max-time 10 https://github.com/ >/dev/null; then pass 'Outbound HTTPS'; else fail 'Outbound HTTPS'; fi

if [[ -w /var/lib && -w /opt ]]; then pass 'Persistent host storage writable'; else fail 'Persistent host storage writable'; fi
if [[ "$(id -u)" == '0' ]]; then pass 'Activation privilege available'; else warn 'Not running as root; activation may require sudo'; fi

if docker compose --env-file .env -f docker-compose.owned.yml config >/dev/null 2>&1; then
  pass 'Owned compose configuration valid'
else
  fail 'Owned compose configuration valid'
fi

if docker ps --format '{{.Names}}' | grep -q '^izakhono-host-runtime'; then
  if curl -fsS --max-time 5 http://127.0.0.1:8080/health >/dev/null; then pass 'Owned runtime health'; else fail 'Owned runtime health'; fi
else
  warn 'Owned runtime not running yet'
fi

printf '\nRESULTS: PASS=%d FAIL=%d WARN=%d\n' "$pass_count" "$fail_count" "$warn_count"

if (( fail > 0 )); then
  echo 'NODE01 COMPLIANCE: FAILED'
  exit 1
fi

echo 'NODE01 COMPLIANCE: PASSED'
