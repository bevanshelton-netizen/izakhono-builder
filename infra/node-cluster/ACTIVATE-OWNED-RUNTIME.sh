#!/usr/bin/env bash
set -euo pipefail

# Canonical owned-runtime activation gate for an IZAKHONO software/runtime identity.
# NODE01-NODE04 are logical runtime identities; the runtime host is separate and portable.
# This script verifies the approved host prerequisites. It does not claim LIVE status.

ENV_FILE="${IZAKHONO_CLUSTER_ENV:-/etc/izakhono/node-cluster.env}"
STATE_ROOT="${IZAKHONO_STATE_ROOT:-/opt/izakhono}"
EDGE_NETWORK="${IZAKHONO_EDGE_NETWORK:-izakhono-edge}"
RELEASE_ADAPTER="${IZAKHONO_RELEASE_ADAPTER:-/opt/izakhono/bin/izakhono-release}"
NODE_ID="${IZAKHONO_NODE_ID:-NODE01}"

fail() { echo "ACTIVATION BLOCKED: $*" >&2; exit 2; }

[[ "$(id -u)" -eq 0 ]] || fail "run as root"
[[ -f "$ENV_FILE" ]] || fail "missing $ENV_FILE; populate cluster.env outside source control"
# shellcheck disable=SC1090
source "$ENV_FILE"

case "$NODE_ID" in NODE01|NODE02|NODE03|NODE04) ;; *) fail "invalid IZAKHONO_NODE_ID=$NODE_ID" ;; esac

command -v docker >/dev/null 2>&1 || fail "Docker Engine is required"
docker info >/dev/null 2>&1 || fail "Docker Engine is not operational"
docker compose version >/dev/null 2>&1 || fail "Docker Compose is required"

mkdir -p "$STATE_ROOT/state/activation" "$STATE_ROOT/bin"
chmod 750 "$STATE_ROOT" "$STATE_ROOT/state" "$STATE_ROOT/state/activation" "$STATE_ROOT/bin"

docker network inspect "$EDGE_NETWORK" >/dev/null 2>&1 || docker network create "$EDGE_NETWORK" >/dev/null

# The release adapter is a hard production dependency for promotion, but this gate
# never fabricates or installs it. Installation must come from the hardened,
# reviewed repository artifact on the controlled host.
[[ -x "$RELEASE_ADAPTER" ]] || fail "missing executable release adapter: $RELEASE_ADAPTER"

# Identity receipt deliberately distinguishes logical node identity from the runtime host.
RECEIPT="$STATE_ROOT/state/activation/${NODE_ID}.json"
RUNTIME_HOST_VALUE="${IZAKHONO_RUNTIME_HOST:-$(hostname -s)}"
cat >"$RECEIPT.tmp" <<JSON
{
  "schema": "izakhono.activation/v1",
  "nodeId": "$NODE_ID",
  "identityType": "software-runtime",
  "runtimeHost": "$RUNTIME_HOST_VALUE",
  "runtimeHostIsSeparate": true,
  "docker": "verified",
  "compose": "verified",
  "edgeNetwork": "$EDGE_NETWORK",
  "stateRoot": "$STATE_ROOT",
  "releaseAdapter": "$RELEASE_ADAPTER",
  "live": false
}
JSON
mv -f "$RECEIPT.tmp" "$RECEIPT"
chmod 640 "$RECEIPT"

cat "$RECEIPT"
echo "Owned runtime activation gate PASSED for logical identity $NODE_ID on runtime host $RUNTIME_HOST_VALUE."
echo "Next gates: exact artifact deployment -> health -> HTTPS -> acceptance -> promotion -> backup/restore."
echo "This script does not declare LIVE."
