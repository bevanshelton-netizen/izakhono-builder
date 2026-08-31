#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then echo 'Run as root (sudo).'; exit 1; fi
SLUG="${1:-}"
[[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$ ]] || { echo 'Usage: recover-current.sh <project-slug>'; exit 2; }

STATE="/opt/izakhono/state/${SLUG}.current"
[ -s "$STATE" ] || { echo 'No current-release state found.'; exit 1; }
IFS='|' read -r OLD_CONTAINER DOMAIN PORT HEALTH IMAGE < "$STATE"
[ -n "$DOMAIN" ] && [ -n "$PORT" ] && [ -n "$HEALTH" ] && [ -n "$IMAGE" ] || { echo 'Current-release state is invalid.'; exit 1; }
RELEASE="${IMAGE##*:}"
REGISTRY_IMAGE="localhost:5000/${SLUG}:${RELEASE}"
CONTAINER="izakhono-${SLUG}-${RELEASE}-recovered"

if docker inspect "$OLD_CONTAINER" >/dev/null 2>&1; then
  echo 'Recorded current container still exists; normal deploy/rollback should be used instead.'
  exit 1
fi

docker pull "$REGISTRY_IMAGE" >/dev/null
docker tag "$REGISTRY_IMAGE" "$IMAGE"
RUN_ARGS=(run -d --name "$CONTAINER" --restart unless-stopped --network izakhono_public)
[ -f "/opt/izakhono/secrets/${SLUG}.db.env" ] && RUN_ARGS+=(--env-file "/opt/izakhono/secrets/${SLUG}.db.env")
[ -f "/opt/izakhono/secrets/${SLUG}.env" ] && RUN_ARGS+=(--env-file "/opt/izakhono/secrets/${SLUG}.env")
RUN_ARGS+=("$IMAGE")
docker "${RUN_ARGS[@]}" >/dev/null
docker network connect izakhono_private "$CONTAINER" 2>/dev/null || true

healthy=0
for i in $(seq 1 45); do
  if docker exec izakhono-caddy wget -q -O /dev/null "http://${CONTAINER}:${PORT}${HEALTH}" 2>/dev/null; then healthy=1; break; fi
  sleep 2
done
if [ "$healthy" -ne 1 ]; then
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  echo 'Recovered image failed the health gate.'
  exit 1
fi

cat > "/opt/izakhono/launch-stack/sites/${SLUG}.caddy" <<EOF
${DOMAIN} {
  encode zstd gzip
  reverse_proxy ${CONTAINER}:${PORT}
}
EOF
docker exec izakhono-caddy caddy validate --config /etc/caddy/Caddyfile >/dev/null
docker exec izakhono-caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null
printf '%s|%s|%s|%s|%s\n' "$CONTAINER" "$DOMAIN" "$PORT" "$HEALTH" "$IMAGE" > "$STATE"

echo "[PASS] ${SLUG} recovered from the self-hosted registry without rebuilding from source."
