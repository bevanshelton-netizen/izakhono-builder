#!/usr/bin/env bash
set -euo pipefail

IMAGE="${1:-ghcr.io/bevanshelton-netizen/izakhono-super-seo:node01}"
NAME="izakhono-super-seo"
PORT="8097"

case "$IMAGE" in
  ghcr.io/bevanshelton-netizen/*) ;;
  *) echo "[STOP] Image is outside the IZAKHONO GHCR namespace."; exit 1 ;;
esac

command -v docker >/dev/null || { echo "[STOP] Docker is required."; exit 1; }
command -v curl >/dev/null || { echo "[STOP] curl is required."; exit 1; }

printf '%s\n' "[1/4] Pulling $IMAGE"
docker pull "$IMAGE"
printf '%s\n' "[2/4] Replacing SUPER SEO runtime"
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --restart unless-stopped -p "$PORT:$PORT" "$IMAGE" >/dev/null
printf '%s\n' "[3/4] Waiting for health"
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then break; fi
  sleep 2
done
printf '%s\n' "[4/4] Health check"
curl -fsS "http://127.0.0.1:$PORT/health"
printf '\n%s\n' "[PASS] SUPER SEO is running on NODE01 port $PORT."
