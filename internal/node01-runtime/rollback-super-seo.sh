#!/usr/bin/env bash
set -euo pipefail

IMAGE="${1:-}"
CONTAINER="izakhono-super-seo"
PORT="8097"
HEALTH_PATH="/health"
ALLOWED_PREFIX="ghcr.io/bevanshelton-netizen/"

if [[ -z "$IMAGE" || "$IMAGE" != "$ALLOWED_PREFIX"* ]]; then
  echo "[STOP] Rollback image must be an IZAKHONO-owned GHCR image."
  exit 1
fi

echo "[1/4] Pulling rollback image..."
docker pull "$IMAGE"

echo "[2/4] Replacing SUPER SEO container..."
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" --restart unless-stopped -p "${PORT}:${PORT}" "$IMAGE" >/dev/null

echo "[3/4] Waiting for health gate..."
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PORT}${HEALTH_PATH}" >/dev/null; then
    echo "[4/4] [PASS] Rollback image is healthy."
    exit 0
  fi
  sleep 1
done

echo "[STOP] Rollback candidate failed health gate."
docker logs --tail 80 "$CONTAINER" || true
exit 1
