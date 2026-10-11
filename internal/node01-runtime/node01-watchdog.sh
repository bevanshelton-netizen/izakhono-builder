#!/usr/bin/env bash
set -euo pipefail

STATE_DIR="${NODE01_STATE_DIR:-/var/lib/izakhono-node01}"
LOG="${STATE_DIR}/watchdog.log"
mkdir -p "$STATE_DIR"

check() {
  local name="$1" url="$2"
  if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
    printf '%s healthy %s\n' "$(date -Is)" "$name" >> "$LOG"
    return 0
  fi
  printf '%s unhealthy %s\n' "$(date -Is)" "$name" >> "$LOG"
  return 1
}

check node01 http://127.0.0.1:8090/health || exit 10
check super-seo http://127.0.0.1:8097/health || {
  echo "$(date -Is) attempting SUPER SEO restart" >> "$LOG"
  docker restart izakhono-super-seo >/dev/null 2>&1 || true
  sleep 5
  check super-seo http://127.0.0.1:8097/health || exit 20
}

printf '%s watchdog-pass\n' "$(date -Is)" >> "$LOG"
