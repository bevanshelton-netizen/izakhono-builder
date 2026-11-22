#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer as root on the authorised NODE01 host." >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker Engine is required. Install and verify Docker before continuing." >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required." >&2
  exit 1
fi
if ! command -v openssl >/dev/null 2>&1; then
  echo "OpenSSL is required to generate a runner credential." >&2
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
install -d -o root -g root -m 0700 /etc/izakhono
install -d -o root -g root -m 0700 /var/lib/izakhono-code
TOKEN_FILE=/etc/izakhono/code-runner.owner-token
if [[ ! -s "$TOKEN_FILE" ]]; then
  umask 077
  openssl rand -hex 32 > "$TOKEN_FILE"
fi
chown root:root "$TOKEN_FILE"
chmod 0600 "$TOKEN_FILE"

docker compose -f "$SCRIPT_DIR/docker-compose.yml" build
docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:8860/healthz >/dev/null; then
    echo "IZAKHONO CODE runner is healthy on host loopback 127.0.0.1:8860."
    echo "Runner token file: $TOKEN_FILE (root-only; do not print or commit it)."
    echo "Next: expose this service only through the approved private TLS tunnel, then set WORKSPACE_RUNNER_URL and WORKSPACE_RUNNER_TOKEN in the Worker."
    exit 0
  fi
  sleep 2
done

docker compose -f "$SCRIPT_DIR/docker-compose.yml" logs --tail=100
echo "Runner health check timed out. No public port was opened." >&2
exit 1
