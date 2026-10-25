#!/usr/bin/env bash
set -euo pipefail

fail=0
check_cmd() {
  if command -v "$1" >/dev/null 2>&1; then
    echo "[PASS] $1"
  else
    echo "[FAIL] missing command: $1"
    fail=1
  fi
}

check_cmd docker
check_cmd git
check_cmd curl

if docker compose version >/dev/null 2>&1; then
  echo "[PASS] docker compose"
else
  echo "[FAIL] docker compose"
  fail=1
fi

if systemctl is-active --quiet docker; then
  echo "[PASS] docker service active"
else
  echo "[FAIL] docker service inactive"
  fail=1
fi

if [[ -f deploy/.env ]]; then
  chmod 0600 deploy/.env
  echo "[PASS] protected environment file exists"
else
  echo "[FAIL] deploy/.env missing"
  fail=1
fi

if docker compose -f deploy/docker-compose.owned.yml config >/dev/null 2>&1; then
  echo "[PASS] owned compose configuration"
else
  echo "[FAIL] owned compose configuration"
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  echo "I-CONNECT owned-host preflight FAILED."
  exit 1
fi

echo "I-CONNECT owned-host preflight PASSED."
