#!/usr/bin/env bash
set -euo pipefail

fail=0
need_cmd(){ command -v "$1" >/dev/null 2>&1 || { echo "MISSING: $1"; fail=1; }; }
need_port(){ local p="$1"; if ! ss -lntup 2>/dev/null | grep -Eq ":${p}([[:space:]]|$)"; then echo "WARN: port $p not listening locally"; fi; }

need_cmd docker
need_cmd curl
need_cmd ss

if ! docker info >/dev/null 2>&1; then
  echo "BLOCKED: Docker daemon is not available"
  fail=1
fi

if docker compose version >/dev/null 2>&1; then
  echo "OK: Docker Compose"
else
  echo "MISSING: Docker Compose"
  fail=1
fi

for p in 22 53 80 443; do need_port "$p"; done

if [ -r /etc/os-release ]; then
  . /etc/os-release
  echo "OS: ${PRETTY_NAME:-unknown}"
fi

echo "NODE_PREFLIGHT_FAIL=$fail"
exit "$fail"
