#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo 'Run as root (sudo).'
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE="$ROOT_DIR/infra/launch-stack"
TARGET=/opt/izakhono/launch-stack

command -v docker >/dev/null
command -v openssl >/dev/null
docker compose version >/dev/null

install -d -m 0750 "$TARGET" "$TARGET/sites" /opt/izakhono/{secrets,state,backups}
cp "$SOURCE/docker-compose.yml" "$TARGET/docker-compose.yml"
cp "$SOURCE/Caddyfile" "$TARGET/Caddyfile"
cp "$SOURCE/sites/00-host-health.caddy" "$TARGET/sites/00-host-health.caddy"

ENV_FILE="$TARGET/.env"
if [ ! -f "$ENV_FILE" ]; then
  umask 077
  POSTGRES_PASSWORD="$(openssl rand -hex 32)"
  REGISTRY_HTTP_SECRET="$(openssl rand -hex 32)"
  cat > "$ENV_FILE" <<EOF
POSTGRES_USER=izakhono_root
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=izakhono
REGISTRY_HTTP_SECRET=$REGISTRY_HTTP_SECRET
EOF
  chmod 600 "$ENV_FILE"
fi

cd "$TARGET"
docker compose config >/dev/null
docker compose up -d

for i in $(seq 1 45); do
  caddy="$(docker inspect -f '{{.State.Health.Status}}' izakhono-caddy 2>/dev/null || true)"
  postgres="$(docker inspect -f '{{.State.Health.Status}}' izakhono-postgres 2>/dev/null || true)"
  registry="$(docker inspect -f '{{.State.Health.Status}}' izakhono-registry 2>/dev/null || true)"
  if [ "$caddy" = healthy ] && [ "$postgres" = healthy ] && [ "$registry" = healthy ]; then
    echo '[PASS] IZAKHONO Launch Stack is healthy.'
    echo 'Gateway: ports 80/443; PostgreSQL: private network; registry: localhost:5000.'
    echo 'Secrets remain mode-0600 on this host.'
    exit 0
  fi
  sleep 2
done

docker compose ps
exit 1
