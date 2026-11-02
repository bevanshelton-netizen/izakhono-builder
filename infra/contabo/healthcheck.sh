#!/usr/bin/env bash
set -euo pipefail

# NODE01-NODE04 are portable logical software/runtime identities.
# The physical/virtual runtime host is separate and must never be inferred as NODE01.
NODE_ID="${IZAKHONO_NODE_ID:-NODE01}"
RUNTIME_HOST="${IZAKHONO_RUNTIME_HOST_NAME:-$(hostname -s)}"
RELEASE_VERSION="${IZAKONO_RELEASE_VERSION:-unknown}"
RELEASE_ID="${IZAKONO_RELEASE_ID:-unknown}"
SCHEMA_VERSION="${IZAKONO_SCHEMA_VERSION:-unknown}"

case "$NODE_ID" in
  NODE01|NODE02|NODE03|NODE04) ;;
  *) echo "Invalid logical runtime identity: $NODE_ID" >&2; exit 2 ;;
esac

fail=0
check() {
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    printf 'PASS  %s\n' "$name"
  else
    printf 'FAIL  %s\n' "$name"
    fail=1
  fi
}

check "docker" systemctl is-active docker
check "docker compose" docker compose version
check "filesystem /opt/izakhono" test -d /opt/izakhono
check "filesystem /opt/izakhono/releases" test -d /opt/izakhono/releases
check "firewall" ufw status
check "fail2ban" systemctl is-active fail2ban
check "unattended-upgrades package" dpkg-query -W unattended-upgrades

cat <<JSON
{
  "product": "IZAKHONO Runtime Fabric",
  "nodeId": "${NODE_ID}",
  "identityType": "software-runtime",
  "runtimeHost": "${RUNTIME_HOST}",
  "runtimeHostIsSeparate": true,
  "releaseVersion": "${RELEASE_VERSION}",
  "releaseId": "${RELEASE_ID}",
  "schemaVersion": "${SCHEMA_VERSION}",
  "routeClass": "external-resilience",
  "health": "$( [[ "$fail" -eq 0 ]] && echo healthy || echo unhealthy )"
}
JSON

exit "$fail"
