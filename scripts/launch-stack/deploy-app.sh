#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo 'Run as root (sudo).'
  exit 1
fi

REPO="${1:-}"
DOMAIN="${2:-}"
MODE="${3:-}"
[ -d "$REPO" ] || { echo 'Usage: deploy-app.sh <repo-path> <domain> [--require-public]'; exit 2; }
[[ "$DOMAIN" =~ ^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,63}$ ]] || { echo 'Invalid domain.'; exit 2; }

MANIFEST="$REPO/.izakhono.json"
[ -f "$MANIFEST" ] || { echo 'Missing .izakhono.json'; exit 1; }
command -v jq >/dev/null
command -v docker >/dev/null

SLUG="$(jq -r '.slug // empty' "$MANIFEST")"
CONTEXT="$(jq -r '.build_context // empty' "$MANIFEST")"
DOCKERFILE="$(jq -r '.dockerfile_path // empty' "$MANIFEST")"
PORT="$(jq -r '.container_port // empty' "$MANIFEST")"
HEALTH="$(jq -r '.health_path // empty' "$MANIFEST")"

[[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$ ]] || { echo 'Unsafe slug.'; exit 1; }
[[ "$PORT" =~ ^[0-9]{2,5}$ ]] && [ "$PORT" -ge 1 ] && [ "$PORT" -le 65535 ] || { echo 'Invalid port.'; exit 1; }
[[ "$HEALTH" =~ ^/[A-Za-z0-9._~!$\&'()*+,;=:@%/-]*$ ]] || { echo 'A safe HTTP health_path is required.'; exit 1; }
for P in "$CONTEXT" "$DOCKERFILE"; do
  [ -n "$P" ] && [[ "$P" != /* ]] && [[ "/$P/" != *"/../"* ]] || { echo 'Unsafe repository path in manifest.'; exit 1; }
done
[ -d "$REPO/$CONTEXT" ] || { echo 'Build context missing.'; exit 1; }
[ -f "$REPO/$DOCKERFILE" ] || { echo 'Dockerfile missing.'; exit 1; }

docker inspect izakhono-caddy >/dev/null 2>&1 || { echo 'Launch stack is not running.'; exit 1; }

RELEASE="$(git -C "$REPO" rev-parse --short=12 HEAD 2>/dev/null || date -u +%Y%m%d%H%M%S)"
IMAGE="izakhono/${SLUG}:${RELEASE}"
REGISTRY_IMAGE="localhost:5000/${SLUG}:${RELEASE}"
CONTAINER="izakhono-${SLUG}-${RELEASE}"
STATE_DIR=/opt/izakhono/state
SITE_DIR=/opt/izakhono/launch-stack/sites
SECRET_DIR=/opt/izakhono/secrets
CURRENT="$STATE_DIR/${SLUG}.current"
HISTORY="$STATE_DIR/${SLUG}.history"
SITE="$SITE_DIR/${SLUG}.caddy"
SITE_BAK="$SITE.bak"

mkdir -p "$STATE_DIR" "$SITE_DIR"

echo "Building $SLUG from $RELEASE..."
docker build --pull -f "$REPO/$DOCKERFILE" -t "$IMAGE" "$REPO/$CONTEXT"
docker tag "$IMAGE" "$REGISTRY_IMAGE"
docker push "$REGISTRY_IMAGE" >/dev/null

RUN_ARGS=(run -d --name "$CONTAINER" --restart unless-stopped --network izakhono_public)
[ -f "$SECRET_DIR/${SLUG}.db.env" ] && RUN_ARGS+=(--env-file "$SECRET_DIR/${SLUG}.db.env")
[ -f "$SECRET_DIR/${SLUG}.env" ] && RUN_ARGS+=(--env-file "$SECRET_DIR/${SLUG}.env")
RUN_ARGS+=("$IMAGE")
docker "${RUN_ARGS[@]}" >/dev/null
docker network connect izakhono_private "$CONTAINER" 2>/dev/null || true

healthy=0
for i in $(seq 1 45); do
  if docker exec izakhono-caddy wget -q -O /dev/null "http://${CONTAINER}:${PORT}${HEALTH}" 2>/dev/null; then
    healthy=1
    break
  fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || true)" != true ]; then break; fi
  sleep 2
done
if [ "$healthy" -ne 1 ]; then
  echo '[FAIL] Candidate failed the internal health gate.'
  docker logs --tail 100 "$CONTAINER" || true
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  exit 1
fi

OLD_STATE=''
[ -f "$CURRENT" ] && OLD_STATE="$(cat "$CURRENT")"
[ -f "$SITE" ] && cp "$SITE" "$SITE_BAK"
cat > "$SITE.new" <<EOF
${DOMAIN} {
  encode zstd gzip
  reverse_proxy ${CONTAINER}:${PORT}
}
EOF
mv "$SITE.new" "$SITE"

if ! docker exec izakhono-caddy caddy validate --config /etc/caddy/Caddyfile >/dev/null; then
  echo '[FAIL] Caddy rejected the candidate route.'
  [ -f "$SITE_BAK" ] && mv "$SITE_BAK" "$SITE" || rm -f "$SITE"
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  exit 1
fi
docker exec izakhono-caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null

if [ "$MODE" = '--require-public' ]; then
  public_ok=0
  for i in $(seq 1 30); do
    if curl -fsS --connect-timeout 5 --max-time 10 "https://${DOMAIN}${HEALTH}" >/dev/null 2>&1; then public_ok=1; break; fi
    sleep 2
  done
  if [ "$public_ok" -ne 1 ]; then
    echo '[FAIL] Public HTTPS gate failed; reverting route.'
    [ -f "$SITE_BAK" ] && mv "$SITE_BAK" "$SITE" || rm -f "$SITE"
    docker exec izakhono-caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null || true
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    exit 1
  fi
fi

rm -f "$SITE_BAK"
if [ -n "$OLD_STATE" ]; then
  printf '%s\n' "$OLD_STATE" >> "$HISTORY"
  OLD_CONTAINER="${OLD_STATE%%|*}"
  docker stop "$OLD_CONTAINER" >/dev/null 2>&1 || true
fi
printf '%s|%s|%s|%s|%s\n' "$CONTAINER" "$DOMAIN" "$PORT" "$HEALTH" "$IMAGE" > "$CURRENT"
chmod 640 "$CURRENT" "$HISTORY" 2>/dev/null || true

echo "[PASS] ${SLUG} promoted to ${DOMAIN} at ${RELEASE}."
if [ "$MODE" != '--require-public' ]; then
  echo 'Internal health is proven. Public DNS/TLS was not asserted; use --require-public for a commercial publication gate.'
fi
