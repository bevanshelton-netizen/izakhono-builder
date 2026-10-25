#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${I_CONNECT_APP_DIR:-/opt/izakhono/i-connect}"
COMPOSE_FILE="$APP_DIR/products/i-connect/deploy/docker-compose.owned.yml"
HEALTH_URL="${I_CONNECT_HEALTH_URL:-http://127.0.0.1:3000/api/health}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: run as root." >&2
  exit 1
fi

"$APP_DIR/products/i-connect/deploy/preflight-owned.sh"
"$APP_DIR/products/i-connect/deploy/admit-owned-node.sh"

echo "Building I-CONNECT owned stack..."
docker compose -f "$COMPOSE_FILE" build --pull
echo "Starting I-CONNECT owned stack..."
docker compose -f "$COMPOSE_FILE" up -d

echo "Waiting for application health endpoint..."
for attempt in {1..30}; do
  if curl -fsS "$HEALTH_URL" >/tmp/i-connect-health.json 2>/dev/null; then
    echo "I-CONNECT process health endpoint responded."
    cat /tmp/i-connect-health.json
    echo
    echo "Deployment completed at container level."
    echo "Production PSTN, billing, and regulated service activation remain subject to their explicit readiness gates."
    exit 0
  fi
  sleep 2
done

echo "ERROR: I-CONNECT health endpoint did not become ready." >&2
docker compose -f "$COMPOSE_FILE" ps >&2 || true
docker compose -f "$COMPOSE_FILE" logs --tail=100 >&2 || true
exit 1
