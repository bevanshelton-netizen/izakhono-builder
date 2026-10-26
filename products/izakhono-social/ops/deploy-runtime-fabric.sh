#!/usr/bin/env bash
set -euo pipefail

# CONNECTA portable Runtime Fabric deployment entrypoint.
# This script deploys to an operator-supplied host; it never assumes NODE01 exists.
# Required: an immutable 40-character Git SHA and CONNECTA secrets in the environment.

REF="${CONNECTA_RELEASE_SHA:-}"
APP_ROOT="${CONNECTA_APP_ROOT:-/opt/izakhono/connecta}"
COMPOSE_FILE="${CONNECTA_COMPOSE_FILE:-products/izakhono-social/docker-compose.owned.yml}"
REPO_URL="${CONNECTA_REPO_URL:-https://github.com/bevanshelton-netizen/izakhono-builder.git}"

[[ "$REF" =~ ^[0-9a-f]{40}$ ]] || { echo "CONNECTA_RELEASE_SHA must be an immutable 40-character Git SHA" >&2; exit 2; }
[[ -n "${CONNECTA_DB_PASSWORD:-}" ]] || { echo "CONNECTA_DB_PASSWORD is required" >&2; exit 2; }
[[ -n "${CONNECTA_OWNER_KEY:-}" ]] || { echo "CONNECTA_OWNER_KEY is required" >&2; exit 2; }

command -v git >/dev/null || { echo "git is required" >&2; exit 2; }
command -v docker >/dev/null || { echo "docker is required" >&2; exit 2; }
docker compose version >/dev/null || { echo "docker compose is required" >&2; exit 2; }

mkdir -p "$APP_ROOT"
if [[ ! -d "$APP_ROOT/.git" ]]; then
  git clone "$REPO_URL" "$APP_ROOT"
fi

git -C "$APP_ROOT" fetch --depth=1 origin "$REF"
git -C "$APP_ROOT" checkout --detach "$REF"
[[ "$(git -C "$APP_ROOT" rev-parse HEAD)" == "$REF" ]] || { echo "Immutable SHA verification failed" >&2; exit 3; }

export CONNECTA_DB_PASSWORD CONNECTA_OWNER_KEY
export CONNECTA_PORT="${CONNECTA_PORT:-3080}"

cd "$APP_ROOT"
docker compose -f "$COMPOSE_FILE" config >/dev/null
docker compose -f "$COMPOSE_FILE" up -d --build

for i in {1..60}; do
  if curl -fsS "http://127.0.0.1:${CONNECTA_PORT}/health" >/tmp/connecta-health.json 2>/dev/null; then
    python3 - <<'PY'
import json
with open('/tmp/connecta-health.json', encoding='utf-8') as f:
    data=json.load(f)
if data.get('ok') is not True:
    raise SystemExit('CONNECTA health endpoint did not report ok=true')
print('CONNECTA local health: PASS')
PY
    echo "CONNECTA runtime deployment rehearsal: PASS"
    exit 0
  fi
  sleep 2
done

echo "CONNECTA local health verification failed" >&2
exit 4
