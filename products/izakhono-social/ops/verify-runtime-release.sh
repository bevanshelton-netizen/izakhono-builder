#!/usr/bin/env bash
set -euo pipefail

# CONNECTA post-deployment verification and rollback gate.
# This runs on the supplied production host. It never performs public DNS/TLS cutover.
# A failed health gate triggers rollback to the supplied previous immutable SHA.

CURRENT_SHA="${CONNECTA_RELEASE_SHA:-}"
PREVIOUS_SHA="${CONNECTA_PREVIOUS_RELEASE_SHA:-}"
APP_ROOT="${CONNECTA_APP_ROOT:-/opt/izakhono/connecta}"
COMPOSE_FILE="${CONNECTA_COMPOSE_FILE:-products/izakhono-social/docker-compose.owned.yml}"
PORT="${CONNECTA_PORT:-3080}"

[[ "$CURRENT_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "CONNECTA_RELEASE_SHA must be an immutable 40-character SHA" >&2; exit 2; }
[[ "$PREVIOUS_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "CONNECTA_PREVIOUS_RELEASE_SHA must be an immutable 40-character SHA" >&2; exit 2; }
[[ "$CURRENT_SHA" != "$PREVIOUS_SHA" ]] || { echo "Current and previous releases must differ" >&2; exit 2; }

health_check() {
  curl -fsS "http://127.0.0.1:${PORT}/health" >/tmp/connecta-health.json
  python3 - <<'PY'
import json
with open('/tmp/connecta-health.json', encoding='utf-8') as f:
    data=json.load(f)
if data.get('ok') is not True:
    raise SystemExit('health ok=true was not returned')
PY
}

verify_runtime() {
  for i in {1..30}; do
    if health_check 2>/dev/null; then
      echo "CONNECTA release ${CURRENT_SHA}: HEALTH PASS"
      return 0
    fi
    sleep 2
  done
  return 1
}

if verify_runtime; then
  echo "CONNECTA deployment verification: PASS"
  exit 0
fi

echo "CONNECTA deployment verification: FAIL — beginning immutable rollback" >&2

git -C "$APP_ROOT" fetch --depth=1 origin "$PREVIOUS_SHA"
git -C "$APP_ROOT" checkout --detach "$PREVIOUS_SHA"
[[ "$(git -C "$APP_ROOT" rev-parse HEAD)" == "$PREVIOUS_SHA" ]] || {
  echo "Rollback SHA verification failed" >&2
  exit 5
}

docker compose -f "$APP_ROOT/$COMPOSE_FILE" up -d --build

if verify_runtime; then
  echo "CONNECTA rollback to ${PREVIOUS_SHA}: PASS"
  exit 10
fi

echo "CONNECTA rollback verification: FAIL — manual intervention required" >&2
exit 20
