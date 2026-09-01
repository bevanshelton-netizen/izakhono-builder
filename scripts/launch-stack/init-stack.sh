#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo 'Run as root (sudo).'
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE="$ROOT_DIR/infra/launch-stack"
TOOLS="$ROOT_DIR/scripts/launch-stack"
TARGET=/opt/izakhono/launch-stack
BIN=/opt/izakhono/bin
SYSTEMD=/opt/izakhono/systemd
CORE_SOURCE="$ROOT_DIR/products/izakhono-core"

command -v docker >/dev/null
command -v openssl >/dev/null
docker compose version >/dev/null
[ -f "$CORE_SOURCE/Dockerfile" ] || { echo 'IZAKHONO Core source is missing.'; exit 1; }

install -d -m 0750 "$TARGET" "$TARGET/sites" "$BIN" "$SYSTEMD" /opt/izakhono/{secrets,state,backups,evidence}
cp "$SOURCE/docker-compose.yml" "$TARGET/docker-compose.yml"
cp "$SOURCE/Caddyfile" "$TARGET/Caddyfile"
cp "$SOURCE/sites/00-host-health.caddy" "$TARGET/sites/00-host-health.caddy"
for script in "$TOOLS"/*.sh; do
  install -m 0750 "$script" "$BIN/$(basename "$script")"
done
for unit in "$SOURCE/systemd"/*.service "$SOURCE/systemd"/*.timer; do
  [ -f "$unit" ] || continue
  install -m 0644 "$unit" "$SYSTEMD/$(basename "$unit")"
done

ENV_FILE="$TARGET/.env"
if [ ! -f "$ENV_FILE" ]; then
  umask 077
  POSTGRES_PASSWORD="$(openssl rand -hex 32)"
  REGISTRY_HTTP_SECRET="$(openssl rand -hex 32)"
  IZAKHONO_CORE_JWT_SECRET="$(openssl rand -hex 48)"
  IZAKHONO_CORE_ADMIN_TOKEN="$(openssl rand -hex 48)"
  cat > "$ENV_FILE" <<EOF
POSTGRES_USER=izakhono_root
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=izakhono
REGISTRY_HTTP_SECRET=$REGISTRY_HTTP_SECRET
IZAKHONO_CORE_JWT_SECRET=$IZAKHONO_CORE_JWT_SECRET
IZAKHONO_CORE_ADMIN_TOKEN=$IZAKHONO_CORE_ADMIN_TOKEN
IZAKHONO_CORE_ALLOWED_ORIGINS=
EOF
  chmod 600 "$ENV_FILE"
else
  if ! grep -q '^IZAKHONO_CORE_JWT_SECRET=' "$ENV_FILE"; then
    echo 'Existing Launch Stack predates IZAKHONO Core secrets.'
    echo 'Run /opt/izakhono/bin/upgrade-core-secrets.sh before re-running initialization.'
    exit 1
  fi
fi

echo 'Building owner-controlled IZAKHONO Core runtime...'
docker build -t izakhono/core:0.1.0 "$CORE_SOURCE"

cd "$TARGET"
docker compose config >/dev/null
docker compose up -d

for i in $(seq 1 60); do
  caddy="$(docker inspect -f '{{.State.Health.Status}}' izakhono-caddy 2>/dev/null || true)"
  postgres="$(docker inspect -f '{{.State.Health.Status}}' izakhono-postgres 2>/dev/null || true)"
  core="$(docker inspect -f '{{.State.Health.Status}}' izakhono-core 2>/dev/null || true)"
  registry="$(docker inspect -f '{{.State.Health.Status}}' izakhono-registry 2>/dev/null || true)"
  if [ "$caddy" = healthy ] && [ "$postgres" = healthy ] && [ "$core" = healthy ] && [ "$registry" = healthy ]; then
    bash "$BIN/install-automation.sh"
    echo '[PASS] IZAKHONO Launch Stack is healthy.'
    echo '[PASS] IZAKHONO Core is running on the owner-controlled host.'
    echo 'Host-local operator tools installed under /opt/izakhono/bin.'
    echo 'Health, backup and restore-rehearsal automation is enabled locally.'
    echo 'Gateway: ports 80/443; Core: internal port 8787; PostgreSQL: private network; registry: localhost:5000.'
    echo 'Secrets remain mode-0600 on this host.'
    exit 0
  fi
  sleep 2
done

docker compose ps
exit 1
