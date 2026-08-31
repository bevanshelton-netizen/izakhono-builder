#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then echo 'Run as root (sudo).'; exit 1; fi
SLUG="${1:-}"
[[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$ ]] || { echo 'Usage: rollback-app.sh <project-slug>'; exit 2; }

STATE_DIR=/opt/izakhono/state
SITE_DIR=/opt/izakhono/launch-stack/sites
CURRENT="$STATE_DIR/${SLUG}.current"
HISTORY="$STATE_DIR/${SLUG}.history"
[ -s "$CURRENT" ] && [ -s "$HISTORY" ] || { echo 'No rollback candidate is recorded.'; exit 1; }

CURRENT_STATE="$(cat "$CURRENT")"
PREVIOUS_STATE="$(tail -n 1 "$HISTORY")"
IFS='|' read -r CUR_CONTAINER CUR_DOMAIN CUR_PORT CUR_HEALTH CUR_IMAGE <<< "$CURRENT_STATE"
IFS='|' read -r PREV_CONTAINER PREV_DOMAIN PREV_PORT PREV_HEALTH PREV_IMAGE <<< "$PREVIOUS_STATE"

[ -n "$PREV_CONTAINER" ] && [ -n "$PREV_DOMAIN" ] && [ -n "$PREV_PORT" ] || { echo 'Rollback state is invalid.'; exit 1; }
docker inspect "$PREV_CONTAINER" >/dev/null 2>&1 || { echo 'Previous container no longer exists; refusing a fake rollback.'; exit 1; }
docker start "$PREV_CONTAINER" >/dev/null

healthy=0
for i in $(seq 1 30); do
  if docker exec izakhono-caddy wget -q -O /dev/null "http://${PREV_CONTAINER}:${PREV_PORT}${PREV_HEALTH}" 2>/dev/null; then healthy=1; break; fi
  sleep 2
done
[ "$healthy" -eq 1 ] || { docker stop "$PREV_CONTAINER" >/dev/null || true; echo 'Previous release failed its health gate.'; exit 1; }

cat > "$SITE_DIR/${SLUG}.caddy" <<EOF
${PREV_DOMAIN} {
  encode zstd gzip
  reverse_proxy ${PREV_CONTAINER}:${PREV_PORT}
}
EOF
docker exec izakhono-caddy caddy validate --config /etc/caddy/Caddyfile >/dev/null
docker exec izakhono-caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null
docker stop "$CUR_CONTAINER" >/dev/null 2>&1 || true
printf '%s\n' "$PREVIOUS_STATE" > "$CURRENT"
head -n -1 "$HISTORY" > "$HISTORY.tmp" || true
mv "$HISTORY.tmp" "$HISTORY"

echo "[PASS] ${SLUG} rolled back to ${PREV_IMAGE}."
