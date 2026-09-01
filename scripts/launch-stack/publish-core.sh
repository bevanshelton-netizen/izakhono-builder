#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then echo 'Run as root (sudo).'; exit 1; fi
DOMAIN="${1:-}"
[[ "$DOMAIN" =~ ^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,63}$ ]] || { echo 'Usage: publish-core.sh <core-domain>'; exit 2; }

TARGET=/opt/izakhono/launch-stack
SITE="$TARGET/sites/10-izakhono-core.caddy"
[ -f "$TARGET/Caddyfile" ] || { echo 'Launch Stack is not initialized.'; exit 1; }
status="$(docker inspect -f '{{.State.Health.Status}}' izakhono-core 2>/dev/null || true)"
[ "$status" = healthy ] || { echo 'IZAKHONO Core is not healthy.'; exit 1; }

BACKUP=''
if [ -f "$SITE" ]; then
  BACKUP="$(mktemp)"
  cp "$SITE" "$BACKUP"
fi
cleanup() { [ -n "$BACKUP" ] && rm -f "$BACKUP"; }
trap cleanup EXIT

cat > "$SITE.new" <<EOF
${DOMAIN} {
  encode zstd gzip
  reverse_proxy izakhono-core:8787
}
EOF
mv "$SITE.new" "$SITE"

revert() {
  if [ -n "$BACKUP" ] && [ -f "$BACKUP" ]; then cp "$BACKUP" "$SITE"; else rm -f "$SITE"; fi
  docker exec izakhono-caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || true
}

if ! docker exec izakhono-caddy caddy validate --config /etc/caddy/Caddyfile >/dev/null; then
  echo '[FAIL] Caddy rejected the Core route.'
  revert
  exit 1
fi
docker exec izakhono-caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null

ok=0
for i in $(seq 1 30); do
  if body="$(curl -fsS --connect-timeout 5 --max-time 10 "https://${DOMAIN}/healthz" 2>/dev/null)" \
    && printf '%s' "$body" | grep -Fq '"ok":true' \
    && printf '%s' "$body" | grep -Fq 'IZAKHONO Core'; then
    ok=1
    break
  fi
  sleep 2
done

if [ "$ok" -ne 1 ]; then
  echo '[FAIL] Public HTTPS Core health gate failed; reverting route.'
  revert
  exit 1
fi

printf '%s\n' "$DOMAIN" > /opt/izakhono/state/core.domain
chmod 640 /opt/izakhono/state/core.domain

echo "[PASS] IZAKHONO Core is publicly reachable at https://${DOMAIN}"
echo 'Only the Core API is published. Project provisioning still requires the server-side admin token.'
