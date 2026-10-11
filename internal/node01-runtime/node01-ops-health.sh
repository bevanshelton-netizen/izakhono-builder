#!/usr/bin/env bash
set -euo pipefail

CONTROL_URL="${NODE01_CONTROL_URL:-http://127.0.0.1:8090}"
SEO_URL="${SUPER_SEO_URL:-http://127.0.0.1:8097}"
MIN_FREE_GB="${NODE01_MIN_FREE_GB:-20}"
BACKUP_ROOT="${NODE01_BACKUP_ROOT:-/var/backups/izakhono-node01}"

fail=0
check_url() {
  local name="$1" url="$2"
  if curl -fsS --max-time 5 "$url" >/dev/null; then
    echo "[PASS] $name health"
  else
    echo "[FAIL] $name health"
    fail=1
  fi
}

check_url "NODE01 control" "$CONTROL_URL/health"

if curl -fsS --max-time 5 "$SEO_URL/health" >/dev/null; then
  echo "[PASS] SUPER SEO health"
else
  echo "[WARN] SUPER SEO is not currently healthy; workload promotion must remain blocked."
fi

if command -v docker >/dev/null 2>&1; then
  docker info >/dev/null 2>&1 && echo "[PASS] Docker engine" || { echo "[FAIL] Docker engine"; fail=1; }
  docker ps --format '{{.Names}} {{.Status}}' | sed 's/^/[INFO] /'
else
  echo "[FAIL] Docker is unavailable"
  fail=1
fi

free_gb="$(df -Pk / | awk 'NR==2 {printf "%d", $4/1024/1024}')"
if [ "$free_gb" -ge "$MIN_FREE_GB" ]; then
  echo "[PASS] Root filesystem free space: ${free_gb}GB"
else
  echo "[FAIL] Root filesystem free space: ${free_gb}GB < ${MIN_FREE_GB}GB"
  fail=1
fi

if [ -d "$BACKUP_ROOT" ]; then
  latest="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2- || true)"
  if [ -n "$latest" ] && [ -f "$latest/SHA256SUMS" ]; then
    echo "[PASS] Backup manifest present: $latest"
  else
    echo "[WARN] No verified backup manifest found"
  fi
else
  echo "[WARN] Backup root does not exist yet: $BACKUP_ROOT"
fi

if [ "$fail" -ne 0 ]; then
  exit 1
fi

echo "[PASS] NODE01 operational guard complete."
