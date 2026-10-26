#!/usr/bin/env bash
set -euo pipefail

NODE_ID="${IZAKHONO_NODE_ID:-CONTABO-VPS-01}"
RELEASE_VERSION="${IZAKHONO_RELEASE_VERSION:-unknown}"
RELEASE_ID="${IZAKHONO_RELEASE_ID:-unknown}"
SCHEMA_VERSION="${IZAKHONO_SCHEMA_VERSION:-unknown}"

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
  "releaseVersion": "${RELEASE_VERSION}",
  "releaseId": "${RELEASE_ID}",
  "schemaVersion": "${SCHEMA_VERSION}",
  "routeClass": "external-resilience",
  "health": "$( [[ "$fail" -eq 0 ]] && echo healthy || echo unhealthy )"
}
JSON

exit "$fail"
