#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

command -v docker >/dev/null 2>&1 || { echo "[STOP] Docker is required."; exit 2; }
docker info >/dev/null 2>&1 || { echo "[STOP] Docker engine is not ready."; exit 3; }
[ -f /etc/izakhono/control.owner-token ] || { echo "[STOP] IZAKHONO CONTROL is not activated. Run products/izakhono-node/install.sh first."; exit 4; }

install -d -m 0700 /etc/izakhono
if [ ! -s /etc/izakhono/commands.owner-token ]; then
  umask 077
  openssl rand -hex 32 > /etc/izakhono/commands.owner-token
  chmod 600 /etc/izakhono/commands.owner-token
fi

bash "$ROOT/products/izakhono-node/sync-builder-to-code.sh" "$ROOT"

docker compose -p izakhono-izakhono-commands -f "$HERE/docker-compose.yml" config >/dev/null
docker compose -p izakhono-izakhono-commands -f "$HERE/docker-compose.yml" build
docker compose -p izakhono-izakhono-commands -f "$HERE/docker-compose.yml" up -d --remove-orphans

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8091/healthz >/dev/null 2>&1; then
    echo "[PASS] IZAKHONO Command Centre gateway is healthy."
    echo "Local console: http://127.0.0.1:8091/commands"
    echo "Owner command credential: /etc/izakhono/commands.owner-token"
    exit 0
  fi
  sleep 2
done

docker compose -p izakhono-izakhono-commands -f "$HERE/docker-compose.yml" ps || true
docker compose -p izakhono-izakhono-commands -f "$HERE/docker-compose.yml" logs --tail=120 || true
echo "[STOP] Command Centre gateway did not become healthy."
exit 5
