#!/usr/bin/env bash
set -euo pipefail

APP_NAME="the-chancellor"
REPO_URL="https://github.com/bevanshelton-netizen/the-chancellor.git"
BRANCH="main"
APP_ROOT="/opt/izakhono/apps/${APP_NAME}"
ENV_FILE="${APP_ROOT}/deploy/the-chancellor.env"
COMPOSE_FILE="${APP_ROOT}/deploy/izakhono-compose.yml"
HEALTH_URL="http://127.0.0.1:3000/api/health"
READY_URL="http://127.0.0.1:3000/api/go-live"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: required command '$1' not found" >&2
    exit 1
  }
}

require_cmd git
require_cmd docker
require_cmd curl

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: Docker Compose v2 is required." >&2
  exit 1
fi

sudo mkdir -p "$(dirname "$APP_ROOT")"
if [[ -d "${APP_ROOT}/.git" ]]; then
  echo "Updating existing THE CHANCELLOR checkout..."
  git -C "$APP_ROOT" fetch origin "$BRANCH"
  git -C "$APP_ROOT" checkout "$BRANCH"
  git -C "$APP_ROOT" reset --hard "origin/${BRANCH}"
else
  echo "Cloning THE CHANCELLOR..."
  sudo rm -rf "$APP_ROOT"
  sudo git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$APP_ROOT"
  sudo chown -R "$(id -u):$(id -g)" "$APP_ROOT"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "${APP_ROOT}/deploy/the-chancellor.env.example" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo
  echo "STOP: host-only secrets file created at:"
  echo "  $ENV_FILE"
  echo "Fill SESSION_SECRET, ADMIN credentials, APP_URL and required provider credentials."
  echo "Keep PAYFAST_MODE=sandbox for first-host proof, then run this script again."
  exit 2
fi

if grep -Eq 'replace-with|admin@example\.co\.za|chancellor\.example\.com' "$ENV_FILE"; then
  echo "ERROR: placeholder values remain in $ENV_FILE" >&2
  exit 3
fi

if ! grep -Eq '^PAYFAST_MODE=sandbox$' "$ENV_FILE"; then
  echo "ERROR: first sovereign proof requires PAYFAST_MODE=sandbox" >&2
  exit 4
fi

cd "${APP_ROOT}/deploy"

echo "Building and starting THE CHANCELLOR on IZAKHONO runtime..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

echo "Waiting for /api/health..."
for _ in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/tmp/the-chancellor-health.json 2>/dev/null; then
    echo "Health gate passed."
    cat /tmp/the-chancellor-health.json
    echo
    break
  fi
  sleep 2
done

if ! curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
  echo "ERROR: health gate failed." >&2
  docker compose -f "$COMPOSE_FILE" ps
  docker compose -f "$COMPOSE_FILE" logs --tail=100 the-chancellor || true
  exit 5
fi

echo "Checking paid-traffic readiness gate..."
READY_BODY="$(curl -fsS "$READY_URL" || true)"
printf '%s\n' "$READY_BODY"

if printf '%s' "$READY_BODY" | grep -q '"readyForPaidTraffic"[[:space:]]*:[[:space:]]*true'; then
  echo "Application readiness gate reports readyForPaidTraffic=true."
else
  echo "Application is healthy but NOT approved for paid traffic yet."
  echo "Complete persistence, backup/restore and PayFast sandbox verification before cutover."
fi

echo
printf 'THE CHANCELLOR sovereign runtime is reachable locally at http://127.0.0.1:3000\n'
printf 'Public exposure must occur only through IZAKHONO EDGE after node/cluster proof.\n'
