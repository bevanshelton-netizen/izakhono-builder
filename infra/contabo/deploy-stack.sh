#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

: "${IZAKHONO_RELEASE_ID:?Set IZAKHONO_RELEASE_ID}"
: "${IZAKHONO_RELEASE_VERSION:?Set IZAKHONO_RELEASE_VERSION}"
: "${IZAKHONO_NODE_ID:?Set IZAKHONO_NODE_ID}"

mkdir -p "/opt/izakhono/releases/${IZAKHONO_RELEASE_ID}"
cp compose.yml stack.env.example "/opt/izakhono/releases/${IZAKHONO_RELEASE_ID}/"
cp -R postgres-init "/opt/izakhono/releases/${IZAKHONO_RELEASE_ID}/"

cat > "/opt/izakhono/releases/${IZAKHONO_RELEASE_ID}/release.json" <<JSON
{
  "product": "IZAKHONO Runtime Fabric",
  "releaseVersion": "${IZAKHONO_RELEASE_VERSION}",
  "releaseId": "${IZAKHONO_RELEASE_ID}",
  "schemaVersion": "${IZAKHONO_SCHEMA_VERSION:-1}",
  "nodeId": "${IZAKHONO_NODE_ID}",
  "routeClass": "external-resilience",
  "immutable": true
}
JSON

ln -sfn "/opt/izakhono/releases/${IZAKHONO_RELEASE_ID}" /opt/izakhono/current

# Runtime secrets must be supplied through the host secret store; never generated into Git.
if [[ ! -f /opt/izakhono/config/stack.env ]]; then
  echo "Missing /opt/izakhono/config/stack.env; refusing to start services without secrets." >&2
  exit 10
fi

set -a
source /opt/izakhono/config/stack.env
set +a

# Validate the compose graph before touching running services.
docker compose --env-file /opt/izakhono/config/stack.env -f /opt/izakhono/current/compose.yml config >/dev/null

docker compose --env-file /opt/izakhono/config/stack.env -f /opt/izakhono/current/compose.yml pull
docker compose --env-file /opt/izakhono/config/stack.env -f /opt/izakhono/current/compose.yml up -d

docker compose --env-file /opt/izakhono/config/stack.env -f /opt/izakhono/current/compose.yml ps

cat /opt/izakhono/current/release.json
printf '%s\n' "Release started on ${IZAKHONO_NODE_ID}; public LIVE status still requires EDGE/TLS/DNS and application verification."
