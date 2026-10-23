#!/usr/bin/env bash
set -euo pipefail

# IZAKHONO NODE01 physical activation gate.
# This script proves only host prerequisites; it never declares production LIVE.

fail=0
pass() { printf 'PASS  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1" >&2; fail=$((fail+1)); }
warn() { printf 'WARN  %s\n' "$1"; }

if [[ "$(id -u)" -ne 0 ]]; then
  fail "run as root"
else
  pass "running as root"
fi

if [[ -r /etc/os-release ]]; then
  . /etc/os-release
  if [[ "${ID:-}" == "ubuntu" && "${VERSION_ID:-}" == "24.04" ]]; then
    pass "Ubuntu 24.04 LTS detected"
  else
    warn "OS is ${PRETTY_NAME:-unknown}; Ubuntu 24.04 LTS or equivalent is recommended"
  fi
else
  fail "/etc/os-release unavailable"
fi

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    pass "Docker daemon reachable"
  else
    fail "Docker installed but daemon is not reachable"
  fi
else
  fail "Docker Engine not installed"
fi

if docker compose version >/dev/null 2>&1; then
  pass "Docker Compose available"
else
  fail "Docker Compose plugin unavailable"
fi

root_avail_kb="$(df -Pk / | awk 'NR==2 {print $4}')"
if [[ "${root_avail_kb:-0}" -ge 41943040 ]]; then
  pass "at least 40 GiB free on root filesystem"
else
  fail "less than 40 GiB free on root filesystem"
fi

if ip -4 addr show scope global | grep -q 'inet '; then
  pass "public/global IPv4 address is configured"
else
  fail "no global IPv4 address detected"
fi

if ip -6 addr show scope global | grep -q 'inet6 '; then
  pass "global IPv6 address is configured"
else
  warn "no global IPv6 detected; IPv6 is preferred but not mandatory for initial activation"
fi

for port in 22 80 443; do
  if ss -ltn "sport = :$port" | tail -n +2 | grep -q .; then
    warn "TCP $port is already occupied locally; verify ownership before runtime deployment"
  else
    pass "TCP $port is free locally"
  fi
done

if command -v curl >/dev/null 2>&1; then
  if curl -4fsS --max-time 8 https://api.ipify.org >/tmp/izakhono-public-ip 2>/dev/null; then
    pass "outbound internet and public IPv4 discovery available ($(cat /tmp/izakhono-public-ip))"
  else
    fail "cannot determine public IPv4 through outbound HTTPS"
  fi
else
  warn "curl unavailable; skipping public-IP discovery"
fi

printf '\nIZAKHONO_NODE01_PREFLIGHT=%s\n' "$([[ "$fail" -eq 0 ]] && echo PASS || echo FAIL)"
printf 'NOTE=This is a host prerequisite gate only. Do not claim LIVE until service, DNS, TLS, backup/restore and external acceptance tests pass.\n'

exit "$fail"
